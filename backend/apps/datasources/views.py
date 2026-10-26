"""API endpoints for managing external database connections, testing, and schema discovery."""

import logging

from django.db import models
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action

from apps.core.responses import api_error, api_response
from apps.datasources.models import DataSource
from apps.datasources.schema_discovery import (
    introspect_schema,
    test_connection_params,
    test_datasource,
)
from apps.datasources.serializers import (
    DataSourceSerializer,
    TestConnectionRequestSerializer,
    UpdateAllowedTablesSerializer,
)
from apps.organizations.models import OrganizationMembership, RoleChoices
from apps.organizations.service import resolve_tenant_context

logger = logging.getLogger(__name__)


class DataSourceViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for external data sources with multi-tenant isolation,
    live connection testing, schema discovery, and AI access allowlisting.
    """

    queryset = DataSource.objects.all()
    serializer_class = DataSourceSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_authenticated:
            org, role = resolve_tenant_context(self.request)
            if org:
                # Scoped to active organization, or legacy datasource owned by user
                qs = qs.filter(
                    models.Q(organization=org) | models.Q(organization__isnull=True, user=user)
                )
            elif user.is_staff:
                pass
            else:
                qs = qs.filter(user=user)
        else:
            # Anonymous callers in demo mode only see demo/unassigned data sources
            qs = qs.filter(
                models.Q(user__isnull=True)
                & (models.Q(organization__slug="metriva-demo-org") | models.Q(organization__isnull=True))
            )
        return qs

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method not in permissions.SAFE_METHODS:
            if not request.user or not request.user.is_authenticated:
                self.permission_denied(
                    request,
                    message="Authentication required to modify external data sources.",
                    code="AUTHENTICATION_REQUIRED",
                )

            # If datasource belongs to an organization, check role within that organization
            if obj.organization:
                mem = OrganizationMembership.objects.filter(
                    organization=obj.organization,
                    user=request.user,
                ).first()
                if not mem or (mem.role != RoleChoices.ADMIN and not request.user.is_staff):
                    self.permission_denied(
                        request,
                        message="Only organization Administrators can modify this data source.",
                        code="ADMIN_REQUIRED",
                    )
            elif obj.user and obj.user != request.user and not request.user.is_staff:
                self.permission_denied(
                    request,
                    message="You do not have permission to modify this data source.",
                    code="FORBIDDEN",
                )
            elif obj.user is None and not request.user.is_staff:
                self.permission_denied(
                    request,
                    message="System data sources can only be modified by administrators.",
                    code="ADMIN_REQUIRED",
                )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return api_response(data=serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return api_response(data=serializer.data)

    def create(self, request, *args, **kwargs):
        if request.user and request.user.is_authenticated:
            org, role = resolve_tenant_context(request)
            if org and role != RoleChoices.ADMIN and not request.user.is_staff:
                return api_error(
                    message="Only organization Administrators can register external database connections.",
                    code="ADMIN_REQUIRED",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return api_error(
                message="Invalid data source payload.",
                code="VALIDATION_ERROR",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        instance = serializer.save()

        # Automatically attempt initial schema sync if active
        try:
            introspect_schema(instance)
            instance.refresh_from_db()
        except Exception as exc:
            logger.warning(f"Initial schema discovery warning for {instance.name}: {exc}")

        return api_response(
            data=self.get_serializer(instance).data,
            message="Data source registered successfully.",
            status_code=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            return api_error(
                message="Invalid update payload.",
                code="VALIDATION_ERROR",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        updated = serializer.save()
        return api_response(
            data=self.get_serializer(updated).data,
            message="Data source updated successfully.",
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.name
        instance.delete()
        return api_response(
            data={"id": kwargs.get("pk"), "name": name},
            message=f"Data source '{name}' deleted successfully.",
        )

    @action(detail=True, methods=["post"], url_path="test")
    def test_existing(self, request, pk=None):
        """Test connectivity of a saved data source."""
        instance = self.get_object()
        result = test_datasource(instance)
        if not result["success"]:
            return api_error(
                message=result["message"],
                code=result.get("code", "CONNECTION_FAILED"),
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        return api_response(data=result, message=result["message"])

    @action(detail=False, methods=["post"], url_path="test-raw")
    def test_raw(self, request):
        """Test connectivity of raw parameters from connection form before saving."""
        if request.user and request.user.is_authenticated:
            org, role = resolve_tenant_context(request)
            if org and role != RoleChoices.ADMIN and not request.user.is_staff:
                return api_error(
                    message="Only organization Administrators can test raw database connections.",
                    code="ADMIN_REQUIRED",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

        serializer = TestConnectionRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error(
                message="Invalid connection parameters.",
                code="VALIDATION_ERROR",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        vd = serializer.validated_data
        result = test_connection_params(
            engine_type=vd["engine"],
            host=vd["host"],
            port=vd["port"],
            database_name=vd["database_name"],
            username=vd["username"],
            password=vd.get("password", ""),
            ssl_mode=vd.get("ssl_mode", "prefer"),
        )
        if not result["success"]:
            return api_error(
                message=result["message"],
                code=result.get("code", "CONNECTION_FAILED"),
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        return api_response(data=result, message=result["message"])

    @action(detail=True, methods=["post"], url_path="refresh-schema")
    def refresh_schema(self, request, pk=None):
        """Trigger schema introspection and refresh cached metadata."""
        instance = self.get_object()
        try:
            schema_data = introspect_schema(instance)
            return api_response(
                data=schema_data,
                message=f"Discovered {schema_data.get('table_count', 0)} tables successfully.",
            )
        except Exception as exc:
            return api_error(
                message=str(exc),
                code="SCHEMA_DISCOVERY_FAILED",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["patch"], url_path="allowed-tables")
    def update_allowed_tables(self, request, pk=None):
        """Update permitted schemas and tables exposed to AI query engine."""
        instance = self.get_object()
        serializer = UpdateAllowedTablesSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error(
                message="Invalid allowed tables configuration.",
                code="VALIDATION_ERROR",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        instance.allowed_tables = serializer.validated_data["allowed_tables"]
        if "allowed_schemas" in serializer.validated_data:
            instance.allowed_schemas = serializer.validated_data["allowed_schemas"]
        instance.save(update_fields=["allowed_tables", "allowed_schemas", "updated_at"])

        return api_response(
            data=DataSourceSerializer(instance).data,
            message="Permitted tables updated successfully.",
        )
