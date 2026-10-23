"""Security tests for SQL Validator pipeline."""

import pytest

from apps.ai_assistant.sql_validator import SQLValidator


class TestSQLValidatorSecurity:
    def setup_method(self):
        self.validator = SQLValidator(max_rows=1000, max_sql_length=5000)

    # 1. Test Valid Safe Queries
    def test_valid_select_query(self):
        sql = "SELECT id, name, country FROM customers WHERE customer_segment = 'ENTERPRISE' LIMIT 10;"
        result = self.validator.validate(sql)
        assert result.is_valid is True
        assert "LIMIT 10" in result.sanitized_sql
        assert "customers" in [t.lower() for t in result.tables_used]

    def test_valid_cte_query(self):
        sql = """
        WITH HighSpenders AS (
            SELECT customer_id, SUM(total_amount) AS rev
            FROM orders
            GROUP BY customer_id
        )
        SELECT * FROM HighSpenders WHERE rev > 1000 LIMIT 20;
        """
        result = self.validator.validate(sql)
        assert result.is_valid is True
        assert "orders" in [t.lower() for t in result.tables_used]

    def test_valid_join_query(self):
        sql = """
        SELECT c.name, SUM(o.total_amount)
        FROM customers c
        INNER JOIN orders o ON c.id = o.customer_id
        GROUP BY c.name
        ORDER BY SUM(o.total_amount) DESC;
        """
        result = self.validator.validate(sql)
        assert result.is_valid is True
        # Verify limit is automatically injected if missing
        assert "LIMIT 1000" in result.sanitized_sql

    def test_limit_clamping(self):
        sql = "SELECT * FROM customers LIMIT 50000;"
        result = self.validator.validate(sql)
        assert result.is_valid is True
        assert "LIMIT 1000" in result.sanitized_sql
        assert "50000" not in result.sanitized_sql

    # 2. Test Forbidden DDL and DML operations
    @pytest.mark.parametrize(
        "dangerous_op",
        [
            "DROP TABLE customers;",
            "DROP TABLE orders CASCADE;",
            "DELETE FROM customers;",
            "DELETE FROM orders WHERE id = 1;",
            "UPDATE customers SET name = 'Hacked';",
            "INSERT INTO customers (name, email) VALUES ('evil', 'evil@hacker.com');",
            "ALTER TABLE customers ADD COLUMN password_hash varchar;",
            "TRUNCATE TABLE payments;",
            "CREATE TABLE backdoor (id int);",
            "GRANT ALL PRIVILEGES ON DATABASE aidb TO public;",
            "REVOKE SELECT ON customers FROM app_user;",
            "MERGE INTO customers USING orders ON customers.id = orders.customer_id WHEN MATCHED THEN DELETE;",
            "CALL dangerous_stored_procedure();",
            "COPY customers TO '/tmp/leak.csv';",
            "VACUUM FULL;",
            "REINDEX DATABASE aidb;",
            "LOCK TABLE orders IN EXCLUSIVE MODE;",
            "SET statement_timeout = 0;",
            "SHOW config;",
            "EXEC xp_cmdshell 'whoami';",
        ],
    )
    def test_reject_dangerous_operations(self, dangerous_op):
        result = self.validator.validate(dangerous_op)
        assert result.is_valid is False
        assert result.error_code in ("FORBIDDEN_OPERATION", "UNSAFE_QUERY")

    # 3. Test SQL Injection & Semicolon Chaining
    def test_reject_multiple_statements_chained(self):
        sql = "SELECT * FROM customers; DROP TABLE orders;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "MULTIPLE_STATEMENTS"

    def test_reject_stacked_statement_injection(self):
        sql = "SELECT id FROM products WHERE id = 1; DELETE FROM customers;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "MULTIPLE_STATEMENTS"

    # 4. Test Internal PG Functions & Catalog
    def test_reject_pg_sleep(self):
        sql = "SELECT id, pg_sleep(10) FROM customers;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "SUSPICIOUS_FUNCTION_CALL"

    def test_reject_pg_catalog_access(self):
        sql = "SELECT * FROM pg_catalog.pg_tables;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "SUSPICIOUS_FUNCTION_CALL"

    # 5. Test Unauthorized Tables
    def test_reject_unauthorized_table(self):
        sql = "SELECT * FROM django_migrations;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "UNAUTHORIZED_TABLE"

    def test_reject_auth_permission_table(self):
        sql = "SELECT * FROM auth_permission;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "UNAUTHORIZED_TABLE"

    # 6. Test Empty or Excessively Long Query
    def test_reject_empty_query(self):
        result = self.validator.validate("")
        assert result.is_valid is False
        assert result.error_code == "EMPTY_QUERY"

    def test_reject_excessive_length(self):
        long_sql = "SELECT * FROM customers WHERE " + "id = 1 OR " * 1500 + "id = 2"
        result = self.validator.validate(long_sql)
        assert result.is_valid is False
        assert result.error_code == "EXCESSIVE_LENGTH"

    # 7. Regression Tests: Sensitive Column & Credential Protection
    def test_reject_sensitive_password_column(self):
        sql = "SELECT id, email, password FROM users;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "SENSITIVE_COLUMN_PROHIBITED"

    def test_reject_sensitive_password_hash_column(self):
        sql = "SELECT id, password_hash FROM users;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "SENSITIVE_COLUMN_PROHIBITED"

    def test_reject_wildcard_on_users_table(self):
        sql = "SELECT * FROM users;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "SENSITIVE_COLUMN_PROHIBITED"

    def test_reject_aliased_wildcard_on_users_table(self):
        sql = "SELECT u.* FROM users u;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "SENSITIVE_COLUMN_PROHIBITED"

    def test_allow_safe_columns_on_users_table(self):
        sql = "SELECT id, name, email, created_at FROM users;"
        result = self.validator.validate(sql)
        assert result.is_valid is True
        assert "users" in result.tables_used

    # 8. Regression Tests: Dangerous Postgres Functions
    def test_reject_pg_read_file(self):
        sql = "SELECT pg_read_file('/etc/passwd');"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "SUSPICIOUS_FUNCTION_CALL"

    def test_reject_pg_ls_dir(self):
        sql = "SELECT pg_ls_dir('.');"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "SUSPICIOUS_FUNCTION_CALL"

    def test_reject_query_to_xml(self):
        sql = "SELECT query_to_xml('SELECT * FROM users', true, false, '');"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "SUSPICIOUS_FUNCTION_CALL"

    def test_reject_lo_export(self):
        sql = "SELECT lo_export(1, '/tmp/evil.bin');"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "SUSPICIOUS_FUNCTION_CALL"

    def test_reject_dblink(self):
        sql = "SELECT * FROM dblink('host=evil.com', 'SELECT 1') AS t(i int);"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "SUSPICIOUS_FUNCTION_CALL"

    # 9. Regression Tests: DoS & Advanced Syntax Manipulation
    def test_reject_recursive_cte(self):
        sql = "WITH RECURSIVE t(n) AS (VALUES (1) UNION ALL SELECT n+1 FROM t WHERE n < 100) SELECT * FROM t;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "FORBIDDEN_OPERATION"

    def test_reject_select_into(self):
        sql = "SELECT id, name INTO customers_backup FROM customers;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "UNSAFE_QUERY"

    def test_reject_row_locking_for_share(self):
        sql = "SELECT * FROM orders FOR SHARE;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "UNSAFE_QUERY"

    def test_reject_null_byte_injection(self):
        sql = "SELECT id FROM customers\x00 WHERE id = 1;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "NULL_BYTE_DETECTED"

    # 10. Schema qualification tests
    def test_allow_public_schema_qualification(self):
        sql = "SELECT id, name FROM public.customers;"
        result = self.validator.validate(sql)
        assert result.is_valid is True
        assert "customers" in result.tables_used

    def test_reject_unauthorized_schema_qualification(self):
        sql = "SELECT * FROM secret_schema.customers;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "UNAUTHORIZED_SCHEMA"

    # 11. Adversarial Evasion & Advanced Function Rejection
    def test_reject_pg_sleep_variants(self):
        for variant in ["SELECT pg_sleep_for('5 seconds');", "SELECT pg_sleep_until('2026-12-31');"]:
            result = self.validator.validate(variant)
            assert result.is_valid is False
            assert result.error_code == "SUSPICIOUS_FUNCTION_CALL"

    def test_reject_sequence_manipulation_functions(self):
        for seq_fn in ["SELECT nextval('some_seq');", "SELECT setval('some_seq', 100);"]:
            result = self.validator.validate(seq_fn)
            assert result.is_valid is False
            assert result.error_code == "SUSPICIOUS_FUNCTION_CALL"

    def test_reject_wildcard_join_on_users(self):
        sql = "SELECT * FROM orders JOIN users ON orders.customer_id = users.id;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "SENSITIVE_COLUMN_PROHIBITED"

    def test_reject_comma_join_wildcard_on_users(self):
        sql = "SELECT * FROM customers, users;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "SENSITIVE_COLUMN_PROHIBITED"

    def test_reject_qualified_wildcard_on_users_in_join(self):
        sql = "SELECT users.* FROM orders, users;"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "SENSITIVE_COLUMN_PROHIBITED"

    def test_reject_quoted_users_wildcard(self):
        sql = 'SELECT * FROM "users";'
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "SENSITIVE_COLUMN_PROHIBITED"

    def test_reject_diagnostic_admin_functions(self):
        sql = "SELECT pg_export_snapshot();"
        result = self.validator.validate(sql)
        assert result.is_valid is False
        assert result.error_code == "SUSPICIOUS_FUNCTION_CALL"
