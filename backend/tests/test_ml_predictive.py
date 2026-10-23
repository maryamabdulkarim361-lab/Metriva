"""Unit and integration tests for Predictive Analytics, Machine Learning pipelines, and Model Registry."""

import datetime
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.analytics.models import Customer, Order, OrderItem, Product
from apps.ml.engine.anomaly import run_anomaly_detection_scan
from apps.ml.engine.churn import train_and_evaluate_churn_model
from apps.ml.engine.forecasting import train_and_forecast_revenue
from apps.ml.engine.insights import generate_ml_business_insights
from apps.ml.engine.runner import trigger_ml_job
from apps.ml.models import MLModel, MLModelType, MLModelVersion

User = get_user_model()


@pytest.fixture(autouse=True)
def seed_ml_test_dataset(db):
    """Seed historical customers, products, and orders across multiple periods for ML tests."""
    # 1. Customers
    c1 = Customer.objects.create(name="Alpha Corp", email="alpha@corp.com", country="USA", signup_date=datetime.date(2025, 1, 1), customer_segment="ENTERPRISE")
    c2 = Customer.objects.create(name="Beta LLC", email="beta@llc.com", country="UK", signup_date=datetime.date(2025, 2, 1), customer_segment="SMB")
    c3 = Customer.objects.create(name="Gamma Inc", email="gamma@inc.com", country="Germany", signup_date=datetime.date(2025, 3, 1), customer_segment="ENTERPRISE")
    c4 = Customer.objects.create(name="Delta Store", email="delta@store.com", country="USA", signup_date=datetime.date(2025, 4, 1), customer_segment="CONSUMER")
    c5 = Customer.objects.create(name="Epsilon Ltd", email="epsilon@ltd.com", country="Canada", signup_date=datetime.date(2025, 5, 1), customer_segment="CONSUMER")
    c6 = Customer.objects.create(name="Zeta Co", email="zeta@co.com", country="USA", signup_date=datetime.date(2025, 6, 1), customer_segment="SMB")

    # 2. Products
    p1 = Product.objects.create(name="Cloud Platform Pro", category="Software", price=Decimal("500.00"), cost=Decimal("50.00"), stock_quantity=100)
    Product.objects.create(name="Analytics Addon", category="Software", price=Decimal("200.00"), cost=Decimal("20.00"), stock_quantity=100)

    # 3. Monthly Orders across 8 consecutive months (2025-06 through 2026-01)
    customers = [c1, c2, c3, c4, c5, c6]
    amounts = [1200.0, 1500.0, 1800.0, 2200.0, 2600.0, 3100.0, 3500.0, 4200.0]

    for month_idx, amt in enumerate(amounts):
        m = month_idx + 6
        year = 2025 if m <= 12 else 2026
        month_num = m if m <= 12 else m - 12
        order_dt = datetime.datetime(year, month_num, 15, 12, 0, 0, tzinfo=datetime.timezone.utc)

        cust = customers[month_idx % len(customers)]
        ord_obj = Order.objects.create(
            customer=cust,
            order_date=order_dt,
            status="COMPLETED",
            total_amount=Decimal(str(amt)),
        )
        OrderItem.objects.create(
            order=ord_obj,
            product=p1,
            quantity=2,
            unit_price=Decimal(str(amt / 2)),
            subtotal=Decimal(str(amt)),
        )

    # Add a few cancelled orders
    Order.objects.create(
        customer=c1,
        order_date=datetime.datetime(2026, 1, 20, 12, 0, 0, tzinfo=datetime.timezone.utc),
        status="CANCELLED",
        total_amount=Decimal("300.00"),
    )


@pytest.mark.django_db
class TestRevenueForecasting:
    """Test time-series revenue forecasting, backtesting metrics, and intervals."""

    def test_forecast_execution_and_structure(self):
        res = train_and_forecast_revenue(aggregation="monthly", forecast_horizon=3)
        assert res["success"] is True
        assert res["forecast_horizon"] == 3
        assert len(res["forecast_data"]) == 3

        # Check prediction intervals (upper >= forecast >= lower >= 0)
        for pt in res["forecast_data"]:
            assert pt["forecast"] >= 0
            assert pt["prediction_interval_upper"] >= pt["forecast"]
            assert pt["prediction_interval_lower"] <= pt["forecast"]
            assert pt["prediction_interval_lower"] >= 0

        # Check evaluation metrics
        metrics = res["evaluation_metrics"]
        assert "mae" in metrics
        assert "rmse" in metrics
        assert metrics["mae"] >= 0
        assert metrics["rmse"] >= 0

        # Check baseline comparison
        baseline = res["baseline_comparison"]
        assert "baseline_mae" in baseline
        assert "outperforms_baseline" in baseline


@pytest.mark.django_db
class TestCustomerChurnPrediction:
    """Test leakage prevention, RFM feature extraction, and risk classification."""

    def test_churn_training_and_evaluation(self):
        res = train_and_evaluate_churn_model(inactivity_days=60)
        assert res["success"] is True
        assert res["total_cohort_customers"] >= 5

        # Check evaluation metrics on holdout test set
        metrics = res["evaluation_metrics"]
        assert 0.0 <= metrics["accuracy"] <= 1.0
        assert 0.0 <= metrics["f1_score"] <= 1.0
        assert "confusion_matrix" in metrics

        # Check customer risk scores & explainability
        assert len(res["top_at_risk_customers"]) > 0
        top_cust = res["top_at_risk_customers"][0]
        assert 0.0 <= top_cust["churn_probability"] <= 1.0
        assert 0.0 <= top_cust["risk_score"] <= 100.0
        assert top_cust["risk_level"] in ("LOW", "MEDIUM", "HIGH")
        assert "primary_drivers" in top_cust


@pytest.mark.django_db
class TestAnomalyDetection:
    """Test metric anomaly detection with historical baselines and alert generation."""

    def test_anomaly_scan_execution(self):
        res = run_anomaly_detection_scan(z_threshold=1.5, persist_alerts=True)
        assert res["success"] is True
        assert res["scanned_days"] >= 5
        assert "metric_baselines" in res
        assert "revenue" in res["metric_baselines"]
        assert "order_volume" in res["metric_baselines"]


@pytest.mark.django_db
class TestMLInsightsLayer:
    """Test AI Business Insights synthesizing verified forecasts and churn estimates."""

    def test_insights_generation(self):
        res = generate_ml_business_insights()
        assert res["success"] is True
        summary = res["executive_summary"]
        assert "observed_historical_facts" in summary
        assert "predictive_estimates" in summary
        assert "statistical_associations" in summary
        assert "investigation_hypotheses" in summary


@pytest.mark.django_db
class TestMLModelRegistryAndJobs:
    """Test model versioning, approval workflows, and background job execution."""

    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email="mle@example.com", name="MLE", password="pass")

    def test_background_job_execution(self):
        # Trigger job synchronously for test predictability
        job = trigger_ml_job(
            job_type="TRAIN_FORECAST",
            parameters={"aggregation": "monthly", "forecast_horizon": 2},
            user=self.user,
            run_async=False,
        )
        job.refresh_from_db()
        assert job.status == "SUCCESS"
        assert job.progress_pct == 100
        assert "model_version" in job.result_summary

        # Model should now exist in registry
        model = MLModel.objects.get(name="Revenue Time-Series Forecaster")
        assert model.versions.count() >= 1

    def test_approve_model_version_api(self):
        self.client.force_authenticate(user=self.user)
        model = MLModel.objects.create(name="Churn Prod Model", model_type=MLModelType.CHURN_PREDICTION)
        v1 = MLModelVersion.objects.create(model=model, version="1.0.0", approval_status="EVALUATED", is_active=False)
        v2 = MLModelVersion.objects.create(model=model, version="1.0.1", approval_status="EVALUATED", is_active=False)

        res = self.client.post(f"/api/ml/models/{model.id}/approve-version/", {"version_id": v2.id}, format="json")
        assert res.status_code == 200

        v1.refresh_from_db()
        v2.refresh_from_db()
        assert v2.is_active is True
        assert v2.approval_status == "APPROVED"
        assert v1.is_active is False
