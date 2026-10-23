"""Database schema context generator and metadata inspector."""

from typing import Any

from django.db import connection

# Whitelist of tables exposed for natural language queries and AI assistance
ALLOWED_TABLES = [
    "customers",
    "products",
    "orders",
    "order_items",
    "payments",
    "website_events",
    "users",
]

SCHEMA_DEFINITIONS = {
    "users": {
        "description": "System users and administrators.",
        "columns": [
            {"name": "id", "type": "bigint", "primary_key": True, "description": "Unique user ID"},
            {"name": "name", "type": "varchar(255)", "description": "User full name"},
            {"name": "email", "type": "varchar(255)", "unique": True, "description": "User email address"},
            {"name": "created_at", "type": "timestamptz", "description": "Account registration timestamp"},
        ],
        "foreign_keys": [],
    },
    "customers": {
        "description": "Business customers and account entities for sales and CRM.",
        "columns": [
            {"name": "id", "type": "bigint", "primary_key": True, "description": "Unique customer ID"},
            {"name": "name", "type": "varchar(255)", "description": "Customer company or contact name"},
            {"name": "email", "type": "varchar(255)", "unique": True, "description": "Customer primary email"},
            {"name": "country", "type": "varchar(100)", "description": "Country of residence/incorporation"},
            {"name": "signup_date", "type": "date", "description": "Date customer signed up"},
            {"name": "customer_segment", "type": "varchar(50)", "choices": ["ENTERPRISE", "SMB", "CONSUMER"], "description": "Customer tier or segment"},
            {"name": "created_at", "type": "timestamptz", "description": "Row creation timestamp"},
        ],
        "foreign_keys": [],
    },
    "products": {
        "description": "Product catalog, pricing, cost of goods sold (COGS), and inventory levels.",
        "columns": [
            {"name": "id", "type": "bigint", "primary_key": True, "description": "Unique product ID"},
            {"name": "name", "type": "varchar(255)", "description": "Product display name"},
            {"name": "category", "type": "varchar(100)", "description": "Product category/department"},
            {"name": "price", "type": "numeric(12,2)", "description": "Retail price in USD (must be >= 0)"},
            {"name": "cost", "type": "numeric(12,2)", "description": "Unit manufacturing/wholesale cost in USD"},
            {"name": "stock_quantity", "type": "integer", "description": "Current on-hand inventory count"},
            {"name": "created_at", "type": "timestamptz", "description": "Row creation timestamp"},
        ],
        "foreign_keys": [],
    },
    "orders": {
        "description": "Header records for commercial transactions placed by customers.",
        "columns": [
            {"name": "id", "type": "bigint", "primary_key": True, "description": "Unique order ID"},
            {"name": "customer_id", "type": "bigint", "foreign_key": "customers.id", "description": "Foreign key to customers.id"},
            {"name": "order_date", "type": "timestamptz", "description": "Order placement timestamp"},
            {"name": "status", "type": "varchar(50)", "choices": ["COMPLETED", "PENDING", "CANCELLED", "REFUNDED"], "description": "Order lifecycle status"},
            {"name": "total_amount", "type": "numeric(12,2)", "description": "Total order currency amount in USD"},
            {"name": "created_at", "type": "timestamptz", "description": "Row creation timestamp"},
        ],
        "foreign_keys": [
            {"column": "customer_id", "references_table": "customers", "references_column": "id", "cardinality": "many_to_one"}
        ],
    },
    "order_items": {
        "description": "Individual line items within an order detailing quantity, unit price, and subtotal.",
        "columns": [
            {"name": "id", "type": "bigint", "primary_key": True, "description": "Unique order item ID"},
            {"name": "order_id", "type": "bigint", "foreign_key": "orders.id", "description": "Foreign key to orders.id"},
            {"name": "product_id", "type": "bigint", "foreign_key": "products.id", "description": "Foreign key to products.id"},
            {"name": "quantity", "type": "integer", "description": "Purchased unit count (must be > 0)"},
            {"name": "unit_price", "type": "numeric(12,2)", "description": "Price per item at time of transaction"},
            {"name": "subtotal", "type": "numeric(12,2)", "description": "Calculated subtotal: quantity * unit_price"},
        ],
        "foreign_keys": [
            {"column": "order_id", "references_table": "orders", "references_column": "id", "cardinality": "many_to_one"},
            {"column": "product_id", "references_table": "products", "references_column": "id", "cardinality": "many_to_one"},
        ],
    },
    "payments": {
        "description": "Financial payment settlement records for orders.",
        "columns": [
            {"name": "id", "type": "bigint", "primary_key": True, "description": "Unique payment ID"},
            {"name": "order_id", "type": "bigint", "foreign_key": "orders.id", "description": "Foreign key to orders.id"},
            {"name": "payment_date", "type": "timestamptz", "description": "Payment execution timestamp"},
            {"name": "amount", "type": "numeric(12,2)", "description": "Processed payment amount in USD"},
            {"name": "payment_method", "type": "varchar(50)", "choices": ["CREDIT_CARD", "BANK_TRANSFER", "PAYPAL", "STRIPE"], "description": "Method of payment"},
            {"name": "payment_status", "type": "varchar(50)", "choices": ["SUCCESS", "PENDING", "FAILED"], "description": "Settlement outcome"},
        ],
        "foreign_keys": [
            {"column": "order_id", "references_table": "orders", "references_column": "id", "cardinality": "many_to_one"}
        ],
    },
    "website_events": {
        "description": "Clickstream and user engagement telemetry events.",
        "columns": [
            {"name": "id", "type": "bigint", "primary_key": True, "description": "Unique event ID"},
            {"name": "customer_id", "type": "bigint", "foreign_key": "customers.id", "nullable": True, "description": "Nullable foreign key to customers.id"},
            {"name": "event_type", "type": "varchar(50)", "choices": ["PAGE_VIEW", "PRODUCT_VIEW", "ADD_TO_CART", "CHECKOUT_START", "PURCHASE"], "description": "Type of user action"},
            {"name": "event_timestamp", "type": "timestamptz", "description": "Telemetry event timestamp"},
            {"name": "metadata", "type": "jsonb", "description": "Arbitrary key-value JSON telemetry data"},
        ],
        "foreign_keys": [
            {"column": "customer_id", "references_table": "customers", "references_column": "id", "cardinality": "many_to_one"}
        ],
    },
}


def get_schema_context_prompt() -> str:
    """Format schema context into a clean, concise string for LLM prompting."""
    lines = []
    for table_name, meta in SCHEMA_DEFINITIONS.items():
        lines.append(f"Table: {table_name} ({meta['description']})")
        col_strs = []
        for col in meta["columns"]:
            c_desc = f"{col['name']} ({col['type']}"
            if col.get("primary_key"):
                c_desc += ", PK"
            if col.get("foreign_key"):
                c_desc += f", FK -> {col['foreign_key']}"
            if col.get("choices"):
                c_desc += f", choices: [{', '.join(col['choices'])}]"
            c_desc += ")"
            col_strs.append(f"  - {c_desc}")
        lines.extend(col_strs)
        lines.append("")
    return "\n".join(lines)


def get_schema_metadata() -> dict[str, Any]:
    """Retrieve full schema metadata including table statistics and ER diagram graph."""
    table_stats = {}
    with connection.cursor() as cursor:
        for tname in ALLOWED_TABLES:
            if tname not in SCHEMA_DEFINITIONS:
                continue
            try:
                quoted_table = connection.ops.quote_name(tname)
                cursor.execute(f"SELECT COUNT(*) FROM {quoted_table};")
                row = cursor.fetchone()
                table_stats[tname] = row[0] if row else 0
            except Exception:
                table_stats[tname] = 0

    tables_data = []
    for tname, meta in SCHEMA_DEFINITIONS.items():
        tables_data.append(
            {
                "name": tname,
                "description": meta["description"],
                "row_count": table_stats.get(tname, 0),
                "columns": meta["columns"],
                "foreign_keys": meta["foreign_keys"],
            }
        )

    # Pre-built ER relationships for frontend visualization
    relationships = [
        {"from": "orders", "from_col": "customer_id", "to": "customers", "to_col": "id", "type": "many_to_one"},
        {"from": "order_items", "from_col": "order_id", "to": "orders", "to_col": "id", "type": "many_to_one"},
        {"from": "order_items", "from_col": "product_id", "to": "products", "to_col": "id", "type": "many_to_one"},
        {"from": "payments", "from_col": "order_id", "to": "orders", "to_col": "id", "type": "many_to_one"},
        {"from": "website_events", "from_col": "customer_id", "to": "customers", "to_col": "id", "type": "many_to_one"},
    ]

    return {
        "tables": tables_data,
        "relationships": relationships,
        "allowed_tables": ALLOWED_TABLES,
    }
