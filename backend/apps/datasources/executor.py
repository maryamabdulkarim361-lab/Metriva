"""External database SQL execution engine with read-only safeguards, dialect handling, and memory boundaries."""

import logging
import sys
import time
from typing import Any, Optional

from django.conf import settings
from sqlalchemy import text

from apps.ai_assistant.executor import serialize_cell
from apps.ai_assistant.models import QueryHistory, QueryStatus
from apps.datasources.models import DataSource, DataSourceEngine
from apps.datasources.schema_discovery import _create_scoped_engine, _sanitize_error_message

logger = logging.getLogger(__name__)


class ExternalSQLExecutor:
    """
    Executes validated SQL queries against an external PostgreSQL, MySQL, or SQLite data source
    with dialect-aware read-only enforcement, statement timeouts, and memory limits.
    """

    def __init__(
        self,
        datasource: DataSource,
        max_query_seconds: Optional[int] = None,
        max_rows: Optional[int] = None,
        max_result_size_mb: Optional[int] = None,
    ):
        self.datasource = datasource
        self.max_query_seconds = (
            max_query_seconds
            if max_query_seconds is not None
            else getattr(settings, "MAX_QUERY_SECONDS", 10)
        )
        self.max_rows = (
            max_rows if max_rows is not None else getattr(settings, "MAX_ROWS", 1000)
        )
        self.max_result_size_mb = (
            max_result_size_mb
            if max_result_size_mb is not None
            else getattr(settings, "MAX_RESULT_SIZE_MB", 5)
        )
        self.max_bytes = self.max_result_size_mb * 1024 * 1024

    def execute(self, sql: str, question: str = "", user=None) -> dict[str, Any]:
        """
        Execute read-only SQL query on the external data source.
        Returns standardized execution dictionary.
        """
        start_time = time.perf_counter()
        engine = None
        timeout_ms = int(self.max_query_seconds * 1000)

        # 0. Target Safety & SSRF Validation
        from apps.datasources.target_validator import validate_datasource_target

        validate_datasource_target(
            engine_type=self.datasource.engine,
            host=self.datasource.host,
            port=self.datasource.port,
            database_name=self.datasource.database_name,
            username=self.datasource.username,
        )

        try:
            url = self.datasource.get_sqlalchemy_url()
            engine = _create_scoped_engine(url, self.datasource.engine)

            with engine.connect() as conn:
                with conn.begin():
                    # 1. Apply Dialect-Specific Read-Only and Timeout Safeguards
                    if self.datasource.engine == DataSourceEngine.POSTGRESQL:
                        conn.execute(text(f"SET LOCAL statement_timeout = {timeout_ms};"))
                        conn.execute(text("SET TRANSACTION READ ONLY;"))
                    elif self.datasource.engine == DataSourceEngine.MYSQL:
                        try:
                            conn.execute(text("SET SESSION TRANSACTION READ ONLY;"))
                        except Exception:
                            pass
                        try:
                            conn.execute(text(f"SET max_execution_time = {timeout_ms};"))
                        except Exception:
                            pass

                    # 2. Execute Query
                    result_proxy = conn.execute(text(sql))
                    columns = list(result_proxy.keys())

                    # 3. Fetch rows up to max_rows boundary
                    raw_rows = result_proxy.fetchmany(self.max_rows)

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            # 4. Serialize cells with memory footprint check
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
                "datasource_id": self.datasource.id,
                "datasource_name": self.datasource.name,
                "engine": self.datasource.engine,
                "query_history_id": history.id,
            }

        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            raw_err = str(exc)
            clean_err = _sanitize_error_message(raw_err, self.datasource.get_password())

            status_val = (
                QueryStatus.TIMEOUT if "timeout" in clean_err.lower() else QueryStatus.FAILED
            )

            history = QueryHistory.objects.create(
                user=user if user and user.is_authenticated else None,
                natural_language_question=question,
                generated_sql=sql,
                execution_status=status_val,
                execution_time_ms=elapsed_ms,
                row_count=0,
                error_message=clean_err,
            )

            logger.error(
                f"External SQL Execution Error [{self.datasource.name}]: {clean_err} ({elapsed_ms}ms)"
            )
            return {
                "success": False,
                "sql": sql,
                "error": clean_err,
                "columns": [],
                "rows": [],
                "row_count": 0,
                "execution_time_ms": elapsed_ms,
                "datasource_id": self.datasource.id,
                "datasource_name": self.datasource.name,
                "engine": self.datasource.engine,
                "query_history_id": history.id,
            }
        finally:
            if engine is not None:
                engine.dispose()
