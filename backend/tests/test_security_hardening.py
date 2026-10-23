"""
Comprehensive Security and Hardening Test Suite (Phase 5).

Covers:
1. SSRF and malicious host/port blocking.
2. Malicious SQLite path traversal and system file blocking.
3. Executable comment injection blocking (/*!50000 ... */).
4. Multi-tenant cross-user object access prevention.
5. Observability and correlation headers (X-Request-ID).
6. Liveness and Readiness probes.
7. Background job duplicate suppression and cancellation.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.ai_assistant.sql_validator import SQLValidator
from apps.datasources.models import DataSource, DataSourceEngine
from apps.datasources.target_validator import (
    validate_sqlite_path,
    validate_target_host_and_port,
)
from apps.ml.engine.runner import cancel_ml_job, trigger_ml_job
from apps.ml.models import MLJob

User = get_user_model()


@pytest.fixture
def api_client():
    client = APIClient()
    client.defaults["HTTP_HOST"] = "127.0.0.1"
    return client


@pytest.fixture
def user_a(db):
    return User.objects.create_user(
        name="User A", email="user_a@example.com", password="Password123!"
    )


@pytest.fixture
def user_b(db):
    return User.objects.create_user(
        name="User B", email="user_b@example.com", password="Password123!"
    )


@pytest.mark.django_db
class TestSSRFAndConnectionHardening:
    """Validate server-side rejection of SSRF vectors and unauthorized ports."""

    def test_block_cloud_metadata_ips(self):
        with pytest.raises(ValidationError) as exc:
            validate_target_host_and_port(DataSourceEngine.POSTGRESQL, "169.254.169.254", 5432)
        assert "metadata" in str(exc.value).lower() or "forbidden" in str(exc.value).lower()

    def test_block_cloud_metadata_hostnames(self):
        for host in ["metadata.google.internal", "metadata.azure.com", "instance-data"]:
            with pytest.raises(ValidationError):
                validate_target_host_and_port(DataSourceEngine.POSTGRESQL, host, 5432)

    def test_block_prohibited_infrastructure_ports(self):
        for port in [22, 23, 25, 80, 443, 6379, 2375, 6443, 11211, 27017]:
            with pytest.raises(ValidationError) as exc:
                validate_target_host_and_port(DataSourceEngine.POSTGRESQL, "localhost", port)
            assert "restricted" in str(exc.value).lower() or "port" in str(exc.value).lower()

    def test_sqlite_reject_path_traversal(self):
        with pytest.raises(ValidationError) as exc:
            validate_sqlite_path("../../../etc/passwd")
        assert "traversal" in str(exc.value).lower()

    def test_sqlite_reject_system_directories(self):
        for path in ["/etc/passwd", "/proc/self/environ", "/var/run/docker.sock", "/root/.ssh/id_rsa"]:
            with pytest.raises(ValidationError) as exc:
                validate_sqlite_path(path)
            assert "prohibited" in str(exc.value).lower()

    def test_sqlite_reject_null_bytes(self):
        with pytest.raises(ValidationError):
            validate_sqlite_path("mydb.sqlite\x00/etc/passwd")

    def test_api_raw_connection_blocks_ssrf(self, api_client):
        res = api_client.post(
            "/api/datasources/test-raw/",
            {
                "engine": "postgresql",
                "host": "169.254.169.254",
                "port": 5432,
                "database_name": "targetdb",
                "username": "user",
                "password": "pw",
            },
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "metadata" in str(res.data).lower() or "ssrf" in str(res.data).lower()


@pytest.mark.django_db
class TestSQLSecurityHardening:
    """Validate server-side rejection of SQL evasion and executable comments."""

    def test_reject_mysql_executable_comments(self):
        validator = SQLValidator()
        malicious_queries = [
            'SELECT * FROM customers /*!50000 INTO OUTFILE "/tmp/leak.txt" */;',
            "SELECT * FROM customers /*! UNION SELECT id, password FROM users */;",
            "SELECT * FROM customers /*!32302 WHERE 1=1 */;",
        ]
        for q in malicious_queries:
            res = validator.validate(q, dialect="mysql")
            assert not res.is_valid
            assert res.error_code == "SUSPICIOUS_COMMENT_OBFUSCATION"

    def test_reject_comment_keyword_splitting(self):
        validator = SQLValidator()
        res = validator.validate("SEL/**/ECT id FROM customers;")
        assert not res.is_valid


@pytest.mark.django_db
class TestMultiTenantAuthorizationHardening:
    """Verify that users cannot modify, view, or mutate another user's resources."""

    def test_datasource_cross_user_isolation(self, api_client, user_a, user_b):
        # Create datasource owned by User A
        ds_a = DataSource.objects.create(
            name="User A Source",
            engine=DataSourceEngine.SQLITE,
            database_name="a.sqlite",
            user=user_a,
        )

        # User B cannot see or delete User A's datasource
        api_client.force_authenticate(user=user_b)
        res_list = api_client.get("/api/datasources/")
        ids = [d["id"] for d in res_list.data["data"]]
        assert ds_a.id not in ids

        res_delete = api_client.delete(f"/api/datasources/{ds_a.id}/")
        assert res_delete.status_code == status.HTTP_404_NOT_FOUND
        assert DataSource.objects.filter(id=ds_a.id).exists()

    def test_saved_report_cross_user_mutation_blocked(self, api_client, user_a, user_b):
        from apps.analytics.models import SavedReport

        report_a = SavedReport.objects.create(
            name="Confidential A Report",
            user=user_a,
            sql="SELECT 1;",
        )

        # User B cannot modify or delete Report A
        api_client.force_authenticate(user=user_b)
        res_patch = api_client.patch(
            f"/api/reports/{report_a.id}/",
            {"name": "Tampered Name"},
            format="json",
        )
        assert res_patch.status_code in (status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN)
        report_a.refresh_from_db()
        assert report_a.name == "Confidential A Report"

    def test_anonymous_cannot_delete_public_template(self, api_client):
        from apps.analytics.models import SavedReport

        public_rep = SavedReport.objects.create(
            name="Public Template",
            user=None,
            sql="SELECT 1;",
        )
        res_delete = api_client.delete(f"/api/reports/{public_rep.id}/")
        assert res_delete.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)
        assert SavedReport.objects.filter(id=public_rep.id).exists()

    def test_ml_model_approval_requires_authentication(self, api_client):
        from apps.ml.models import MLModel, MLModelType, MLModelVersion

        m = MLModel.objects.create(name="Prod Model", model_type=MLModelType.REVENUE_FORECAST)
        v = MLModelVersion.objects.create(model=m, version="1.0.1", approval_status="DRAFT")

        # Anonymous cannot approve
        res = api_client.post(f"/api/ml/models/{m.id}/approve-version/", {"version_id": v.id}, format="json")
        assert res.status_code == status.HTTP_401_UNAUTHORIZED
        v.refresh_from_db()
        assert v.approval_status == "DRAFT"


@pytest.mark.django_db
class TestObservabilityAndReliability:
    """Verify health endpoints, request correlation, and background job safeguards."""

    def test_liveness_and_readiness_endpoints(self, api_client):
        live_res = api_client.get("/api/health/")
        assert live_res.status_code == 200
        assert live_res.data["data"]["status"] == "UP"
        assert "X-Request-ID" in live_res.headers

        ready_res = api_client.get("/api/ready/")
        assert ready_res.status_code == 200
        assert ready_res.data["data"]["status"] == "READY"
        assert ready_res.data["data"]["checks"]["database"]["status"] == "UP"

    def test_background_job_duplicate_suppression(self):
        # If a job is already active, trigger_ml_job suppresses duplicate and returns existing job
        active_job = MLJob.objects.create(job_type="ANOMALY_SCAN", status="RUNNING")
        job2 = trigger_ml_job("ANOMALY_SCAN", run_async=False)
        assert job2.id == active_job.id

    def test_background_job_cancellation(self):
        job = MLJob.objects.create(job_type="TRAIN_CHURN", status="PENDING")
        cancelled = cancel_ml_job(job.id)
        assert cancelled.status == "CANCELLED"
        cancelled.refresh_from_db()
        assert cancelled.status == "CANCELLED"
