"""Tests for Dashboard and Analytics endpoints."""

import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestDashboardAPI:
    def setup_method(self):
        self.client = APIClient()

    def test_dashboard_summary_structure(self):
        res = self.client.get("/api/dashboard/")
        assert res.status_code == 200
        assert res.data["success"] is True
        data = res.data["data"]
        assert "kpis" in data
        assert "total_customers" in data["kpis"]
        assert "total_revenue" in data["kpis"]
        assert "revenue_by_month" in data
        assert "revenue_by_country" in data
        assert "order_status_distribution" in data

    def test_revenue_analytics_endpoint(self):
        res = self.client.get("/api/analytics/revenue/")
        assert res.status_code == 200
        assert res.data["success"] is True
        assert isinstance(res.data["data"], list)

    def test_customer_segmentation_analytics_endpoint(self):
        res = self.client.get("/api/analytics/customers/")
        assert res.status_code == 200
        assert res.data["success"] is True

    def test_product_performance_analytics_endpoint(self):
        res = self.client.get("/api/analytics/products/")
        assert res.status_code == 200
        assert res.data["success"] is True
