"""
Comprehensive RBAC, Multi-Tenant Isolation, and Column-Level Data Masking Test Suite (Phase 2).

Covers:
1. Organization membership lifecycle, roles (ADMIN, ANALYST, VIEWER), and last-admin protection.
2. Tenant isolation across datasources, saved reports, query history, and execution endpoints.
3. Role permission matrix enforcement:
   - Admin: Full management, raw unmasked query execution.
   - Analyst: Query & report execution with masked columns, no administrative mutations.
   - Viewer: Read-only dashboards and saved reports, strictly blocked from Direct & AI SQL.
4. Column-level data masking policies (REDACT, EMAIL, PHONE, NULLIFY).
5. AST inference risk defense blocking sensitive column filtering, joining, and aggregation for non-admins.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from apps.ai_assistant.models import QueryHistory
from apps.ai_assistant.sql_validator import SQLValidator
from apps.analytics.models import SavedReport
from apps.datasources.models import DataSource, DataSourceEngine
from apps.organizations.masking_service import DataMaskingService
from apps.organizations.models import (
    ColumnMaskingPolicy,
    MaskingType,
    Organization,
    OrganizationMembership,
    RoleChoices,
)

User = get_user_model()


@pytest.fixture
def api_client():
    client = APIClient()
    client.defaults["HTTP_HOST"] = "127.0.0.1"
    return client


@pytest.fixture
def org_alpha(db):
    return Organization.objects.create(name="Alpha Corp", slug="alpha-corp")


@pytest.fixture
def org_beta(db):
    return Organization.objects.create(name="Beta Corp", slug="beta-corp")


@pytest.fixture
def admin_alpha(db, org_alpha):
    user = User.objects.create_user(
        name="Admin Alpha", email="admin@alpha.com", password="Password123!"
    )
    OrganizationMembership.objects.create(
        organization=org_alpha, user=user, role=RoleChoices.ADMIN
    )
    return user


@pytest.fixture
def analyst_alpha(db, org_alpha):
    user = User.objects.create_user(
        name="Analyst Alpha", email="analyst@alpha.com", password="Password123!"
    )
    OrganizationMembership.objects.create(
        organization=org_alpha, user=user, role=RoleChoices.ANALYST
    )
    return user


@pytest.fixture
def viewer_alpha(db, org_alpha):
    user = User.objects.create_user(
        name="Viewer Alpha", email="viewer@alpha.com", password="Password123!"
    )
    OrganizationMembership.objects.create(
        organization=org_alpha, user=user, role=RoleChoices.VIEWER
    )
    return user


@pytest.fixture
def admin_beta(db, org_beta):
    user = User.objects.create_user(
        name="Admin Beta", email="admin@beta.com", password="Password123!"
    )
    OrganizationMembership.objects.create(
        organization=org_beta, user=user, role=RoleChoices.ADMIN
    )
    return user


@pytest.fixture
def ds_alpha(db, org_alpha, admin_alpha):
    return DataSource.objects.create(
        name="Alpha Primary DB",
        engine=DataSourceEngine.SQLITE,
        organization=org_alpha,
        user=admin_alpha,
        database_name="backend/data/test_business_db.sqlite3",
        is_active=True,
    )


@pytest.fixture
def ds_beta(db, org_beta, admin_beta):
    return DataSource.objects.create(
        name="Beta Sensitive DB",
        engine=DataSourceEngine.SQLITE,
        organization=org_beta,
        user=admin_beta,
        database_name="backend/data/test_business_db.sqlite3",
        is_active=True,
    )


# ==============================================================================
# 1. Organization & Membership Management
# ==============================================================================


@pytest.mark.django_db
class TestOrganizationMembershipLifecycle:
    """Test organization creation, member addition, role alteration, and last-admin safety."""

    def test_list_and_create_organization(self, api_client, admin_alpha):
        api_client.force_authenticate(user=admin_alpha)
        res = api_client.get("/api/organizations/")
        assert res.status_code == status.HTTP_200_OK
        assert len(res.data["data"]) >= 1

        res = api_client.post("/api/organizations/", {"name": "New Ventures Inc"})
        assert res.status_code == status.HTTP_201_CREATED
        new_org_id = res.data["data"]["id"]
        # Creating user should automatically become ADMIN of the new org
        assert OrganizationMembership.objects.filter(
            organization_id=new_org_id, user=admin_alpha, role=RoleChoices.ADMIN
        ).exists()

    def test_admin_can_add_existing_user_to_org(self, api_client, admin_alpha, org_alpha):
        new_user = User.objects.create_user(
            name="New Colleague", email="colleague@alpha.com", password="Password123!"
        )
        api_client.force_authenticate(user=admin_alpha)
        payload = {"email": "colleague@alpha.com", "role": RoleChoices.ANALYST}
        res = api_client.post(
            f"/api/organizations/{org_alpha.id}/members/", payload, format="json"
        )
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["success"] is True
        assert OrganizationMembership.objects.filter(
            organization=org_alpha, user=new_user, role=RoleChoices.ANALYST
        ).exists()

    def test_cannot_add_nonexistent_user_email(self, api_client, admin_alpha, org_alpha):
        api_client.force_authenticate(user=admin_alpha)
        payload = {"email": "ghost@nowhere.com", "role": RoleChoices.VIEWER}
        res = api_client.post(
            f"/api/organizations/{org_alpha.id}/members/", payload, format="json"
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "USER_NOT_FOUND" in res.data["error"]["code"]

    def test_non_admin_cannot_add_members(self, api_client, analyst_alpha, org_alpha):
        User.objects.create_user(
            name="Another User", email="another@alpha.com", password="Password123!"
        )
        api_client.force_authenticate(user=analyst_alpha)
        payload = {"email": "another@alpha.com", "role": RoleChoices.VIEWER}
        res = api_client.post(
            f"/api/organizations/{org_alpha.id}/members/", payload, format="json"
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_last_admin_protection_on_demote_and_delete(
        self, api_client, admin_alpha, org_alpha
    ):
        membership = OrganizationMembership.objects.get(
            organization=org_alpha, user=admin_alpha
        )
        api_client.force_authenticate(user=admin_alpha)

        # 1. Attempt to demote only admin
        res = api_client.patch(
            f"/api/organizations/{org_alpha.id}/members/{membership.id}/",
            {"role": RoleChoices.VIEWER},
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "CANNOT_DEMOTE_LAST_ADMIN" in res.data["error"]["code"]

        # 2. Attempt to delete only admin
        res = api_client.delete(
            f"/api/organizations/{org_alpha.id}/members/{membership.id}/"
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "CANNOT_REMOVE_LAST_ADMIN" in res.data["error"]["code"]


# ==============================================================================
# 2. Multi-Tenant Isolation
# ==============================================================================


@pytest.mark.django_db
class TestTenantIsolation:
    """Verify complete isolation between Organization Alpha and Organization Beta."""

    def test_cannot_list_or_view_other_tenant_datasource(
        self, api_client, admin_alpha, org_alpha, ds_beta
    ):
        api_client.force_authenticate(user=admin_alpha)
        api_client.defaults["HTTP_X_ORGANIZATION_ID"] = str(org_alpha.id)

        # Listing only shows Alpha datasources
        res = api_client.get("/api/datasources/")
        assert res.status_code == status.HTTP_200_OK
        returned_ids = [d["id"] for d in res.data["data"]]
        assert ds_beta.id not in returned_ids

        # Direct access to Beta datasource returns 404
        res = api_client.get(f"/api/datasources/{ds_beta.id}/")
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_cannot_execute_query_against_other_tenant_datasource(
        self, api_client, admin_alpha, org_alpha, ds_beta
    ):
        api_client.force_authenticate(user=admin_alpha)
        api_client.defaults["HTTP_X_ORGANIZATION_ID"] = str(org_alpha.id)

        # Attempt to run Direct SQL on Beta's datasource
        payload = {
            "sql": "SELECT 1 as test_col;",
            "data_source_id": ds_beta.id,
        }
        res = api_client.post("/api/query/execute-direct/", payload, format="json")
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_saved_reports_isolated_per_tenant(
        self, api_client, admin_alpha, admin_beta, org_alpha, org_beta
    ):
        report_alpha = SavedReport.objects.create(
            name="Alpha Revenue",
            organization=org_alpha,
            user=admin_alpha,
            sql="SELECT 100 as rev;",
            chart_type="metric",
        )
        report_beta = SavedReport.objects.create(
            name="Beta Revenue",
            organization=org_beta,
            user=admin_beta,
            sql="SELECT 200 as rev;",
            chart_type="metric",
        )

        api_client.force_authenticate(user=admin_alpha)
        api_client.defaults["HTTP_X_ORGANIZATION_ID"] = str(org_alpha.id)

        res = api_client.get("/api/reports/")
        assert res.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in res.data["data"]]
        assert report_alpha.id in ids
        assert report_beta.id not in ids

        # Beta report detail returns 404 for Alpha user
        res = api_client.get(f"/api/reports/{report_beta.id}/")
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_query_history_isolated_between_tenants_and_roles(
        self, api_client, admin_alpha, analyst_alpha, admin_beta, org_alpha, org_beta
    ):
        qh_admin_alpha = QueryHistory.objects.create(
            user=admin_alpha,
            organization=org_alpha,
            natural_language_question="Admin Q",
            generated_sql="SELECT 1;",
            row_count=1,
            execution_time_ms=10.0,
        )
        qh_analyst_alpha = QueryHistory.objects.create(
            user=analyst_alpha,
            organization=org_alpha,
            natural_language_question="Analyst Q",
            generated_sql="SELECT 2;",
            row_count=1,
            execution_time_ms=10.0,
        )
        qh_beta = QueryHistory.objects.create(
            user=admin_beta,
            organization=org_beta,
            natural_language_question="Beta Q",
            generated_sql="SELECT 3;",
            row_count=1,
            execution_time_ms=10.0,
        )

        # Admin Alpha sees all Alpha queries, never Beta
        api_client.force_authenticate(user=admin_alpha)
        api_client.defaults["HTTP_X_ORGANIZATION_ID"] = str(org_alpha.id)
        res = api_client.get("/api/query/history/")
        assert res.status_code == status.HTTP_200_OK
        data_admin = res.data["data"]["results"] if "results" in res.data["data"] else res.data["data"]
        history_ids = [q["id"] for q in data_admin]
        assert qh_admin_alpha.id in history_ids
        assert qh_analyst_alpha.id in history_ids
        assert qh_beta.id not in history_ids

        # Analyst Alpha sees only their own queries
        api_client.force_authenticate(user=analyst_alpha)
        res = api_client.get("/api/query/history/")
        assert res.status_code == status.HTTP_200_OK
        data_analyst = res.data["data"]["results"] if "results" in res.data["data"] else res.data["data"]
        analyst_ids = [q["id"] for q in data_analyst]
        assert qh_analyst_alpha.id in analyst_ids
        assert qh_admin_alpha.id not in analyst_ids
        assert qh_beta.id not in analyst_ids


# ==============================================================================
# 3. Role Permissions Matrix & Viewer Access Locks
# ==============================================================================


@pytest.mark.django_db
class TestRolePermissionsMatrix:
    """Validate permissions matrix across ADMIN, ANALYST, and VIEWER."""

    def test_viewer_blocked_from_direct_sql_and_ai_query(
        self, api_client, viewer_alpha, org_alpha, ds_alpha
    ):
        api_client.force_authenticate(user=viewer_alpha)
        api_client.defaults["HTTP_X_ORGANIZATION_ID"] = str(org_alpha.id)

        # 1. Direct SQL must return 403 DIRECT_SQL_RESTRICTED
        res = api_client.post(
            "/api/query/execute-direct/",
            {"sql": "SELECT 1;", "data_source_id": ds_alpha.id},
            format="json",
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert res.data["error"]["code"] == "DIRECT_SQL_RESTRICTED"

        # 2. AI Query must return 403 VIEWER_QUERY_RESTRICTED
        res = api_client.post(
            "/api/query/",
            {"question": "Show total sales", "data_source_id": ds_alpha.id},
            format="json",
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert res.data["error"]["code"] == "VIEWER_QUERY_RESTRICTED"

    def test_viewer_can_execute_saved_report(
        self, api_client, viewer_alpha, org_alpha, admin_alpha, ds_alpha
    ):
        report = SavedReport.objects.create(
            name="Approved Executive Report",
            organization=org_alpha,
            user=admin_alpha,
            data_source=ds_alpha,
            sql="SELECT 42 as total_count, 'confidential@example.com' as email;",
            chart_type="metric",
        )
        # Add email masking policy
        ColumnMaskingPolicy.objects.create(
            organization=org_alpha,
            rule_name="Mask Emails",
            match_type="EXACT",
            match_pattern="email",
            masking_type=MaskingType.EMAIL,
        )

        api_client.force_authenticate(user=viewer_alpha)
        api_client.defaults["HTTP_X_ORGANIZATION_ID"] = str(org_alpha.id)

        # Viewer can refresh / view report data
        res = api_client.post(f"/api/reports/{report.id}/refresh/")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["success"] is True
        rows = res.data["data"]["rows"]
        cols = res.data["data"]["columns"]
        assert len(rows) == 1
        row_dict = dict(zip(cols, rows[0])) if isinstance(rows[0], (list, tuple)) else rows[0]
        # Email MUST be masked for Viewer
        assert row_dict["email"] == "c***l@example.com"

    def test_analyst_can_run_direct_sql_and_receives_masked_data(
        self, api_client, analyst_alpha, org_alpha, ds_alpha
    ):
        ColumnMaskingPolicy.objects.create(
            organization=org_alpha,
            rule_name="Mask Emails",
            match_type="EXACT",
            match_pattern="customer_email",
            masking_type=MaskingType.EMAIL,
        )

        api_client.force_authenticate(user=analyst_alpha)
        api_client.defaults["HTTP_X_ORGANIZATION_ID"] = str(org_alpha.id)

        res = api_client.post(
            "/api/query/execute-direct/",
            {
                "sql": "SELECT 101 as id, 'analyst_target@alpha.com' as customer_email;",
                "data_source_id": ds_alpha.id,
            },
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        rows = res.data["data"]["rows"]
        cols = res.data["data"]["columns"]
        row_dict = dict(zip(cols, rows[0])) if isinstance(rows[0], (list, tuple)) else rows[0]
        assert row_dict["customer_email"] == "a***t@alpha.com"

    def test_admin_receives_unmasked_raw_data(
        self, api_client, admin_alpha, org_alpha, ds_alpha
    ):
        ColumnMaskingPolicy.objects.create(
            organization=org_alpha,
            rule_name="Mask Emails",
            match_type="EXACT",
            match_pattern="customer_email",
            masking_type=MaskingType.EMAIL,
        )

        api_client.force_authenticate(user=admin_alpha)
        api_client.defaults["HTTP_X_ORGANIZATION_ID"] = str(org_alpha.id)

        res = api_client.post(
            "/api/query/execute-direct/",
            {
                "sql": "SELECT 101 as id, 'admin_target@alpha.com' as customer_email;",
                "data_source_id": ds_alpha.id,
            },
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        rows = res.data["data"]["rows"]
        cols = res.data["data"]["columns"]
        row_dict = dict(zip(cols, rows[0])) if isinstance(rows[0], (list, tuple)) else rows[0]
        assert row_dict["customer_email"] == "admin_target@alpha.com"


# ==============================================================================
# 4. Column Masking Transforms & Policy Management
# ==============================================================================


@pytest.mark.django_db
class TestMaskingTransformations:
    """Direct unit testing of masking algorithms in DataMaskingService."""

    def test_email_masking(self):
        assert DataMaskingService.mask_email("john.doe@example.com") == "j***e@example.com"
        assert DataMaskingService.mask_email("a@b.com") == "a***@b.com"
        assert DataMaskingService.mask_email("invalid-email") == "[REDACTED]"

    def test_phone_masking(self):
        assert DataMaskingService.mask_phone("+1-555-432-8899") == "***-***-8899"
        assert DataMaskingService.mask_phone("1234567") == "***-***-4567"
        assert DataMaskingService.mask_phone("123") == "***-***-****"

    def test_mask_result_set_different_types(self, org_alpha):
        ColumnMaskingPolicy.objects.create(
            organization=org_alpha,
            rule_name="Phone Redact",
            match_type="EXACT",
            match_pattern="phone_number",
            masking_type=MaskingType.PHONE,
        )
        ColumnMaskingPolicy.objects.create(
            organization=org_alpha,
            rule_name="SSN Full Redact",
            match_type="EXACT",
            match_pattern="ssn",
            masking_type=MaskingType.REDACT,
        )
        ColumnMaskingPolicy.objects.create(
            organization=org_alpha,
            rule_name="Token Nullify",
            match_type="EXACT",
            match_pattern="api_token",
            masking_type=MaskingType.NULLIFY,
        )

        columns = ["id", "phone_number", "ssn", "api_token"]
        rows = [
            {"id": 1, "phone_number": "555-800-1122", "ssn": "000-12-3456", "api_token": "secret_xyz"},
            {"id": 2, "phone_number": None, "ssn": "000-99-8877", "api_token": "tok_123"},
        ]

        # For Analyst
        masked = DataMaskingService.mask_result_set(
            columns, rows, organization=org_alpha, user_role=RoleChoices.ANALYST
        )
        assert masked[0]["phone_number"] == "***-***-1122"
        assert masked[0]["ssn"] == "[REDACTED]"
        assert masked[0]["api_token"] is None
        assert masked[1]["phone_number"] is None

        # For Admin -> zero masking
        unmasked = DataMaskingService.mask_result_set(
            columns, rows, organization=org_alpha, user_role=RoleChoices.ADMIN
        )
        assert unmasked[0]["phone_number"] == "555-800-1122"
        assert unmasked[0]["ssn"] == "000-12-3456"
        assert unmasked[0]["api_token"] == "secret_xyz"


# ==============================================================================
# 5. AST Inference Risk Defense
# ==============================================================================


class TestASTInferenceRiskDefense:
    """Validate that non-admins cannot infer restricted columns via WHERE/ON/GROUP BY."""

    def setup_method(self):
        self.validator = SQLValidator()
        self.restricted = {"email", "ssn", "phone", "password_hash"}

    def test_sensitive_column_in_where_clause_blocked(self):
        query = "SELECT id, name FROM customers WHERE email = 'victim@example.com';"
        res = self.validator.validate(query, inference_restricted_columns=self.restricted)
        assert res.is_valid is False
        assert res.error_code == "INFERENCE_RISK_DETECTED"
        assert "sensitive column 'email'" in res.error_message

    def test_sensitive_column_in_like_where_clause_blocked(self):
        query = "SELECT id FROM customers WHERE phone LIKE '%8899';"
        res = self.validator.validate(query, inference_restricted_columns=self.restricted)
        assert res.is_valid is False
        assert res.error_code == "INFERENCE_RISK_DETECTED"

    def test_sensitive_column_in_join_condition_blocked(self):
        query = (
            "SELECT a.id, b.order_total "
            "FROM customers a JOIN orders b ON a.email = b.customer_email;"
        )
        res = self.validator.validate(query, inference_restricted_columns=self.restricted)
        assert res.is_valid is False
        assert res.error_code == "INFERENCE_RISK_DETECTED"

    def test_sensitive_column_in_group_by_blocked(self):
        query = "SELECT count(id) FROM customers GROUP BY ssn;"
        res = self.validator.validate(query, inference_restricted_columns=self.restricted)
        assert res.is_valid is False
        assert res.error_code == "INFERENCE_RISK_DETECTED"

    def test_sensitive_column_in_order_by_blocked(self):
        query = "SELECT id, name FROM customers ORDER BY email ASC;"
        res = self.validator.validate(query, inference_restricted_columns=self.restricted)
        assert res.is_valid is False
        assert res.error_code == "INFERENCE_RISK_DETECTED"

    def test_select_star_blocked_when_table_has_restricted_columns(self):
        schema_cols = {"customers": ["id", "name", "email", "created_at"]}
        query = "SELECT * FROM customers;"
        res = self.validator.validate(
            query,
            inference_restricted_columns=self.restricted,
            schema_columns=schema_cols,
        )
        assert res.is_valid is False
        assert res.error_code == "INFERENCE_RISK_DETECTED"

    def test_safe_query_passes_without_interference(self):
        query = "SELECT id, name, created_at FROM customers WHERE id > 10 ORDER BY id ASC;"
        res = self.validator.validate(query, inference_restricted_columns=self.restricted)
        assert res.is_valid is True
        assert res.error_code is None

