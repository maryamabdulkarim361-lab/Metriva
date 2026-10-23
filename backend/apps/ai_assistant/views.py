"""API endpoints for AI query generation, security validation, and schema exploration."""

import logging

from django.conf import settings
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.views import APIView

from apps.ai_assistant.executor import SQLExecutor
from apps.ai_assistant.models import QueryHistory, QueryStatus
from apps.ai_assistant.result_explainer import ResultExplainer
from apps.ai_assistant.schema_context import get_schema_metadata
from apps.ai_assistant.serializers import (
    DirectSQLRequestSerializer,
    QueryHistorySerializer,
    QueryRequestSerializer,
)
from apps.ai_assistant.sql_generator import SQLGenerator
from apps.ai_assistant.sql_validator import SQLValidator
from apps.core.responses import api_error, api_response

logger = logging.getLogger(__name__)


class NaturalLanguageQueryView(APIView):
    """
    Main AI query orchestration endpoint:
    Natural Language -> LLM SQL Generation -> SQL Validator -> PostgreSQL Execution -> LLM Explanation
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = QueryRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error(
                message="Invalid query payload.",
                code="VALIDATION_ERROR",
                details=serializer.errors,
            )

        question = serializer.validated_data["question"]
        dry_run = serializer.validated_data.get("dry_run", False)
        data_source_id = serializer.validated_data.get("data_source_id")

        datasource = None
        dialect = "postgresql"
        schema_context = None
        allowed_tables = None

        if data_source_id:
            from django.db.models import Q

            from apps.datasources.executor import ExternalSQLExecutor
            from apps.datasources.models import DataSource
            from apps.datasources.schema_discovery import get_datasource_schema_context

            ds_qs = DataSource.objects.filter(id=data_source_id, is_active=True)
            if request.user.is_authenticated:
                if not request.user.is_staff:
                    ds_qs = ds_qs.filter(Q(user=request.user) | Q(user__isnull=True))
            else:
                ds_qs = ds_qs.filter(user__isnull=True)

            datasource = ds_qs.first()
            if not datasource:
                return api_error(
                    message=f"Data source with ID {data_source_id} was not found, is inactive, or access is unauthorized.",
                    code="DATA_SOURCE_NOT_FOUND",
                    status_code=status.HTTP_404_NOT_FOUND,
                )

            dialect = datasource.engine
            schema_context, allowed_tables = get_datasource_schema_context(datasource)
            if not allowed_tables:
                return api_error(
                    message=f"The data source '{datasource.name}' has no allowed tables configured.",
                    code="NO_ALLOWED_TABLES",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

        # 1. Generate SQL with AI
        try:
            generator = SQLGenerator()
            raw_sql = generator.generate(
                question=question,
                schema_context=schema_context,
                dialect=dialect,
            )
        except Exception as exc:
            logger.exception("AI SQL generation failed")
            err_msg = (
                str(exc)
                if settings.DEBUG
                else "Failed to generate SQL from question due to an internal error."
            )
            return api_error(
                message=err_msg,
                code="AI_GENERATION_FAILED",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # 2. Safety validation & limits enforcement
        validator = SQLValidator()
        validation = validator.validate(
            raw_sql,
            allowed_tables=allowed_tables,
            dialect=dialect,
        )

        if not validation.is_valid:
            # Audit blocked attempt
            QueryHistory.objects.create(
                user=request.user if request.user.is_authenticated else None,
                natural_language_question=question,
                generated_sql=raw_sql,
                execution_status=QueryStatus.BLOCKED,
                error_message=validation.error_message,
            )
            return api_error(
                message=validation.error_message or "The generated query contains an unsafe operation.",
                code=validation.error_code or "UNSAFE_QUERY",
                details={"raw_sql": raw_sql} if settings.DEBUG else {},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        sanitized_sql = validation.sanitized_sql

        # 3. Dry-run mode option (preview only)
        if dry_run:
            return api_response(
                data={
                    "question": question,
                    "sql": sanitized_sql,
                    "is_valid": True,
                    "tables_used": validation.tables_used,
                    "dry_run": True,
                    "datasource_id": datasource.id if datasource else None,
                    "datasource_name": datasource.name if datasource else "Internal Analytics DB",
                },
                message="Query generated and validated successfully without execution.",
            )

        # 4. Read-only Execution (Internal PostgreSQL or External Data Source)
        if datasource:
            from apps.datasources.executor import ExternalSQLExecutor

            executor = ExternalSQLExecutor(datasource)
            exec_result = executor.execute(
                sql=sanitized_sql,
                question=question,
                user=request.user,
            )
        else:
            executor = SQLExecutor()
            exec_result = executor.execute(
                sql=sanitized_sql,
                question=question,
                user=request.user,
            )

        if not exec_result["success"]:
            return api_error(
                message=f"Database execution error: {exec_result.get('error')}",
                code="EXECUTION_ERROR",
                details={"sql": sanitized_sql} if settings.DEBUG else {},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # 5. Result Explanation via AI
        explanation = ""
        try:
            explainer = ResultExplainer()
            explanation = explainer.explain(
                question=question,
                sql=sanitized_sql,
                columns=exec_result["columns"],
                rows=exec_result["rows"],
                row_count=exec_result["row_count"],
            )

            # Update QueryHistory with generated explanation
            if exec_result.get("query_history_id"):
                QueryHistory.objects.filter(id=exec_result["query_history_id"]).update(
                    explanation=explanation
                )
        except Exception as exc:
            logger.warning(f"Could not generate result explanation: {exc}")
            explanation = f"Query executed successfully returning {exec_result['row_count']} rows."

        return api_response(
            data={
                "question": question,
                "sql": sanitized_sql,
                "columns": exec_result["columns"],
                "rows": exec_result["rows"],
                "row_count": exec_result["row_count"],
                "execution_time_ms": exec_result["execution_time_ms"],
                "explanation": explanation,
                "tables_used": validation.tables_used,
                "query_history_id": exec_result.get("query_history_id"),
            }
        )


class DirectSQLExecutionView(APIView):
    """
    Execute direct SQL through security validator (for testing and manual analytics).
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = DirectSQLRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error(
                message="Invalid SQL payload.",
                code="VALIDATION_ERROR",
                details=serializer.errors,
            )

        raw_sql = serializer.validated_data["sql"]
        question = serializer.validated_data.get("question", "Direct SQL Execution")
        data_source_id = serializer.validated_data.get("data_source_id")

        datasource = None
        dialect = "postgresql"
        allowed_tables = None

        if data_source_id:
            from django.db.models import Q

            from apps.datasources.models import DataSource
            from apps.datasources.schema_discovery import get_datasource_schema_context

            ds_qs = DataSource.objects.filter(id=data_source_id, is_active=True)
            if request.user.is_authenticated:
                if not request.user.is_staff:
                    ds_qs = ds_qs.filter(Q(user=request.user) | Q(user__isnull=True))
            else:
                ds_qs = ds_qs.filter(user__isnull=True)

            datasource = ds_qs.first()
            if not datasource:
                return api_error(
                    message=f"Data source with ID {data_source_id} was not found, is inactive, or access is unauthorized.",
                    code="DATA_SOURCE_NOT_FOUND",
                    status_code=status.HTTP_404_NOT_FOUND,
                )

            dialect = datasource.engine
            _, allowed_tables = get_datasource_schema_context(datasource)

        # Validate
        validator = SQLValidator()
        validation = validator.validate(
            raw_sql,
            allowed_tables=allowed_tables,
            dialect=dialect,
        )
        if not validation.is_valid:
            QueryHistory.objects.create(
                user=request.user if request.user.is_authenticated else None,
                natural_language_question=question,
                generated_sql=raw_sql,
                execution_status=QueryStatus.BLOCKED,
                error_message=validation.error_message,
            )
            return api_error(
                message=validation.error_message or "Query failed safety validation.",
                code=validation.error_code or "UNSAFE_QUERY",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if datasource:
            from apps.datasources.executor import ExternalSQLExecutor

            executor = ExternalSQLExecutor(datasource)
            result = executor.execute(
                sql=validation.sanitized_sql,
                question=question,
                user=request.user,
            )
        else:
            executor = SQLExecutor()
            result = executor.execute(
                sql=validation.sanitized_sql,
                question=question,
                user=request.user,
            )

        if not result["success"]:
            return api_error(
                message=f"Database execution failed: {result.get('error')}",
                code="EXECUTION_ERROR",
                details={"sql": validation.sanitized_sql} if settings.DEBUG else {},
            )

        return api_response(
            data={
                "sql": validation.sanitized_sql,
                "columns": result["columns"],
                "rows": result["rows"],
                "row_count": result["row_count"],
                "execution_time_ms": result["execution_time_ms"],
                "query_history_id": result.get("query_history_id"),
            }
        )


class QueryHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """View and re-run previous queries from audit history."""

    queryset = QueryHistory.objects.all()
    serializer_class = QueryHistorySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Admin or staff can view all history; standard users see only their own
        if user.is_authenticated:
            if not user.is_staff:
                qs = qs.filter(user=user)
        else:
            # Anonymous callers are restricted to unassigned demo/anonymous records
            qs = qs.filter(user__isnull=True)

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(execution_status=status_param.upper())
        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return api_response(data=serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return api_response(data=serializer.data)

    @action(detail=True, methods=["post"], url_path="rerun")
    def rerun(self, request, pk=None):
        """Re-run a previously logged query."""
        instance = self.get_object()
        sql = instance.generated_sql

        validator = SQLValidator()
        validation = validator.validate(sql)
        if not validation.is_valid:
            return api_error(
                message="Cannot re-run query: failed validation checks.",
                code="VALIDATION_FAILED",
            )

        executor = SQLExecutor()
        result = executor.execute(
            sql=validation.sanitized_sql,
            question=instance.natural_language_question,
            user=request.user,
        )

        if not result["success"]:
            return api_error(
                message=f"Database execution error: {result.get('error')}",
                code="EXECUTION_ERROR",
                details={"sql": validation.sanitized_sql} if settings.DEBUG else {},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return api_response(
            data={
                "original_id": instance.id,
                "sql": validation.sanitized_sql,
                "columns": result.get("columns", []),
                "rows": result.get("rows", []),
                "row_count": result.get("row_count", 0),
                "execution_time_ms": result.get("execution_time_ms", 0.0),
                "new_history_id": result.get("query_history_id"),
            }
        )


class SchemaExplorerView(APIView):
    """Database schema explorer API exposing tables, columns, relations, and ER graph."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        metadata = get_schema_metadata()
        return api_response(data=metadata)


class AIConfigStatusView(APIView):
    """Returns AI service runtime configuration and status."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        api_key_configured = bool(getattr(settings, "OPENAI_API_KEY", "").strip())
        return api_response(
            data={
                "provider": "openai" if api_key_configured else "mock_demo",
                "model": getattr(settings, "OPENAI_MODEL", "gpt-4o-mini"),
                "api_key_configured": api_key_configured,
                "demo_mode": not api_key_configured,
                "limits": {
                    "max_rows": getattr(settings, "MAX_ROWS", 1000),
                    "max_query_seconds": getattr(settings, "MAX_QUERY_SECONDS", 10),
                    "max_sql_length": getattr(settings, "MAX_SQL_LENGTH", 10000),
                },
            }
        )
