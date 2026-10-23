# REST API Specification

The **AI Database Assistant** exposes a RESTful API powered by Django REST Framework with uniform JSON envelopes and standardized error handling.

---

## 1. Uniform Response Envelopes

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional informative status message."
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "UNSAFE_QUERY",
    "message": "The query contains a prohibited operation: 'DROP'.",
    "details": { ... }
  }
}
```

---

## 2. API Endpoints Catalog

### 2.1. Authentication (`/api/auth/`)
- `POST /api/auth/register/` - Create a new user account.
- `POST /api/auth/login/` - Authenticate with email/password to receive JWT access and refresh tokens.
- `POST /api/auth/token/refresh/` - Refresh expired access token.
- `GET /api/auth/me/` - Retrieve authenticated user profile (Bearer token required).

### 2.2. Natural Language Query & Execution (`/api/query/`)
- `POST /api/query/` - Main AI query orchestration pipeline.
  - **Request Body**:
    ```json
    {
      "question": "Show the top 10 customers by revenue.",
      "dry_run": false
    }
    ```
  - **Response**:
    ```json
    {
      "success": true,
      "data": {
        "question": "Show the top 10 customers by revenue.",
        "sql": "SELECT c.id, c.name, ROUND(SUM(o.total_amount)::numeric, 2) AS total_revenue FROM customers c ... LIMIT 10;",
        "columns": ["customer_id", "customer_name", "total_revenue"],
        "rows": [[1, "Acme Corp", 84500.00]],
        "row_count": 10,
        "execution_time_ms": 14.25,
        "explanation": "### Business Summary\n\nTop record revenue is **$84,500.00** across the selected dataset...",
        "tables_used": ["customers", "orders"],
        "query_history_id": 42
      }
    }
    ```

- `POST /api/query/execute-direct/` - Directly execute SQL through AST security validator.
- `GET /api/query/status/` - Retrieve active AI provider, model, and execution boundaries.
- `GET /api/query/history/` - List past queries with filtering by status.
- `POST /api/query/history/{id}/rerun/` - Re-execute a previously logged query.

### 2.3. Schema Explorer (`/api/schema/`)
- `GET /api/schema/` - Returns complete table metadata, column definitions, data types, and ER diagram relationships.

### 2.4. Dashboard & Analytics (`/api/dashboard/` & `/api/analytics/`)
- `GET /api/dashboard/` - Real-time KPI summary, monthly revenue trend, order status distribution, and top tables.
- `GET /api/analytics/revenue/` - Monthly sales aggregations with average order values.
- `GET /api/analytics/customers/` - Customer tier and cohort spend distribution.
- `GET /api/analytics/products/` - Category-level revenue, inventory counts, and units sold.

### 2.5. Business Entity ViewSets
- `GET /api/customers/` - Paginated customer directory with search and segment filters.
- `GET /api/products/` - Paginated product catalog with category filters and profit margin.
- `GET /api/orders/` - Paginated order transactions with customer details and line items.

