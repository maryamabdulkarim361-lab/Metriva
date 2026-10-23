"""Tests for AI Natural Language Query and Execution endpoints."""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.ai_assistant.models import QueryHistory, QueryStatus
from apps.analytics.models import Customer, CustomerSegment, Order, OrderStatus

User = get_user_model()


@pytest.mark.django_db
class TestAIQueryAPI:
    def setup_method(self):
        self.client = APIClient()
        cust = Customer.objects.create(
            name="Mega Corp",
            email="megacorp@example.com",
            country="United States",
            signup_date=date(2025, 1, 1),
            customer_segment=CustomerSegment.ENTERPRISE,
        )
        Order.objects.create(
            customer=cust,
            order_date="2026-05-10T12:00:00Z",
            status=OrderStatus.COMPLETED,
            total_amount=Decimal("5000.00"),
        )

    def test_natural_language_query_flow(self):
        payload = {"question": "Show the top 10 customers by revenue."}
        res = self.client.post("/api/query/", payload, format="json")
        assert res.status_code == 200
        assert res.data["success"] is True
        assert "sql" in res.data["data"]
        assert "rows" in res.data["data"]
        assert "columns" in res.data["data"]
        assert "explanation" in res.data["data"]
        assert res.data["data"]["row_count"] >= 1

    def test_dry_run_mode(self):
        payload = {
            "question": "Show the top 10 customers by revenue.",
            "dry_run": True,
        }
        res = self.client.post("/api/query/", payload, format="json")
        assert res.status_code == 200
        assert res.data["success"] is True
        assert res.data["data"]["dry_run"] is True
        assert "sql" in res.data["data"]
        # In dry run, rows are not executed
        assert "rows" not in res.data["data"]

    def test_direct_sql_execution_success(self):
        payload = {"sql": "SELECT id, name, country FROM customers LIMIT 5;"}
        res = self.client.post("/api/query/execute-direct/", payload, format="json")
        assert res.status_code == 200
        assert res.data["success"] is True
        assert len(res.data["data"]["rows"]) >= 1

    def test_direct_sql_rejection_of_drop_table(self):
        payload = {"sql": "DROP TABLE customers;"}
        res = self.client.post("/api/query/execute-direct/", payload, format="json")
        assert res.status_code == 400
        assert res.data["success"] is False
        assert res.data["error"]["code"] in ("FORBIDDEN_OPERATION", "UNSAFE_QUERY")

        # Verify blocked attempt is audited in QueryHistory
        blocked_entry = QueryHistory.objects.filter(execution_status=QueryStatus.BLOCKED).first()
        assert blocked_entry is not None
        assert "DROP" in blocked_entry.generated_sql

    def test_direct_sql_rejection_of_delete(self):
        payload = {"sql": "DELETE FROM orders WHERE id = 1;"}
        res = self.client.post("/api/query/execute-direct/", payload, format="json")
        assert res.status_code == 400
        assert res.data["success"] is False

    def test_query_history_list_and_rerun(self):
        # Create a historical record
        history = QueryHistory.objects.create(
            natural_language_question="Test history",
            generated_sql="SELECT id, name FROM customers LIMIT 1;",
            execution_status=QueryStatus.SUCCESS,
            row_count=1,
            execution_time_ms=5.0,
        )

        res = self.client.get("/api/query/history/")
        assert res.status_code == 200
        assert res.data["success"] is True

        # Test rerun
        rerun_res = self.client.post(f"/api/query/history/{history.id}/rerun/")
        assert rerun_res.status_code == 200
        assert rerun_res.data["success"] is True
        assert rerun_res.data["data"]["row_count"] >= 1

    def test_ai_status_endpoint(self):
        res = self.client.get("/api/query/status/")
        assert res.status_code == 200
        assert res.data["success"] is True
        assert "provider" in res.data["data"]
        assert "limits" in res.data["data"]
        assert res.data["data"]["limits"]["max_rows"] == 1000

    def test_direct_sql_rejection_of_password_column(self):
        payload = {"sql": "SELECT id, email, password FROM users;"}
        res = self.client.post("/api/query/execute-direct/", payload, format="json")
        assert res.status_code == 400
        assert res.data["success"] is False
        assert res.data["error"]["code"] == "SENSITIVE_COLUMN_PROHIBITED"

        # Verify blocked attempt is audited in QueryHistory
        blocked_entry = QueryHistory.objects.filter(
            execution_status=QueryStatus.BLOCKED,
            generated_sql=payload["sql"],
        ).first()
        assert blocked_entry is not None
        assert "password" in blocked_entry.generated_sql

    def test_direct_sql_rejection_of_dangerous_function(self):
        payload = {"sql": "SELECT pg_read_file('/etc/passwd');"}
        res = self.client.post("/api/query/execute-direct/", payload, format="json")
        assert res.status_code == 400
        assert res.data["success"] is False
        assert res.data["error"]["code"] == "SUSPICIOUS_FUNCTION_CALL"

        blocked_entry = QueryHistory.objects.filter(
            execution_status=QueryStatus.BLOCKED,
            generated_sql=payload["sql"],
        ).first()
        assert blocked_entry is not None

    def test_query_history_isolation_between_users(self):
        user_a = User.objects.create_user(
            email="user_a@example.com",
            password="Password123!",
            name="User A",
        )
        user_b = User.objects.create_user(
            email="user_b@example.com",
            password="Password123!",
            name="User B",
        )
        staff_user = User.objects.create_user(
            email="staff@example.com",
            password="Password123!",
            name="Staff User",
            is_staff=True,
        )

        history_a = QueryHistory.objects.create(
            user=user_a,
            natural_language_question="User A Secret Question",
            generated_sql="SELECT id, name FROM customers LIMIT 1;",
            execution_status=QueryStatus.SUCCESS,
            row_count=1,
        )

        # 1. User B should NOT see User A's history
        client_b = APIClient()
        client_b.force_authenticate(user=user_b)
        res_b = client_b.get("/api/query/history/")
        assert res_b.status_code == 200
        data_b = res_b.data["data"]["results"] if "results" in res_b.data["data"] else res_b.data["data"]
        returned_ids_b = [item["id"] for item in data_b]
        assert history_a.id not in returned_ids_b

        # 2. User B should NOT be able to rerun User A's query
        rerun_b = client_b.post(f"/api/query/history/{history_a.id}/rerun/")
        assert rerun_b.status_code == 404

        # 3. Anonymous caller should NOT see User A's history
        client_anon = APIClient()
        res_anon = client_anon.get("/api/query/history/")
        assert res_anon.status_code == 200
        data_anon = (
            res_anon.data["data"]["results"]
            if "results" in res_anon.data["data"]
            else res_anon.data["data"]
        )
        returned_ids_anon = [item["id"] for item in data_anon]
        assert history_a.id not in returned_ids_anon

        # 4. Anonymous caller should NOT be able to rerun User A's query
        rerun_anon = client_anon.post(f"/api/query/history/{history_a.id}/rerun/")
        assert rerun_anon.status_code == 404

        # 5. Staff user CAN see User A's history
        client_staff = APIClient()
        client_staff.force_authenticate(user=staff_user)
        res_staff = client_staff.get("/api/query/history/")
        assert res_staff.status_code == 200
        data_staff = (
            res_staff.data["data"]["results"]
            if "results" in res_staff.data["data"]
            else res_staff.data["data"]
        )
        returned_ids_staff = [item["id"] for item in data_staff]
        assert history_a.id in returned_ids_staff
