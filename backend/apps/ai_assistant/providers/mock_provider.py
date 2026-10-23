"""Deterministic mock LLM Provider for demo and development without API keys."""

import logging
import re
from typing import Any

from apps.ai_assistant.providers.base import LLMProvider

logger = logging.getLogger(__name__)


class MockProvider(LLMProvider):
    """
    Deterministic AI provider supporting offline demo mode.
    Accurately maps common business intelligence questions to production-grade SQL.
    """

    def generate_sql(self, question: str, schema_context: str, dialect: str = "postgresql") -> str:
        clean_q = question.strip()
        # Direct SQL passthrough: If question is already an explicit SELECT or WITH query, preserve it directly
        if re.match(r"^(SELECT|WITH)\s", clean_q, re.IGNORECASE):
            return clean_q

        q = clean_q.lower()
        dialect_lower = (dialect or "postgresql").lower()
        is_postgres = dialect_lower in ("postgresql", "postgres")
        is_mysql = dialect_lower == "mysql"
        is_sqlite = dialect_lower == "sqlite"

        numeric_cast = "::numeric" if is_postgres else ""
        nulls_last = " NULLS LAST" if is_postgres else ""
        nulls_first = " NULLS FIRST" if is_postgres else ""

        # Handle external data sources with custom schema context
        custom_tables = re.findall(r"Table `([^`]+)`:\s*([^|\n]+)", schema_context)
        if custom_tables and "Table `customers`" not in schema_context and "customers" not in schema_context:
            selected_table = None
            selected_cols = []
            for t_name, cols_str in custom_tables:
                if t_name.lower() in q:
                    selected_table = t_name
                    col_defs = [c.strip().split()[0] for c in cols_str.split(",") if c.strip()]
                    selected_cols = col_defs
                    break

            if not selected_table and custom_tables:
                selected_table = custom_tables[0][0]
                col_defs = [c.strip().split()[0] for c in custom_tables[0][1].split(",") if c.strip()]
                selected_cols = col_defs

            cols_projection = ", ".join(selected_cols[:6]) if selected_cols else "*"
            return f"SELECT {cols_projection} FROM {selected_table} LIMIT 10;"

        # 1. Top customers by revenue in 2026
        if "top" in q and "customer" in q and ("2026" in q or "revenue" in q):
            return f"""SELECT
    c.id AS customer_id,
    c.name AS customer_name,
    c.email,
    c.country,
    c.customer_segment,
    COUNT(o.id) AS total_orders,
    ROUND(SUM(o.total_amount){numeric_cast}, 2) AS total_revenue
FROM customers c
INNER JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'COMPLETED'
GROUP BY c.id, c.name, c.email, c.country, c.customer_segment
ORDER BY total_revenue DESC
LIMIT 10;"""

        # 2. Monthly revenue in 2026 or monthly sales
        if ("monthly revenue" in q or "revenue by month" in q or "revenue in 2026" in q):
            if is_mysql:
                date_fmt = "DATE_FORMAT(order_date, '%Y-%m')"
            elif is_sqlite:
                date_fmt = "strftime('%Y-%m', order_date)"
            else:
                date_fmt = "TO_CHAR(order_date, 'YYYY-MM')"
            return f"""SELECT
    {date_fmt} AS sales_month,
    COUNT(id) AS total_orders,
    ROUND(SUM(total_amount){numeric_cast}, 2) AS monthly_revenue,
    ROUND(AVG(total_amount){numeric_cast}, 2) AS avg_order_value
FROM orders
WHERE status = 'COMPLETED'
GROUP BY {date_fmt}
ORDER BY sales_month ASC;"""

        # 3. Top products by revenue
        if "product" in q and ("revenue" in q or "top" in q or "most" in q or "best" in q):
            return f"""SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.category,
    p.price,
    SUM(oi.quantity) AS units_sold,
    ROUND(SUM(oi.subtotal){numeric_cast}, 2) AS total_revenue,
    ROUND(SUM(oi.subtotal - (oi.quantity * p.cost)){numeric_cast}, 2) AS gross_profit
FROM products p
INNER JOIN order_items oi ON p.id = oi.product_id
INNER JOIN orders o ON oi.order_id = o.id
WHERE o.status = 'COMPLETED'
GROUP BY p.id, p.name, p.category, p.price
ORDER BY total_revenue DESC
LIMIT 10;"""

        # 4. Average order value by country
        if "country" in q and ("average" in q or "aov" in q or "revenue" in q or "value" in q):
            return f"""SELECT
    c.country,
    COUNT(DISTINCT c.id) AS unique_customers,
    COUNT(o.id) AS total_orders,
    ROUND(AVG(o.total_amount){numeric_cast}, 2) AS avg_order_value,
    ROUND(SUM(o.total_amount){numeric_cast}, 2) AS total_revenue
FROM customers c
INNER JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'COMPLETED'
GROUP BY c.country
HAVING COUNT(o.id) >= 5
ORDER BY total_revenue DESC
LIMIT 15;"""

        # 5. Customers with no orders in last 90 days (churn / inactivity)
        if "no order" in q or "not placed" in q or "inactive" in q or "90 days" in q:
            if is_sqlite:
                date_diff = "ROUND(julianday('now') - julianday(MAX(o.order_date)))"
                interval_clause = "date('now', '-90 days')"
            elif is_mysql:
                date_diff = "DATEDIFF(CURRENT_DATE, MAX(o.order_date))"
                interval_clause = "CURRENT_DATE - INTERVAL 90 DAY"
            else:
                date_diff = "CURRENT_DATE - MAX(o.order_date)::date"
                interval_clause = "CURRENT_DATE - INTERVAL '90 days'"

            return f"""SELECT
    c.id,
    c.name,
    c.email,
    c.customer_segment,
    MAX(o.order_date) AS last_order_date,
    {date_diff} AS days_since_last_order
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.id, c.name, c.email, c.customer_segment
HAVING MAX(o.order_date) < {interval_clause}
   OR MAX(o.order_date) IS NULL
ORDER BY days_since_last_order DESC{nulls_first}
LIMIT 20;"""

        # 6. Top 5 products in each category (Window Function DENSE_RANK)
        if "each category" in q or ("category" in q and ("top 5" in q or "rank" in q)):
            return f"""WITH RankedProducts AS (
    SELECT
        p.category,
        p.id AS product_id,
        p.name AS product_name,
        ROUND(SUM(oi.subtotal){numeric_cast}, 2) AS category_revenue,
        DENSE_RANK() OVER (
            PARTITION BY p.category
            ORDER BY SUM(oi.subtotal) DESC
        ) AS rank_in_category
    FROM products p
    INNER JOIN order_items oi ON p.id = oi.product_id
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.status = 'COMPLETED'
    GROUP BY p.category, p.id, p.name
)
SELECT category, rank_in_category, product_name, category_revenue
FROM RankedProducts
WHERE rank_in_category <= 5
ORDER BY category, rank_in_category;"""

        # 7. Month-over-month revenue comparison (LAG Window Function)
        if "month over month" in q or "compare" in q or "mom" in q or "growth" in q:
            if is_sqlite:
                date_trunc = "strftime('%Y-%m', order_date)"
            elif is_mysql:
                date_trunc = "DATE_FORMAT(order_date, '%Y-%m')"
            else:
                date_trunc = "DATE_TRUNC('month', order_date)::date"

            return f"""WITH MonthlySales AS (
    SELECT
        {date_trunc} AS sales_month,
        ROUND(SUM(total_amount){numeric_cast}, 2) AS current_month_revenue
    FROM orders
    WHERE status = 'COMPLETED'
    GROUP BY {date_trunc}
)
SELECT
    sales_month,
    current_month_revenue,
    LAG(current_month_revenue, 1) OVER (ORDER BY sales_month) AS previous_month_revenue,
    ROUND(
        (current_month_revenue - LAG(current_month_revenue, 1) OVER (ORDER BY sales_month))
        / NULLIF(LAG(current_month_revenue, 1) OVER (ORDER BY sales_month), 0) * 100,
        2
    ) AS mom_growth_pct
FROM MonthlySales
ORDER BY sales_month ASC;"""

        # 8. Customer segmentation breakdown
        if "segment" in q:
            return f"""SELECT
    c.customer_segment,
    COUNT(DISTINCT c.id) AS total_customers,
    COUNT(o.id) AS total_orders,
    ROUND(SUM(o.total_amount){numeric_cast}, 2) AS segment_revenue,
    ROUND(AVG(o.total_amount){numeric_cast}, 2) AS avg_order_value
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id AND o.status = 'COMPLETED'
GROUP BY c.customer_segment
ORDER BY segment_revenue DESC{nulls_last};"""

        # 9. Order status distribution
        if "status" in q and "order" in q:
            return f"""SELECT
    status,
    COUNT(id) AS order_count,
    ROUND(SUM(total_amount){numeric_cast}, 2) AS total_value,
    ROUND(COUNT(id) * 100.0 / SUM(COUNT(id)) OVER (), 2) AS percentage_of_total
FROM orders
GROUP BY status
ORDER BY order_count DESC;"""

        # 10. Payment method breakdown
        if "payment" in q:
            return f"""SELECT
    payment_method,
    payment_status,
    COUNT(id) AS transaction_count,
    ROUND(SUM(amount){numeric_cast}, 2) AS total_amount
FROM payments
GROUP BY payment_method, payment_status
ORDER BY total_amount DESC;"""

        # 11. Website events / funnel
        if "event" in q or "funnel" in q or "website" in q:
            return """SELECT
    event_type,
    COUNT(id) AS event_count,
    COUNT(DISTINCT customer_id) AS unique_visitors
FROM website_events
GROUP BY event_type
ORDER BY event_count DESC;"""

        # Default fallback: safe high-level overview
        return f"""SELECT
    c.customer_segment,
    COUNT(DISTINCT c.id) AS customers,
    COUNT(o.id) AS orders_count,
    ROUND(COALESCE(SUM(o.total_amount), 0){numeric_cast}, 2) AS total_revenue
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id AND o.status = 'COMPLETED'
GROUP BY c.customer_segment
ORDER BY total_revenue DESC;"""

    def explain_result(
        self,
        question: str,
        sql: str,
        columns: list[str],
        rows: list[list[Any]],
        row_count: int,
    ) -> str:
        if row_count == 0:
            return f"**No records matched the criteria** for query: *'{question}'*. This might indicate no transactions met the date range or status filters."

        # Generate insightful summary based on columns present
        col_lower = [c.lower() for c in columns]
        summary_points = []

        if "total_revenue" in col_lower or "monthly_revenue" in col_lower:
            rev_idx = col_lower.index("total_revenue") if "total_revenue" in col_lower else col_lower.index("monthly_revenue")
            first_val = rows[0][rev_idx] if rows and len(rows[0]) > rev_idx else "N/A"
            summary_points.append(f"Top record revenue is **${first_val}** across the selected dataset.")

        if "customer_name" in col_lower:
            name_idx = col_lower.index("customer_name")
            top_name = rows[0][name_idx] if rows else "Top Customer"
            summary_points.append(f"Leading customer identified as **{top_name}**.")

        if "product_name" in col_lower:
            prod_idx = col_lower.index("product_name")
            top_prod = rows[0][prod_idx] if rows else "Top Product"
            summary_points.append(f"Leading performer is **{top_prod}**.")

        if "mom_growth_pct" in col_lower:
            summary_points.append("Includes month-over-month percentage changes to highlight growth trajectory.")

        highlights = " ".join(summary_points) if summary_points else "Query returned structured business performance metrics."

        return (
            f"### Business Summary\n\n"
            f"Successfully analyzed **{row_count} rows** in response to: *\"{question}\"*.\n\n"
            f"{highlights}\n\n"
            f"- **Dataset Scope**: Query was executed with read-only transaction isolation.\n"
            f"- **Actionable Insight**: Prioritize high-performing segments and investigate low-conversion cohorts to maximize net margins."
        )
