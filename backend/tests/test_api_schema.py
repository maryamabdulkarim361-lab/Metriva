"""Tests for Schema metadata and explorer endpoints."""

import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestSchemaAPI:
    def setup_method(self):
        self.client = APIClient()

    def test_schema_explorer_endpoint(self):
        res = self.client.get("/api/schema/")
        assert res.status_code == 200
        assert res.data["success"] is True
        data = res.data["data"]
        assert "tables" in data
        assert "relationships" in data
        assert "allowed_tables" in data

        table_names = [t["name"] for t in data["tables"]]
        assert "customers" in table_names
        assert "products" in table_names
        assert "orders" in table_names
        assert "order_items" in table_names
        assert "payments" in table_names
        assert "website_events" in table_names

        # Verify sensitive tables are NOT exposed in allowed_tables
        assert "auth_permission" not in data["allowed_tables"]
        assert "django_migrations" not in data["allowed_tables"]

