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

        org, role = None, None
        if request.user and request.user.is_authenticated:
            from apps.organizations.models import RoleChoices
            from apps.organizations.service import resolve_tenant_context

            org, role = resolve_tenant_context(request)
            if org and role == RoleChoices.VIEWER and not request.user.is_staff:
                return api_error(
                    message="Arbitrary AI queries are restricted for Viewers. Please view pre-authorized dashboards and reports.",
                    code="VIEWER_QUERY_RESTRICTED",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

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
                if org:
                    ds_qs = ds_qs.filter(
                        Q(organization=org) | Q(organization__isnull=True, user=request.user)
                    )
                elif not request.user.is_staff:
                    ds_qs = ds_qs.filter(Q(user=request.user) | Q(user__isnull=True))
            else:
                ds_qs = ds_qs.filter(user__isnull=True, organization__isnull=True)

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
        inference_cols = None
        schema_cols = None
        if role != "ADMIN" and org:
            from apps.organizations.masking_service import DataMaskingService

            policies = DataMaskingService.get_column_policy_map(org)
            inference_cols = {
                p.match_pattern.lower() for p in policies if p.match_type == "EXACT"
            } | {"email", "phone"}
            if datasource and datasource.cached_schema:
                schema_cols = {
                    t["name"].lower(): [c["name"].lower() for c in t.get("columns", [])]
                    for t in datasource.cached_schema.get("tables", [])
                }

        validation = validator.validate(
            raw_sql,
            allowed_tables=allowed_tables,
            dialect=dialect,
            inference_restricted_columns=inference_cols,
            schema_columns=schema_cols,
        )

        if not validation.is_valid:
            # Audit blocked attempt
            QueryHistory.objects.create(
                user=request.user if request.user.is_authenticated else None,
                organization=org,
                datasource=datasource,
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
                organization=org,
            )
        else:
            executor = SQLExecutor()
            exec_result = executor.execute(
                sql=sanitized_sql,
                question=question,
                user=request.user,
                organization=org,
                datasource=None,
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

        # Apply column masking for non-admins
        from apps.organizations.masking_service import DataMaskingService

        final_rows = DataMaskingService.mask_result_set(
            columns=exec_result["columns"],
            rows=exec_result["rows"],
            organization=org,
            user_role=role,
        )

        return api_response(
            data={
                "question": question,
                "sql": sanitized_sql,
                "columns": exec_result["columns"],
                "rows": final_rows,
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

        org, role = None, None
        if request.user and request.user.is_authenticated:
            from apps.organizations.models import RoleChoices
            from apps.organizations.service import resolve_tenant_context

            org, role = resolve_tenant_context(request)
            if org and role == RoleChoices.VIEWER and not request.user.is_staff:
                return api_error(
                    message="Direct SQL execution is restricted to Analysts and Administrators.",
                    code="DIRECT_SQL_RESTRICTED",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

        datasource = None
        dialect = "postgresql"
        allowed_tables = None

        if data_source_id:
            from django.db.models import Q

            from apps.datasources.models import DataSource
            from apps.datasources.schema_discovery import get_datasource_schema_context

            ds_qs = DataSource.objects.filter(id=data_source_id, is_active=True)
            if request.user.is_authenticated:
                if org:
                    ds_qs = ds_qs.filter(
                        Q(organization=org) | Q(organization__isnull=True, user=request.user)
                    )
                elif not request.user.is_staff:
                    ds_qs = ds_qs.filter(Q(user=request.user) | Q(user__isnull=True))
            else:
                ds_qs = ds_qs.filter(user__isnull=True, organization__isnull=True)

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
        inference_cols = None
        schema_cols = None
        if role != "ADMIN" and org:
            from apps.organizations.masking_service import DataMaskingService

            policies = DataMaskingService.get_column_policy_map(org)
            inference_cols = {
                p.match_pattern.lower() for p in policies if p.match_type == "EXACT"
            } | {"email", "phone"}
            if datasource and datasource.cached_schema:
                schema_cols = {
                    t["name"].lower(): [c["name"].lower() for c in t.get("columns", [])]
                    for t in datasource.cached_schema.get("tables", [])
                }

        validation = validator.validate(
            raw_sql,
            allowed_tables=allowed_tables,
            dialect=dialect,
            inference_restricted_columns=inference_cols,
            schema_columns=schema_cols,
        )
        if not validation.is_valid:
            QueryHistory.objects.create(
                user=request.user if request.user.is_authenticated else None,
                organization=org,
                datasource=datasource,
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
                organization=org,
            )
        else:
            executor = SQLExecutor()
            result = executor.execute(
                sql=validation.sanitized_sql,
                question=question,
                user=request.user,
                organization=org,
                datasource=None,
            )

        if not result["success"]:
            return api_error(
                message=f"Database execution failed: {result.get('error')}",
                code="EXECUTION_ERROR",
                details={"sql": validation.sanitized_sql} if settings.DEBUG else {},
            )

        # Apply column masking for non-admins
        from apps.organizations.masking_service import DataMaskingService

        final_rows = DataMaskingService.mask_result_set(
            columns=result["columns"],
            rows=result["rows"],
            organization=org,
            user_role=role,
        )

        return api_response(
            data={
                "sql": validation.sanitized_sql,
                "columns": result["columns"],
                "rows": final_rows,
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
        if user.is_authenticated:
            from apps.organizations.models import RoleChoices
            from apps.organizations.service import resolve_tenant_context

            org, role = resolve_tenant_context(self.request)
            if org:
                if role == RoleChoices.ADMIN or user.is_staff:
                    qs = qs.filter(organization=org)
                else:
                    qs = qs.filter(organization=org, user=user)
            elif not user.is_staff:
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
        from django.db import models

        from apps.datasources.models import DataSource
        from apps.datasources.schema_discovery import introspect_schema
        from apps.organizations.service import resolve_tenant_context

        org, role = resolve_tenant_context(request)
        datasource_id = request.query_params.get("datasource_id")
        is_sample_requested = request.query_params.get("sample", "").lower() == "true"
        is_demo_org = bool(org and org.slug == "metriva-demo-org")

        # 1. If explicit datasource_id provided, verify tenant authorization
        if datasource_id:
            try:
                ds_id = int(datasource_id)
            except (ValueError, TypeError):
                return api_error(
                    message="Invalid datasource ID.",
                    code="INVALID_DATASOURCE_ID",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            ds_qs = DataSource.objects.filter(id=ds_id, is_active=True)
            if request.user.is_authenticated:
                if org:
                    ds_qs = ds_qs.filter(
                        models.Q(organization=org)
                        | models.Q(organization__isnull=True, user=request.user)
                    )
                elif not request.user.is_staff:
                    ds_qs = ds_qs.filter(
                        models.Q(user=request.user) | models.Q(user__isnull=True)
                    )
            else:
                ds_qs = ds_qs.filter(user__isnull=True, organization__isnull=True)

            datasource = ds_qs.first()
            if not datasource:
                return api_error(
                    message=f"Data source with ID {ds_id} was not found or access is unauthorized.",
                    code="DATA_SOURCE_NOT_FOUND",
                    status_code=status.HTTP_404_NOT_FOUND,
                )

            schema = datasource.cached_schema or introspect_schema(datasource)
            tables = schema.get("tables", [])
            return api_response(
                data={
                    "has_connected_datasources": True,
                    "is_sample_schema": False,
                    "datasource_id": datasource.id,
                    "datasource_name": datasource.name,
                    "engine": datasource.engine,
                    "database_name": datasource.database_name,
                    "table_count": schema.get("table_count", len(tables)),
                    "total_columns": schema.get(
                        "total_columns", sum(len(t.get("columns", [])) for t in tables)
                    ),
                    "tables": tables,
                    "er_diagram": schema.get("er_diagram", []),
                    "relationships": schema.get("relationships", []),
                    "allowed_tables": datasource.allowed_tables or [],
                }
            )

        # 2. No datasource_id specified: check active organization's connected datasources
        active_dss = []
        if request.user.is_authenticated and org:
            active_dss = list(
                DataSource.objects.filter(organization=org, is_active=True)
            )

        if active_dss:
            primary_ds = active_dss[0]
            schema = primary_ds.cached_schema or introspect_schema(primary_ds)
            tables = schema.get("tables", [])
            return api_response(
                data={
                    "has_connected_datasources": True,
                    "is_sample_schema": False,
                    "datasource_id": primary_ds.id,
                    "datasource_name": primary_ds.name,
                    "engine": primary_ds.engine,
                    "database_name": primary_ds.database_name,
                    "table_count": schema.get("table_count", len(tables)),
                    "total_columns": schema.get(
                        "total_columns", sum(len(t.get("columns", [])) for t in tables)
                    ),
                    "tables": tables,
                    "er_diagram": schema.get("er_diagram", []),
                    "relationships": schema.get("relationships", []),
                    "allowed_tables": primary_ds.allowed_tables or [],
                }
            )

        # 3. Organization has 0 connected datasources and did not ask for sample schema:
        if (
            request.user.is_authenticated
            and not is_sample_requested
            and not is_demo_org
        ):
            return api_response(
                data={
                    "has_connected_datasources": False,
                    "is_sample_schema": False,
                    "datasource_id": None,
                    "datasource_name": None,
                    "engine": None,
                    "database_name": "None",
                    "table_count": 0,
                    "total_columns": 0,
                    "tables": [],
                    "er_diagram": [],
                    "relationships": [],
                    "allowed_tables": [],
                }
            )

        # 4. Fallback for sample demo schema or demo org or anonymous public demo
        metadata = get_schema_metadata()
        return api_response(
            data={
                "has_connected_datasources": False,
                "is_sample_schema": True,
                "sample_description": "Synthetic Demo E-Commerce PostgreSQL Schema",
                "table_count": metadata.get("table_count", len(metadata.get("tables", []))),
                "total_columns": metadata.get("total_columns", 0),
                "tables": metadata.get("tables", []),
                "er_diagram": metadata.get("er_diagram", []),
                "relationships": metadata.get("relationships", []),
                "allowed_tables": metadata.get("allowed_tables", []),
                "database_name": "metriva_demo",
                "engine": "postgresql",
            }
        )


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
