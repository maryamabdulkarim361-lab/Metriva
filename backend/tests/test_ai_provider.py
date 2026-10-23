"""Tests for AI provider abstractions and mock implementations."""

import pytest

from apps.ai_assistant.providers import get_llm_provider
from apps.ai_assistant.providers.mock_provider import MockProvider
from apps.ai_assistant.providers.openai_provider import OpenAIProvider


class TestAIProviders:
    def test_mock_provider_top_customers(self):
        provider = MockProvider()
        sql = provider.generate_sql("Show me the top 10 customers by revenue", "")
        assert "SELECT" in sql
        assert "customers" in sql
        assert "orders" in sql
        assert "LIMIT 10" in sql

    def test_mock_provider_monthly_revenue(self):
        provider = MockProvider()
        sql = provider.generate_sql("What was our monthly revenue in 2026?", "")
        assert "SELECT" in sql
        assert "orders" in sql
        assert "sales_month" in sql

    def test_mock_provider_products(self):
        provider = MockProvider()
        sql = provider.generate_sql("Which products generated the most revenue?", "")
        assert "products" in sql
        assert "order_items" in sql

    def test_mock_provider_explanation(self):
        provider = MockProvider()
        explanation = provider.explain_result(
            question="Top 10 customers",
            sql="SELECT name, total_revenue FROM customers LIMIT 10",
            columns=["customer_name", "total_revenue"],
            rows=[["Acme Corp", 54000.00], ["Beta LLC", 32000.00]],
            row_count=2,
        )
        assert "Acme Corp" in explanation
        assert "54000" in explanation or "54000.0" in explanation
        assert "Business Summary" in explanation

    def test_factory_returns_mock_when_no_api_key(self, monkeypatch):
        from django.conf import settings
        monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
        provider = get_llm_provider()
        assert isinstance(provider, MockProvider)

    def test_openai_provider_raises_without_key(self):
        with pytest.raises(ValueError, match="OPENAI_API_KEY is not configured"):
            OpenAIProvider(api_key="")
