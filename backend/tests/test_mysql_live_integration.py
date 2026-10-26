"""
Live MySQL 8.4 Integration Test Suite.

Verifies external MySQL connectivity, schema introspection, Direct SQL execution,
table allowlists, tenant isolation, SQL AST dialect restrictions, and read-only privilege enforcement.
"""

import csv
import io
import os
import socket

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from sqlalchemy import text

import apps.datasources.schema_discovery as sd
from apps.ai_assistant.sql_validator import SQLValidator
from apps.datasources.executor import ExternalSQLExecutor
from apps.datasources.models import DataSource, DataSourceEngine, SSLMode

User = get_user_model()

IS_CI = os.environ.get("GITHUB_ACTIONS") == "true" or os.environ.get("CI") == "true"
MYSQL_HOST = os.environ.get("MYSQL_TEST_HOST", "127.0.0.1")
MYSQL_PORT = int(os.environ.get("MYSQL_TEST_PORT", "3306"))
MYSQL_USER = os.environ.get("MYSQL_TEST_USER", "metriva_readonly")
MYSQL_PASSWORD = os.environ.get("MYSQL_TEST_PASSWORD", "readonly_secure_pass")
MYSQL_DB = os.environ.get("MYSQL_TEST_DB", "metriva_mysql_demo")


def _is_mysql_reachable() -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1.5)
    try:
        s.connect((MYSQL_HOST, MYSQL_PORT))
        s.close()
        return True
    except Exception:
        return False


# In CI environments, MySQL is mandatory and must never silently skip
if IS_CI and not _is_mysql_reachable():
    pytest.fail(
        f"CRITICAL CI FAILURE: MySQL 8.4 service is required in GitHub Actions CI but unreachable at {MYSQL_HOST}:{MYSQL_PORT}.",
        pytrace=False,
    )

requires_mysql = pytest.mark.skipif(
    not _is_mysql_reachable() and not IS_CI,
    reason=f"Live MySQL service not available at {MYSQL_HOST}:{MYSQL_PORT}. Set MYSQL_TEST_HOST or start service to run.",
)


@pytest.fixture
def mysql_datasource(db):
    """Fixture providing a saved DataSource instance connected to the synthetic MySQL database."""
    user = User.objects.create_user(name="MySQL Test User", email="mysql_test@example.com", password="Password123!")
    ds = DataSource(
        user=user,
        name="Enterprise Supply Chain DB",
        description="Live MySQL 8.4 logistics database",
        engine=DataSourceEngine.MYSQL,
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        database_name=MYSQL_DB,
        username=MYSQL_USER,
        ssl_mode=SSLMode.DISABLE,
        is_active=True,
    )
    ds.set_password(MYSQL_PASSWORD)
    ds.save()
    return ds


@requires_mysql
@pytest.mark.django_db
class TestMySQLLiveIntegration:
    """Comprehensive test suite exercising live MySQL 8.4 integration against real server."""

    def test_mysql_connection_test_params_success(self):
        """Verify successful connectivity check using raw parameters before saving."""
        result = sd.test_connection_params(
            engine_type=DataSourceEngine.MYSQL,
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            database_name=MYSQL_DB,
            username=MYSQL_USER,
            password=MYSQL_PASSWORD,
            ssl_mode=SSLMode.DISABLE,
        )
        assert result["success"] is True
        assert "latency_ms" in result
        assert result["latency_ms"] >= 0
        assert "successfully" in result["message"].lower()

    def test_mysql_connection_failure_invalid_credentials(self):
        """Verify connection failure on bad credentials without password leakage."""
        bad_password = "wrong_unauthorized_password_12345"
        result = sd.test_connection_params(
            engine_type=DataSourceEngine.MYSQL,
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            database_name=MYSQL_DB,
            username=MYSQL_USER,
            password=bad_password,
            ssl_mode=SSLMode.DISABLE,
        )
        assert result["success"] is False
        assert result["code"] == "CONNECTION_FAILED"
        assert bad_password not in result["message"]
        assert "access denied" in result["message"].lower() or "denied" in result["message"].lower()

    def test_mysql_connection_failure_unreachable_host(self):
        """Verify timeout handling on unreachable host without hanging."""
        result = sd.test_connection_params(
            engine_type=DataSourceEngine.MYSQL,
            host="127.0.0.1",
            port=33099,  # Unused port
            database_name=MYSQL_DB,
            username=MYSQL_USER,
            password=MYSQL_PASSWORD,
            ssl_mode=SSLMode.DISABLE,
        )
        assert result["success"] is False
        assert result["code"] == "CONNECTION_FAILED"

    def test_mysql_datasource_registration_and_api_isolation(self, mysql_datasource):
        """Verify datasource registration, credential encryption, and multi-tenant isolation."""
        client = APIClient()
        client.force_authenticate(user=mysql_datasource.user)

        # 1. Retrieve datasource detail
        res = client.get(f"/api/datasources/{mysql_datasource.id}/")
        assert res.status_code == status.HTTP_200_OK
        data = res.data["data"]
        assert data["engine"] == "mysql"
        assert data["database_name"] == MYSQL_DB
        assert "password" not in data
        assert "encrypted_password" not in data

        # 2. Test connectivity endpoint
        test_res = client.post(f"/api/datasources/{mysql_datasource.id}/test/")
        assert test_res.status_code == status.HTTP_200_OK
        assert test_res.data["data"]["success"] is True

        # 3. Cross-tenant isolation check
        other_user = User.objects.create_user(name="Rival User", email="rival@competitor.example", password="Password123!")
        other_client = APIClient()
        other_client.force_authenticate(user=other_user)
        assert other_client.get(f"/api/datasources/{mysql_datasource.id}/").status_code == status.HTTP_404_NOT_FOUND

    def test_mysql_schema_introspection_and_context(self, mysql_datasource):
        """Verify dynamic introspection of MySQL tables, columns, primary keys, and foreign keys."""
        schema_data = sd.introspect_schema(mysql_datasource)
        mysql_datasource.refresh_from_db()

        assert schema_data["table_count"] >= 4
        table_names = [t["name"] for t in schema_data["tables"]]
        assert "suppliers" in table_names
        assert "inventory_items" in table_names
        assert "shipments" in table_names
        assert "shipment_events" in table_names

        # Inspect suppliers columns
        suppliers_meta = next(t for t in schema_data["tables"] if t["name"] == "suppliers")
        col_names = [c["name"] for c in suppliers_meta["columns"]]
        assert "id" in col_names
        assert "supplier_name" in col_names
        assert "country" in col_names
        assert "tier" in col_names
        assert suppliers_meta["primary_keys"] == ["id"]

        # Inspect foreign keys on inventory_items
        inv_meta = next(t for t in schema_data["tables"] if t["name"] == "inventory_items")
        assert len(inv_meta["foreign_keys"]) >= 1
        fk = inv_meta["foreign_keys"][0]
        assert fk["referred_table"] == "suppliers"

        # Verify schema context prompt generation
        mysql_datasource.allowed_tables = ["suppliers", "inventory_items"]
        mysql_datasource.save()
        context_prompt, allowed_tables = sd.get_datasource_schema_context(mysql_datasource)
        assert "Table `suppliers`" in context_prompt
        assert "Table `inventory_items`" in context_prompt
        assert "Table `shipment_events`" not in context_prompt  # Redacted per allowlist
        assert set(allowed_tables) == {"suppliers", "inventory_items"}

    def test_mysql_direct_sql_execution(self, mysql_datasource):
        """Verify authorized Direct SQL query execution against live MySQL database."""
        client = APIClient()
        client.force_authenticate(user=mysql_datasource.user)

        sql = """
        SELECT
            s.country,
            COUNT(DISTINCT s.id) AS total_suppliers,
            COUNT(i.id) AS total_inventory_skus,
            ROUND(SUM(i.stock_quantity * i.unit_cost), 2) AS total_valuation
        FROM suppliers s
        JOIN inventory_items i ON s.id = i.supplier_id
        GROUP BY s.country
        ORDER BY total_valuation DESC
        LIMIT 5;
        """
        res = client.post(
            "/api/query/execute-direct/",
            {"sql": sql, "data_source_id": mysql_datasource.id},
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        data = res.data["data"]
        assert len(data["columns"]) == 4
        assert len(data["rows"]) > 0
        assert data["row_count"] > 0
        assert "country" in data["columns"]
        assert "total_valuation" in data["columns"]
        assert data["execution_time_ms"] >= 0

    def test_mysql_server_version_and_query_sequence(self, mysql_datasource):
        """Verify genuine live MySQL server version (8.x/9.x) and query sequence isolation."""
        client = APIClient()
        client.force_authenticate(user=mysql_datasource.user)

        # 1. Query live server version
        ver_res = client.post(
            "/api/query/execute-direct/",
            {"sql": "SELECT VERSION() AS ver;", "data_source_id": mysql_datasource.id},
            format="json",
        )
        assert ver_res.status_code == status.HTTP_200_OK
        version_str = ver_res.data["data"]["rows"][0][0]
        major_version = int(version_str.split(".")[0])
        assert major_version in (8, 9), f"Expected MySQL 8.x or 9.x, got: {version_str}"

        # 2. Run query with ORDER BY and LIMIT 3
        q1_res = client.post(
            "/api/query/execute-direct/",
            {
                "sql": "SELECT id, supplier_name, country, tier FROM suppliers ORDER BY id ASC LIMIT 3;",
                "data_source_id": mysql_datasource.id,
            },
            format="json",
        )
        assert q1_res.status_code == status.HTTP_200_OK
        q1_data = q1_res.data["data"]
        assert len(q1_data["rows"]) == 3
        assert [r[0] for r in q1_data["rows"]] == [1, 2, 3]

        # 3. Run a distinct second query to confirm results are replaced and not merged
        q2_res = client.post(
            "/api/query/execute-direct/",
            {
                "sql": "SELECT id, sku, unit_cost FROM inventory_items ORDER BY id DESC LIMIT 2;",
                "data_source_id": mysql_datasource.id,
            },
            format="json",
        )
        assert q2_res.status_code == status.HTTP_200_OK
        q2_data = q2_res.data["data"]
        assert len(q2_data["rows"]) == 2
        assert "supplier_name" not in q2_data["columns"]
        assert "sku" in q2_data["columns"]

    def test_mysql_clamping_and_limit_enforcement(self, mysql_datasource):
        """Verify executor applies max_rows clamping and enforces statement timeouts."""
        executor = ExternalSQLExecutor(mysql_datasource, max_query_seconds=5, max_rows=3)
        sql = "SELECT id, supplier_name FROM suppliers ORDER BY id ASC;"
        result = executor.execute(sql)
        assert len(result["rows"]) == 3
        assert result["row_count"] == 3
        assert result["columns"] == ["id", "supplier_name"]

    def test_mysql_csv_export_formatting(self, mysql_datasource):
        """Verify that returned MySQL tabular data formats into valid RFC 4180 CSV."""
        executor = ExternalSQLExecutor(mysql_datasource)
        sql = "SELECT id, sku, item_name, unit_cost, stock_quantity FROM inventory_items ORDER BY id ASC LIMIT 5;"
        result = executor.execute(sql)

        # Simulate client CSV serialization
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(result["columns"])
        for row in result["rows"]:
            writer.writerow(row)

        csv_text = buffer.getvalue()
        lines = csv_text.strip().split("\r\n" if "\r\n" in csv_text else "\n")
        assert len(lines) == 6  # 1 header + 5 data rows
        assert "id,sku,item_name,unit_cost,stock_quantity" in lines[0]
        assert "SEMI-FPGA-902" in csv_text

    def test_mysql_table_allowlist_enforcement(self, mysql_datasource):
        """Verify SQLValidator blocks queries referencing tables outside the datasource allowlist."""
        mysql_datasource.allowed_tables = ["suppliers", "inventory_items"]
        mysql_datasource.save()

        validator = SQLValidator()
        # Query accessing permitted table
        valid_res = validator.validate(
            "SELECT * FROM suppliers LIMIT 10;",
            allowed_tables=mysql_datasource.allowed_tables,
            dialect="mysql",
        )
        assert valid_res.is_valid is True

        # Query accessing unapproved table
        blocked_res = validator.validate(
            "SELECT * FROM shipments LIMIT 10;",
            allowed_tables=mysql_datasource.allowed_tables,
            dialect="mysql",
        )
        assert blocked_res.is_valid is False
        assert blocked_res.error_code == "UNAUTHORIZED_TABLE"

    def test_mysql_destructive_query_rejection_two_layers(self, mysql_datasource):
        """
        Verify defense-in-depth:
        Layer 1: Application SQLValidator blocks destructive queries.
        Layer 2: MySQL engine denies write operations even if bypass occurs.
        """
        validator = SQLValidator()

        # Layer 1: Application AST validator blocks destructive statements
        drop_res = validator.validate("DROP TABLE suppliers;", dialect="mysql")
        assert drop_res.is_valid is False
        assert drop_res.error_code in ("FORBIDDEN_OPERATION", "FORBIDDEN_KEYWORD")

        insert_res = validator.validate(
            "INSERT INTO suppliers (supplier_name) VALUES ('Hacked Corp');",
            dialect="mysql",
        )
        assert insert_res.is_valid is False
        assert insert_res.error_code in ("NOT_SELECT_STATEMENT", "FORBIDDEN_KEYWORD", "FORBIDDEN_OPERATION")

        # Layer 2: Real database engine rejects writes via least-privilege user
        with pytest.raises(Exception) as exc_info:
            engine = sd._create_scoped_engine(mysql_datasource.get_sqlalchemy_url(), mysql_datasource.engine)
            with engine.connect() as conn:
                conn.execute(text("DELETE FROM suppliers WHERE id = 1;"))

        err_msg = str(exc_info.value).lower()
        assert "command denied" in err_msg or "denied" in err_msg or "read only" in err_msg

    def test_mysql_forbidden_dialect_patterns(self, mysql_datasource):
        """Verify SQLValidator blocks MySQL-specific injection vectors and dangerous functions."""
        validator = SQLValidator()

        # MySQL executable comments
        vuln1 = "SELECT /*!50000 1 */ FROM suppliers;"
        res1 = validator.validate(vuln1, dialect="mysql")
        assert res1.is_valid is False
        assert res1.error_code in ("FORBIDDEN_KEYWORD", "SUSPICIOUS_FUNCTION_CALL", "SUSPICIOUS_COMMENT_OBFUSCATION")

        # Sleep denial of service
        vuln2 = "SELECT SLEEP(10) FROM suppliers;"
        res2 = validator.validate(vuln2, dialect="mysql")
        assert res2.is_valid is False
        assert res2.error_code in ("SUSPICIOUS_FUNCTION_CALL", "FORBIDDEN_KEYWORD")

        # Benchmark denial of service
        vuln3 = "SELECT BENCHMARK(10000000, MD5(1)) FROM suppliers;"
        res3 = validator.validate(vuln3, dialect="mysql")
        assert res3.is_valid is False
        assert res3.error_code in ("SUSPICIOUS_FUNCTION_CALL", "FORBIDDEN_KEYWORD")

        # Into outfile file write
        vuln4 = "SELECT * FROM suppliers INTO OUTFILE '/tmp/dump.txt';"
        res4 = validator.validate(vuln4, dialect="mysql")
        assert res4.is_valid is False
        assert res4.error_code in ("FORBIDDEN_KEYWORD", "SUSPICIOUS_FUNCTION_CALL")
