"""Unit and integration tests for external data source integration, security, and dialect execution."""

import os
import sqlite3
import tempfile

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

import apps.datasources.schema_discovery as sd
from apps.ai_assistant.models import QueryHistory, QueryStatus
from apps.ai_assistant.sql_validator import SQLValidator
from apps.datasources.crypto import decrypt_credential, encrypt_credential
from apps.datasources.executor import ExternalSQLExecutor
from apps.datasources.models import DataSource, DataSourceEngine, SSLMode

User = get_user_model()


@pytest.fixture
def temp_sqlite_db():
    """Create a temporary SQLite database with a realistic test schema."""
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_external.db")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE accounts (
            id INTEGER PRIMARY KEY,
            account_name TEXT NOT NULL,
            balance REAL NOT NULL,
            created_at TEXT
        );
    """)

    cursor.execute("""
        CREATE TABLE credentials (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            password_hash TEXT NOT NULL,
            api_secret TEXT NOT NULL
        );
    """)

    cursor.execute("INSERT INTO accounts (account_name, balance, created_at) VALUES ('Acme Corp', 5400.0, '2026-01-01');")
    cursor.execute("INSERT INTO accounts (account_name, balance, created_at) VALUES ('Beta LLC', 12000.5, '2026-01-02');")
    cursor.execute("INSERT INTO credentials (user_id, password_hash, api_secret) VALUES (1, 'hash_abc_123', 'sec_xyz_789');")

    conn.commit()
    conn.close()

    yield db_path

    if os.path.exists(db_path):
        os.remove(db_path)
    if os.path.exists(temp_dir):
        os.rmdir(temp_dir)


class TestCryptoAndSecrets:
    """Test credential encryption, decryption, and key management."""

    def test_encryption_decryption_round_trip(self):
        plain_secret = "P@ssw0rd_Super_Secret!123"
        ciphertext = encrypt_credential(plain_secret)
        assert ciphertext != plain_secret
        assert not ciphertext.startswith("P@ssw0rd")

        recovered = decrypt_credential(ciphertext)
        assert recovered == plain_secret

    def test_empty_string_handling(self):
        assert encrypt_credential("") == ""
        assert decrypt_credential("") == ""

    def test_tampered_ciphertext_fails_gracefully(self):
        tampered = "gAAAAABl-fake-tampered-token-data-12345"
        # Decryption must fail safely and not leak or crash
        assert decrypt_credential(tampered) == ""

    def test_sanitize_error_message(self):
        secret = "TopSecretPassword99"
        error = f"FATAL: password authentication failed for user 'postgres' with password {secret}"
        sanitized = sd._sanitize_error_message(error, secret)
        assert secret not in sanitized
        assert "***" in sanitized


@pytest.mark.django_db
class TestDataSourceModel:
    """Test DataSource model operations and connection string formatting."""

    def test_password_storage_is_encrypted(self):
        ds = DataSource(
            name="Production Replica",
            engine=DataSourceEngine.POSTGRESQL,
            host="db.example.com",
            port=5432,
            database_name="prod_app",
            username="analyst_readonly",
        )
        ds.set_password("MySecretPass2026")
        ds.save()

        # Database column must not contain raw plaintext
        assert ds.encrypted_password != "MySecretPass2026"
        assert ds.get_password() == "MySecretPass2026"

    def test_url_construction_and_masking(self):
        ds = DataSource(
            name="MySQL Data Warehouse",
            engine=DataSourceEngine.MYSQL,
            host="mysql.warehouse.internal",
            port=3306,
            database_name="analytics_dw",
            username="bi_reader",
            ssl_mode=SSLMode.REQUIRE,
        )
        ds.set_password("SuperSecretWarehouse")

        masked_url = ds.get_sqlalchemy_url(masked=True)
        assert "SuperSecretWarehouse" not in masked_url
        assert "bi_reader:" in masked_url
        assert "mysql.warehouse.internal:3306/analytics_dw" in masked_url
        assert "mysql+pymysql://" in masked_url

        raw_url = ds.get_sqlalchemy_url(masked=False)
        assert "SuperSecretWarehouse" in raw_url


@pytest.mark.django_db
class TestSchemaDiscoveryAndContext:
    """Test schema introspection and AI prompt generation with sensitive column redaction."""

    def test_sqlite_introspection(self, temp_sqlite_db):
        ds = DataSource.objects.create(
            name="Local Test SQLite",
            engine=DataSourceEngine.SQLITE,
            database_name=temp_sqlite_db,
        )

        schema = sd.introspect_schema(ds)
        assert schema["engine"] == DataSourceEngine.SQLITE
        assert schema["table_count"] == 2

        table_names = [t["name"] for t in schema["tables"]]
        assert "accounts" in table_names
        assert "credentials" in table_names

        # Check sensitive column detection
        cred_table = next(t for t in schema["tables"] if t["name"] == "credentials")
        sensitive_cols = [c["name"] for c in cred_table["columns"] if c["is_sensitive"]]
        assert "password_hash" in sensitive_cols
        assert "api_secret" in sensitive_cols

    def test_schema_context_redaction_and_allowlist(self, temp_sqlite_db):
        ds = DataSource.objects.create(
            name="Allowlist SQLite",
            engine=DataSourceEngine.SQLITE,
            database_name=temp_sqlite_db,
            allowed_tables=["accounts"],
        )

        context_text, allowed_names = sd.get_datasource_schema_context(ds)

        # 'accounts' must be included
        assert "accounts" in allowed_names
        assert "Table `accounts`" in context_text
        assert "balance" in context_text

        # 'credentials' must be excluded by allowed_tables
        assert "credentials" not in allowed_names
        assert "Table `credentials`" not in context_text

        # Sensitive columns must never appear in LLM context
        assert "password_hash" not in context_text
        assert "api_secret" not in context_text

    def test_connection_test_params_success(self, temp_sqlite_db):
        res = sd.test_connection_params(
            engine_type=DataSourceEngine.SQLITE,
            host="",
            port=0,
            database_name=temp_sqlite_db,
        )
        assert res["success"] is True
        assert "Connection established" in res["message"]
        assert res["latency_ms"] >= 0

    def test_connection_test_params_failure_unreachable(self):
        res = sd.test_connection_params(
            engine_type=DataSourceEngine.POSTGRESQL,
            host="127.0.0.1",
            port=59999,  # Unused port
            database_name="nonexistent",
            username="nobody",
            password="fake_password_123",
        )
        assert res["success"] is False
        assert "fake_password_123" not in res["message"]


class TestDialectSQLValidator:
    """Test dialect-aware SQL validation rules."""

    def test_validator_with_custom_allowed_tables(self):
        validator = SQLValidator()
        query = "SELECT account_name, balance FROM accounts WHERE balance > 1000;"

        # Should pass when accounts is in allowed_tables
        res = validator.validate(query, allowed_tables=["accounts"], dialect="sqlite")
        assert res.is_valid is True
        assert "accounts" in res.tables_used

        # Should fail when accounts is not in allowed_tables
        res_blocked = validator.validate(query, allowed_tables=["users", "orders"], dialect="sqlite")
        assert res_blocked.is_valid is False
        assert res_blocked.error_code == "UNAUTHORIZED_TABLE"

    def test_validator_blocks_mysql_dangerous_patterns(self):
        validator = SQLValidator()

        # Benchmark DoS attack
        res_bench = validator.validate(
            "SELECT BENCHMARK(10000000, MD5('abc')) FROM accounts;",
            allowed_tables=["accounts"],
            dialect="mysql",
        )
        assert res_bench.is_valid is False
        assert res_bench.error_code == "SUSPICIOUS_FUNCTION_CALL"

        # Sleep attack
        res_sleep = validator.validate(
            "SELECT SLEEP(5) FROM accounts;",
            allowed_tables=["accounts"],
            dialect="mysql",
        )
        assert res_sleep.is_valid is False

    def test_validator_blocks_sqlite_pragma(self):
        validator = SQLValidator()
        res = validator.validate(
            "PRAGMA table_info(accounts);",
            allowed_tables=["accounts"],
            dialect="sqlite",
        )
        assert res.is_valid is False


@pytest.mark.django_db
class TestExternalExecutionAndAudit:
    """Test ExternalSQLExecutor read-only execution, results, and QueryHistory creation."""

    def test_execute_external_query(self, temp_sqlite_db):
        ds = DataSource.objects.create(
            name="Executable SQLite",
            engine=DataSourceEngine.SQLITE,
            database_name=temp_sqlite_db,
        )

        executor = ExternalSQLExecutor(ds)
        sql = "SELECT account_name, balance FROM accounts ORDER BY balance DESC LIMIT 10;"
        res = executor.execute(sql=sql, question="What are the account balances?")

        assert res["success"] is True
        assert res["columns"] == ["account_name", "balance"]
        assert len(res["rows"]) == 2
        assert res["rows"][0][0] == "Beta LLC"
        assert res["rows"][0][1] == 12000.5

        # QueryHistory must be created
        qh = QueryHistory.objects.get(id=res["query_history_id"])
        assert qh.execution_status == QueryStatus.SUCCESS
        assert qh.row_count == 2


@pytest.mark.django_db
class TestDataSourceAPIEndpoints:
    """Test REST API endpoints for DataSource CRUD and multi-tenant isolation."""

    def setup_method(self):
        self.client = APIClient()
        self.user_a = User.objects.create_user(email="a@example.com", name="User A", password="password123")
        self.user_b = User.objects.create_user(email="b@example.com", name="User B", password="password123")

    def test_tenant_isolation(self):
        # User A creates a data source
        ds_a = DataSource.objects.create(
            name="Source A",
            engine=DataSourceEngine.POSTGRESQL,
            host="localhost",
            port=5432,
            database_name="db_a",
            user=self.user_a,
        )

        # User B cannot see User A's data source
        self.client.force_authenticate(user=self.user_b)
        res = self.client.get("/api/datasources/")
        assert res.status_code == 200
        ids = [item["id"] for item in res.data["data"]]
        assert ds_a.id not in ids

        # User B cannot retrieve User A's data source
        res_detail = self.client.get(f"/api/datasources/{ds_a.id}/")
        assert res_detail.status_code == 404

        # User A can see their own data source
        self.client.force_authenticate(user=self.user_a)
        res_a = self.client.get("/api/datasources/")
        assert res_a.status_code == 200
        ids_a = [item["id"] for item in res_a.data["data"]]
        assert ds_a.id in ids_a

    def test_credentials_never_exposed_in_api(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.post("/api/datasources/", {
            "name": "Secure Source",
            "engine": "postgresql",
            "host": "postgres.internal",
            "port": 5432,
            "database_name": "secdb",
            "username": "superadmin",
            "password": "ClearTextPasswordNotForPublicEye",
        }, format="json")

        assert res.status_code == 201
        data = res.data["data"]

        # Password must not appear in response
        assert "password" not in data
        assert "encrypted_password" not in data
        assert data["username"] == "superadmin"

        # Check detail GET as well
        ds_id = data["id"]
        res_get = self.client.get(f"/api/datasources/{ds_id}/")
        assert "password" not in res_get.data["data"]
        assert "encrypted_password" not in res_get.data["data"]

    def test_natural_language_query_with_datasource_id(self, temp_sqlite_db):
        ds = DataSource.objects.create(
            name="NLQ SQLite",
            engine=DataSourceEngine.SQLITE,
            database_name=temp_sqlite_db,
            user=self.user_a,
            allowed_tables=["accounts"],
        )
        # Pre-sync schema
        sd.introspect_schema(ds)

        self.client.force_authenticate(user=self.user_a)
        res = self.client.post("/api/query/", {
            "question": "show all accounts",
            "data_source_id": ds.id,
            "dry_run": False,
        }, format="json")

        assert res.status_code == 200
        data = res.data["data"]
        assert data["row_count"] >= 1
        assert "columns" in data
        assert "rows" in data
