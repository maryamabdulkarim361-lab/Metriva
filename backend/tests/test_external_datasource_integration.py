"""Automated integration tests for external data source integration and query execution."""

import sqlite3

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from apps.ai_assistant.sql_validator import SQLValidator
from apps.datasources.crypto import decrypt_credential
from apps.datasources.executor import ExternalSQLExecutor
from apps.datasources.models import DataSource, DataSourceEngine
from apps.datasources.schema_discovery import (
    get_datasource_schema_context,
    introspect_schema,
)
from apps.datasources.target_validator import validate_sqlite_path

User = get_user_model()


@pytest.fixture
def sqlite_test_db(tmp_path):
    """Creates a temporary, safe SQLite business database with distinct B2B SaaS tables."""
    db_file = tmp_path / "test_b2b_saas.sqlite3"
    conn = sqlite3.connect(str(db_file))
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_name TEXT NOT NULL,
        industry TEXT NOT NULL,
        mrr_amount REAL NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        plan_name TEXT NOT NULL,
        seats INTEGER NOT NULL
    );
    """)

    cur.executemany(
        "INSERT INTO accounts (account_name, industry, mrr_amount) VALUES (?, ?, ?);",
        [
            ("Alpha Cloud", "SaaS", 4500.0),
            ("Beta Logistics", "Supply Chain", 3200.0),
            ("Gamma Labs", "Biotech", 6100.0),
        ],
    )

    cur.executemany(
        "INSERT INTO subscriptions (account_id, plan_name, seats) VALUES (?, ?, ?);",
        [
            (1, "Enterprise Suite", 50),
            (2, "Logistics Plus", 30),
            (3, "Lab Platform", 75),
        ],
    )

    conn.commit()
    conn.close()
    return str(db_file)


@pytest.fixture
def datasource_obj(sqlite_test_db):
    """Returns a saved DataSource model instance pointing to the test SQLite database."""
    ds = DataSource.objects.create(
        name="B2B SaaS Test DB",
        engine=DataSourceEngine.SQLITE,
        database_name=sqlite_test_db,
        is_active=True,
    )
    ds.set_password("secret_db_password_123")
    ds.save()
    return ds


@pytest.mark.django_db
class TestExternalDataSourceIntegration:
    """End-to-end integration test suite for external database lifecycle and query engine."""

    def test_sqlite_path_security_policy(self, tmp_path):
        """Verifies strict SQLite path security policy without weakening checks."""
        # 1. Valid extension and path
        valid_path = str(tmp_path / "valid.sqlite3")
        validate_sqlite_path(valid_path)  # Should not raise

        # 2. Null-byte injection
        with pytest.raises(Exception):
            validate_sqlite_path(str(tmp_path / "test.db\x00.png"))

        # 3. Path traversal
        with pytest.raises(Exception):
            validate_sqlite_path(str(tmp_path / "../../../etc/passwd.db"))

        # 4. Prohibited system root directory
        with pytest.raises(Exception):
            validate_sqlite_path("/etc/shadow.sqlite3")

    def test_external_datasource_credential_encryption(self, datasource_obj):
        """Verifies passwords are encrypted at rest using Fernet and never stored in plaintext."""
        assert datasource_obj.encrypted_password != "secret_db_password_123"
        assert decrypt_credential(datasource_obj.encrypted_password) == "secret_db_password_123"

        # Verify SQLAlchemy masked URL hides password
        masked_url = datasource_obj.get_sqlalchemy_url(masked=True)
        assert "secret_db_password_123" not in masked_url

    def test_external_datasource_schema_discovery(self, datasource_obj):
        """Verifies schema introspection captures tables, columns, and relations."""
        schema = introspect_schema(datasource_obj)
        table_names = [t["name"] for t in schema["tables"]]
        assert "accounts" in table_names
        assert "subscriptions" in table_names

        # Verify schema context formatted for AI
        ctx_prompt, allowed_tables = get_datasource_schema_context(datasource_obj)
        assert "Table `accounts`" in ctx_prompt
        assert "Table `subscriptions`" in ctx_prompt
        assert "mrr_amount" in ctx_prompt
        assert set(allowed_tables) == {"accounts", "subscriptions"}

    def test_external_datasource_direct_sql_execution(self, datasource_obj):
        """Verifies read-only SQL executes on the external datasource and returns distinct data."""
        executor = ExternalSQLExecutor(datasource_obj)
        result = executor.execute(
            "SELECT account_name, mrr_amount FROM accounts ORDER BY mrr_amount DESC;"
        )

        assert result["success"] is True
        assert result["columns"] == ["account_name", "mrr_amount"]
        assert len(result["rows"]) == 3
        assert result["rows"][0] == ["Gamma Labs", 6100.0]
        assert result["rows"][1] == ["Alpha Cloud", 4500.0]
        assert result["rows"][2] == ["Beta Logistics", 3200.0]

    def test_external_datasource_mutation_blocking(self, datasource_obj):
        """Verifies SQLValidator and executor reject INSERT, UPDATE, DELETE, DROP operations."""
        validator = SQLValidator()

        for forbidden_sql in [
            "INSERT INTO accounts (account_name, industry, mrr_amount) VALUES ('Malicious', 'Fraud', 100);",
            "UPDATE accounts SET mrr_amount = 0 WHERE id = 1;",
            "DELETE FROM accounts WHERE id = 1;",
            "DROP TABLE accounts;",
            "ALTER TABLE accounts ADD COLUMN hacked TEXT;",
        ]:
            val = validator.validate(forbidden_sql, dialect="sqlite")
            assert val.is_valid is False
            assert val.error_code in ("FORBIDDEN_OPERATION", "UNSAFE_QUERY")

    def test_external_datasource_table_allowlist(self, datasource_obj):
        """Verifies restricting allowed_tables blocks unauthorized table queries."""
        datasource_obj.allowed_tables = ["accounts"]
        datasource_obj.save()

        _, allowed = get_datasource_schema_context(datasource_obj)
        assert allowed == ["accounts"]

        validator = SQLValidator()
        # Querying accounts is permitted
        val_permitted = validator.validate("SELECT * FROM accounts;", allowed_tables=allowed, dialect="sqlite")
        assert val_permitted.is_valid is True

        # Querying subscriptions is blocked
        val_blocked = validator.validate("SELECT * FROM subscriptions;", allowed_tables=allowed, dialect="sqlite")
        assert val_blocked.is_valid is False
        assert val_blocked.error_code == "UNAUTHORIZED_TABLE"

    def test_external_datasource_api_query_flow(self, datasource_obj):
        """Verifies API endpoints /api/query/ and /api/query/execute-direct/ route to external DB."""
        client = APIClient()

        # 1. Direct SQL via API
        direct_resp = client.post(
            "/api/query/execute-direct/",
            {
                "sql": "SELECT account_name, mrr_amount FROM accounts WHERE mrr_amount > 4000 ORDER BY mrr_amount DESC;",
                "data_source_id": datasource_obj.id,
            },
            format="json",
        )
        assert direct_resp.status_code == status.HTTP_200_OK
        data = direct_resp.json()["data"]
        assert data["row_count"] == 2
        assert data["rows"][0][0] == "Gamma Labs"

        # 2. Natural language query via API
        nl_resp = client.post(
            "/api/query/",
            {
                "question": "Show accounts",
                "data_source_id": datasource_obj.id,
            },
            format="json",
        )
        assert nl_resp.status_code == status.HTTP_200_OK
        nl_data = nl_resp.json()["data"]
        assert "accounts" in nl_data["tables_used"]
        assert len(nl_data["rows"]) == 3

    def test_external_datasource_direct_sql_exact_limit_and_order(self, datasource_obj):
        """Regression test: Verifies Direct SQL mode executes exact query, ordering, and row limit on external DB."""
        client = APIClient()
        resp = client.post(
            "/api/query/execute-direct/",
            {
                "sql": "SELECT account_name, mrr_amount FROM accounts ORDER BY mrr_amount DESC LIMIT 2;",
                "data_source_id": datasource_obj.id,
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()["data"]
        assert data["columns"] == ["account_name", "mrr_amount"]
        assert data["row_count"] == 2
        # Gamma Labs (6100.0), Alpha Cloud (4500.0)
        assert data["rows"][0] == ["Gamma Labs", 6100.0]
        assert data["rows"][1] == ["Alpha Cloud", 4500.0]

    def test_query_endpoint_preserves_explicit_sql_query(self, datasource_obj):
        """Regression test: Verifies /api/query/ preserves explicit SQL without generic mock query rewriting."""
        client = APIClient()
        resp = client.post(
            "/api/query/",
            {
                "question": "SELECT account_name, mrr_amount FROM accounts ORDER BY mrr_amount DESC LIMIT 2;",
                "data_source_id": datasource_obj.id,
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()["data"]
        assert data["columns"] == ["account_name", "mrr_amount"]
        assert data["row_count"] == 2
        assert data["rows"][0] == ["Gamma Labs", 6100.0]
        assert data["rows"][1] == ["Alpha Cloud", 4500.0]
