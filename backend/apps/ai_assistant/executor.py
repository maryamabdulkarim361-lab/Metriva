"""Database SQL execution engine with read-only safeguards, resource boundaries, and telemetry."""

import logging
import re
import sys
import time
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from django.conf import settings
from django.db import connection, transaction

from apps.ai_assistant.models import QueryHistory, QueryStatus

logger = logging.getLogger(__name__)


def serialize_cell(val: Any) -> Any:
    """Safely convert database types to JSON-serializable primitives."""
    if isinstance(val, Decimal):
        return float(val)
    elif isinstance(val, (datetime, date)):
        return val.isoformat()
    elif isinstance(val, UUID):
        return str(val)
    elif isinstance(val, memoryview):
        return bytes(val).hex()
    return val


class SQLExecutor:
    """Executes validated SQL queries with timeout, memory limits, and read-only isolation."""

    def __init__(
        self,
        max_query_seconds: Optional[int] = None,
        max_rows: Optional[int] = None,
        max_result_size_mb: Optional[int] = None,
    ):
        self.max_query_seconds = (
            max_query_seconds if max_query_seconds is not None else getattr(settings, "MAX_QUERY_SECONDS", 10)
        )
        self.max_rows = (
            max_rows if max_rows is not None else getattr(settings, "MAX_ROWS", 1000)
        )
        self.max_result_size_mb = (
            max_result_size_mb if max_result_size_mb is not None else getattr(settings, "MAX_RESULT_SIZE_MB", 5)
        )
        self.max_bytes = self.max_result_size_mb * 1024 * 1024

    def execute(
        self,
        sql: str,
        question: str,
        user=None,
        organization=None,
        datasource=None,
    ) -> dict[str, Any]:
        """
        Execute read-only SQL query and record telemetry.

        Returns:
            Dict containing columns, rows, execution_time_ms, row_count, query_history_id.
        """
        is_postgres = connection.vendor == "postgresql"
        start_time = time.perf_counter()

        # If running under non-PostgreSQL engine (e.g. local SQLite test runner),
        # adapt PG-specific typecast tokens safely using regex
        executable_sql = sql
        if not is_postgres:
            executable_sql = re.sub(r"::\s*numeric\b", "", executable_sql, flags=re.IGNORECASE)
            executable_sql = re.sub(r"::\s*date\b", "", executable_sql, flags=re.IGNORECASE)

        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    # Enforce PostgreSQL specific execution boundaries
                    if is_postgres:
                        timeout_ms = int(self.max_query_seconds * 1000)
                        cursor.execute(f"SET LOCAL statement_timeout = {timeout_ms};")
                        cursor.execute("SET TRANSACTION READ ONLY;")

                    cursor.execute(executable_sql)
                    columns = [col[0] for col in cursor.description] if cursor.description else []

                    # Fetch rows up to max_rows boundary
                    raw_rows = cursor.fetchmany(self.max_rows)

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            # Serialize cells while verifying byte size boundary
            serialized_rows = []
            approx_bytes = 0

            for r in raw_rows:
                row_cells = []
                for cell in r:
                    ser_val = serialize_cell(cell)
                    approx_bytes += sys.getsizeof(ser_val)
                    row_cells.append(ser_val)
                serialized_rows.append(row_cells)

                if approx_bytes > self.max_bytes:
                    raise ValueError(
                        f"Query result size exceeded maximum allowed memory limit of {self.max_result_size_mb} MB."
                    )

            row_count = len(serialized_rows)

            history = QueryHistory.objects.create(
                user=user if user and user.is_authenticated else None,
                organization=organization,
                datasource=datasource,
                natural_language_question=question,
                generated_sql=sql,
                execution_status=QueryStatus.SUCCESS,
                execution_time_ms=elapsed_ms,
                row_count=row_count,
            )

            return {
                "success": True,
                "sql": sql,
                "columns": columns,
                "rows": serialized_rows,
                "row_count": row_count,
                "execution_time_ms": elapsed_ms,
                "query_history_id": history.id,
            }

        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            err_str = str(exc)
            status = QueryStatus.TIMEOUT if "timeout" in err_str.lower() else QueryStatus.FAILED

            history = QueryHistory.objects.create(
                user=user if user and user.is_authenticated else None,
                organization=organization,
                datasource=datasource,
                natural_language_question=question,
                generated_sql=sql,
                execution_status=status,
                execution_time_ms=elapsed_ms,
                row_count=0,
                error_message=err_str,
            )

            logger.error(f"SQL Execution Error: {err_str} (Execution time: {elapsed_ms}ms)")
            return {
                "success": False,
                "sql": sql,
                "error": err_str,
                "execution_time_ms": elapsed_ms,
                "query_history_id": history.id,
            }
