"""Tests for SQLExecutor and QueryHistory logging."""

from datetime import date

import pytest

from apps.ai_assistant.executor import SQLExecutor
from apps.ai_assistant.models import QueryHistory, QueryStatus
from apps.analytics.models import Customer, CustomerSegment


@pytest.mark.django_db
class TestSQLExecutor:
    def setup_method(self):
        self.executor = SQLExecutor(max_query_seconds=5)
        # Create sample customer
        Customer.objects.create(
            name="Alice Corp",
            email="alice@corp.com",
            country="United States",
            signup_date=date(2025, 1, 1),
            customer_segment=CustomerSegment.ENTERPRISE,
        )

    def test_execute_valid_query(self):
        sql = "SELECT id, name, email FROM customers WHERE email = 'alice@corp.com' LIMIT 1;"
        res = self.executor.execute(sql=sql, question="Find Alice")
        assert res["success"] is True
        assert res["row_count"] == 1
        assert "name" in res["columns"]
        assert res["rows"][0][1] == "Alice Corp"
        assert res["execution_time_ms"] > 0

        # QueryHistory audit record check
        history_id = res["query_history_id"]
        entry = QueryHistory.objects.get(id=history_id)
        assert entry.execution_status == QueryStatus.SUCCESS
        assert entry.row_count == 1
        assert entry.natural_language_question == "Find Alice"

    def test_execute_syntax_error(self):
        bad_sql = "SELECT NON_EXISTENT_COLUMN_XYZ FROM customers;"
        res = self.executor.execute(sql=bad_sql, question="Bad query")
        assert res["success"] is False
        assert "error" in res

        # Verify failure logged in audit table
        history_id = res["query_history_id"]
        entry = QueryHistory.objects.get(id=history_id)
        assert entry.execution_status == QueryStatus.FAILED
        assert entry.error_message is not None

    def test_execute_result_size_limit_enforced(self):
        # Instantiate executor with zero MB byte limit to trigger boundary check
        small_limit_executor = SQLExecutor(max_result_size_mb=0)
        sql = "SELECT id, name, email FROM customers LIMIT 1;"
        res = small_limit_executor.execute(sql=sql, question="Exceed memory test")
        assert res["success"] is False
        assert "exceeded maximum allowed memory limit" in res["error"]

        history_id = res["query_history_id"]
        entry = QueryHistory.objects.get(id=history_id)
        assert entry.execution_status == QueryStatus.FAILED
        assert "exceeded maximum allowed memory limit" in entry.error_message
