"""Unit and integration tests for Business Intelligence, Metrics Layer, Saved Reports, and Period Comparisons."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.analytics.metrics import get_all_metrics, get_metric
from apps.analytics.models import SavedReport, ScheduledReport, ScheduledReportExecution
from apps.analytics.period_comparisons import calculate_period_comparison

User = get_user_model()


class TestBusinessMetricsLayer:
    """Test canonical metric definitions, formulas, and assumptions."""

    def test_canonical_metrics_exist(self):
        metrics = get_all_metrics()
        assert len(metrics) >= 8

        ids = [m["id"] for m in metrics]
        assert "revenue" in ids
        assert "gross_profit" in ids
        assert "gross_margin" in ids
        assert "average_order_value" in ids
        assert "customer_lifetime_value" in ids
        assert "customer_retention" in ids
        assert "order_cancellation_rate" in ids
        assert "month_over_month_growth" in ids

    def test_metric_formula_and_assumptions(self):
        revenue_metric = get_metric("revenue")
        assert revenue_metric is not None
        assert "SUM(orders.total_amount)" in revenue_metric.formula
        assert "orders.status = 'COMPLETED'" in revenue_metric.filter_criteria
        assert revenue_metric.unit == "currency"
        assert revenue_metric.currency == "USD"
        assert "refunded" in revenue_metric.assumptions.lower()

        profit_metric = get_metric("gross_profit")
        assert profit_metric is not None
        assert "products.cost" in profit_metric.formula
        assert "COGS" in profit_metric.assumptions


@pytest.mark.django_db
class TestPeriodComparisons:
    """Test period-over-period calculations and business summary synthesis."""

    def test_period_comparison_mom(self):
        res = calculate_period_comparison(period_type="mom", limit_periods=4)
        assert "period_type" in res
        assert res["period_type"] == "mom"
        assert "data" in res
        assert "summary" in res

        summary = res["summary"]
        assert "observed_facts" in summary
        assert "statistical_associations" in summary
        assert "investigation_hypotheses" in summary

    def test_period_comparison_with_category_dimension(self):
        res = calculate_period_comparison(period_type="mom", dimension="category", limit_periods=3)
        assert res["dimension"] == "category"
        assert isinstance(res["data"], list)


@pytest.mark.django_db
class TestSavedReportsAPI:
    """Test SavedReport CRUD, tenant isolation, and refresh execution."""

    def setup_method(self):
        self.client = APIClient()
        self.user_a = User.objects.create_user(email="user_a@example.com", name="User A", password="pass123")
        self.user_b = User.objects.create_user(email="user_b@example.com", name="User B", password="pass123")

    def test_saved_report_tenant_isolation(self):
        # User A saves a report
        rep_a = SavedReport.objects.create(
            name="Report A",
            category="Revenue",
            natural_language_question="top customers",
            sql="SELECT id, name FROM customers LIMIT 5;",
            user=self.user_a,
        )

        # User B cannot see User A's private report
        self.client.force_authenticate(user=self.user_b)
        res_b = self.client.get("/api/reports/")
        assert res_b.status_code == 200
        ids_b = [item["id"] for item in res_b.data["data"]]
        assert rep_a.id not in ids_b

        # User A can retrieve their own report
        self.client.force_authenticate(user=self.user_a)
        res_a = self.client.get("/api/reports/")
        assert res_a.status_code == 200
        ids_a = [item["id"] for item in res_a.data["data"]]
        assert rep_a.id in ids_a

    def test_refresh_saved_report_revalidates_and_executes(self):
        self.client.force_authenticate(user=self.user_a)
        rep = SavedReport.objects.create(
            name="Safe Customer Report",
            sql="SELECT id, name, country FROM customers LIMIT 5;",
            chart_type="bar",
            chart_config={"x_axis": "country", "y_axis": "id"},
            user=self.user_a,
        )

        res = self.client.post(f"/api/reports/{rep.id}/refresh/")
        assert res.status_code == 200
        assert res.data["success"] is True
        data = res.data["data"]
        assert "columns" in data
        assert "rows" in data
        assert data["chart_type"] == "bar"

    def test_duplicate_saved_report(self):
        self.client.force_authenticate(user=self.user_a)
        rep = SavedReport.objects.create(
            name="Original Report",
            sql="SELECT id, name FROM customers LIMIT 5;",
            user=self.user_a,
        )

        res = self.client.post(f"/api/reports/{rep.id}/duplicate/")
        assert res.status_code == 201
        assert res.data["data"]["name"] == "Original Report (Copy)"


@pytest.mark.django_db
class TestScheduledReportsAPI:
    """Test scheduled report configurations and execution triggers."""

    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="scheduler@example.com", name="Scheduler", password="pass123")
        import datetime

        from apps.analytics.models import Customer
        Customer.objects.create(name="Acme Inc", email="acme@corp.com", country="USA", signup_date=datetime.date(2026, 1, 1))
        self.report = SavedReport.objects.create(
            name="Daily Executive Report",
            sql="SELECT id, name FROM customers LIMIT 5;",
            user=self.user,
        )

    def test_schedule_crud_and_toggle(self):
        self.client.force_authenticate(user=self.user)
        # Create schedule
        res_create = self.client.post("/api/scheduled-reports/", {
            "report": self.report.id,
            "name": "Every Morning Summary",
            "frequency": "DAILY",
            "time_of_day": "08:00:00",
            "timezone": "UTC",
            "delivery_channel": "IN_APP",
        }, format="json")
        assert res_create.status_code == 201
        sched_id = res_create.data["data"]["id"]

        # Toggle Active
        res_toggle = self.client.post(f"/api/scheduled-reports/{sched_id}/toggle-active/")
        assert res_toggle.status_code == 200
        assert res_toggle.data["data"]["is_active"] is False

    def test_trigger_now_executes_and_logs(self):
        self.client.force_authenticate(user=self.user)
        schedule = ScheduledReport.objects.create(
            report=self.report,
            name="Test Immediate Trigger",
            frequency="DAILY",
            user=self.user,
        )

        res = self.client.post(f"/api/scheduled-reports/{schedule.id}/trigger-now/")
        assert res.status_code == 200
        assert res.data["data"]["status"] == "SUCCESS"

        # Check execution log in database
        exec_log = ScheduledReportExecution.objects.filter(scheduled_report=schedule).first()
        assert exec_log is not None
        assert exec_log.status == "SUCCESS"
        assert exec_log.row_count >= 1
