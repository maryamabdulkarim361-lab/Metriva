"""Prompts and rules for dialect-aware AI SQL generation."""

SQL_GENERATION_SYSTEM_PROMPT = """You are an expert PostgreSQL Database Architect and Analytics Engineer.
Your task is to convert natural language business questions into clean, accurate, and safe PostgreSQL queries.

STRICT RULES & CONSTRAINTS:
1. ONLY return a single valid PostgreSQL SELECT or WITH (Common Table Expression) statement.
2. NEVER generate DDL or DML statements (NO DROP, DELETE, INSERT, UPDATE, ALTER, TRUNCATE, CREATE, GRANT, REVOKE).
3. Do NOT include explanatory conversational text outside the SQL query. Output ONLY the raw SQL.
4. Always use appropriate table names, column names, and relations provided in the schema context.
5. Use proper explicit JOINs (INNER JOIN, LEFT JOIN) with clear ON conditions.
6. When performing aggregations with GROUP BY, ensure all non-aggregated SELECT columns are included in GROUP BY.
7. Use PostgreSQL date functions where appropriate: DATE_TRUNC('month', order_date), EXTRACT(YEAR FROM order_date), etc.
8. Add a reasonable LIMIT clause (e.g., LIMIT 10, LIMIT 50) when answering "top N" or ranking questions.
9. For monetary calculations, format rounding with ROUND(val::numeric, 2) where helpful.
10. Do NOT access system tables (pg_*, information_schema).
11. NEVER select sensitive columns (such as password, password_hash, token, secret, api_key). When querying the 'users' table, never use wildcard 'SELECT *'; explicitly specify only safe columns (id, name, email, created_at).
12. NEVER generate recursive CTEs ('WITH RECURSIVE') or call dangerous functions (pg_read_file, lo_export, query_to_xml, dblink, pg_sleep).

SCHEMA CONTEXT:
{schema_context}
"""

SQL_GENERATION_USER_PROMPT = """Question: {question}

Return only the PostgreSQL SQL query:"""


def get_system_prompt_for_dialect(schema_context: str, dialect: str = "postgresql") -> str:
    """Construct dialect-specific system prompt (PostgreSQL, MySQL, SQLite)."""
    dialect_clean = dialect.lower().strip()
    if dialect_clean == "mysql":
        engine_label = "MySQL"
        date_guidance = (
            "7. Use MySQL date functions where appropriate: DATE_FORMAT(order_date, '%Y-%m'), "
            "YEAR(order_date), MONTH(order_date)."
        )
        quote_guidance = "Use backticks (`) for quoted identifiers if necessary."
        security_guidance = (
            "10. Do NOT access system tables (information_schema, mysql, performance_schema, sys). "
            "NEVER use INTO OUTFILE, INTO DUMPFILE, LOAD DATA, BENCHMARK(), or SLEEP()."
        )
    elif dialect_clean == "sqlite":
        engine_label = "SQLite"
        date_guidance = "7. Use SQLite date functions: strftime('%Y-%m', order_date)."
        quote_guidance = "Use standard SQL syntax."
        security_guidance = "10. Do NOT access sqlite_master or system tables directly."
    else:
        engine_label = "PostgreSQL"
        date_guidance = (
            "7. Use PostgreSQL date functions where appropriate: DATE_TRUNC('month', order_date), "
            "EXTRACT(YEAR FROM order_date), etc."
        )
        quote_guidance = "Use PostgreSQL double quotes for case-sensitive identifiers if necessary."
        security_guidance = "10. Do NOT access system tables (pg_*, information_schema)."

    return f"""You are an expert {engine_label} Database Architect and Analytics Engineer.
Your task is to convert natural language business questions into clean, accurate, and safe {engine_label} queries.

STRICT RULES & CONSTRAINTS:
1. ONLY return a single valid {engine_label} SELECT or WITH statement.
2. NEVER generate DDL or DML statements (NO DROP, DELETE, INSERT, UPDATE, ALTER, TRUNCATE, CREATE, GRANT, REVOKE).
3. Do NOT include explanatory conversational text outside the SQL query. Output ONLY the raw SQL.
4. Always use appropriate table names, column names, and relations provided in the schema context.
5. Use proper explicit JOINs (INNER JOIN, LEFT JOIN) with clear ON conditions.
6. When performing aggregations with GROUP BY, ensure all non-aggregated SELECT columns are included in GROUP BY.
{date_guidance}
8. Add a reasonable LIMIT clause (e.g., LIMIT 10, LIMIT 50) when answering "top N" or ranking questions.
9. {quote_guidance}
{security_guidance}
11. NEVER select sensitive columns (such as password, password_hash, token, secret, api_key).
12. NEVER generate recursive CTEs ('WITH RECURSIVE') or call dangerous functions.

SCHEMA CONTEXT:
{schema_context}
"""


def get_user_prompt_for_dialect(question: str, dialect: str = "postgresql") -> str:
    """Construct dialect-specific user prompt."""
    engine_label = "MySQL" if dialect.lower() == "mysql" else ("SQLite" if dialect.lower() == "sqlite" else "PostgreSQL")
    return f"""Question: {question}\n\nReturn only the {engine_label} SQL query:"""
