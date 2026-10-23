"""Views and API endpoints for analytics and business data entities."""

from decimal import Decimal

from django.db import models
from django.db.models import Avg, Count, Sum
from django.db.models.functions import TruncMonth
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.views import APIView

from apps.analytics.metrics import get_all_metrics, get_metric
from apps.analytics.models import (
    Customer,
    Order,
    OrderItem,
    Product,
    SavedReport,
    ScheduledReport,
    ScheduledReportExecution,
    WebsiteEvent,
)
from apps.analytics.period_comparisons import calculate_period_comparison
from apps.analytics.serializers import (
    CustomerSerializer,
    OrderSerializer,
    ProductSerializer,
    SavedReportSerializer,
    ScheduledReportSerializer,
    WebsiteEventSerializer,
)
from apps.core.responses import api_error, api_response


class CustomerViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for inspecting and filtering customers."""

    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [permissions.AllowAny]
    search_fields = ["name", "email", "country"]
    filterset_fields = ["customer_segment", "country"]

    def get_queryset(self):
        qs = super().get_queryset()
        segment = self.request.query_params.get("segment")
        country = self.request.query_params.get("country")
        search = self.request.query_params.get("search")

        if segment:
            qs = qs.filter(customer_segment=segment)
        if country:
            qs = qs.filter(country=country)
        if search:
            qs = qs.filter(name__icontains=search) | qs.filter(email__icontains=search)
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


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for inspecting product catalog and inventory."""

    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get("category")
        search = self.request.query_params.get("search")
        if category:
            qs = qs.filter(category=category)
        if search:
            qs = qs.filter(name__icontains=search)
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


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for querying orders and transaction records."""

    queryset = Order.objects.select_related("customer").prefetch_related("items__product").all()
    serializer_class = OrderSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        customer_id = self.request.query_params.get("customer_id")
        status_param = self.request.query_params.get("status")
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        if status_param:
            qs = qs.filter(status=status_param)
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


class WebsiteEventViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for tracking website events."""

    queryset = WebsiteEvent.objects.all()
    serializer_class = WebsiteEventSerializer
    permission_classes = [permissions.AllowAny]

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return api_response(data=serializer.data)


class DashboardSummaryView(APIView):
    """
    Main dashboard KPIs calculated live from PostgreSQL:
    - Total customers
    - Total orders
    - Total revenue
    - Average order value (AOV)
    - Top products
    - Top customers
    - Revenue by month
    - Revenue by country
    - Customer segmentation
    - Order status distribution
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        total_customers = Customer.objects.count()
        total_orders = Order.objects.count()

        # Completed orders revenue & AOV
        completed_orders = Order.objects.filter(status="COMPLETED")
        completed_count = completed_orders.count()
        revenue_agg = completed_orders.aggregate(
            total_revenue=Sum("total_amount"),
            avg_order_value=Avg("total_amount"),
        )
        total_revenue = float(revenue_agg["total_revenue"] or Decimal("0.00"))
        avg_order_value = float(revenue_agg["avg_order_value"] or Decimal("0.00"))

        # Order status distribution
        status_distribution = list(
            Order.objects.values("status").annotate(count=Count("id")).order_by("-count")
        )

        # Customer segmentation breakdown
        customer_segments = list(
            Customer.objects.values("customer_segment")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        # Revenue by country (top 10)
        revenue_by_country = list(
            Customer.objects.filter(orders__status="COMPLETED")
            .values("country")
            .annotate(
                revenue=Sum("orders__total_amount"),
                order_count=Count("orders__id"),
            )
            .order_by("-revenue")[:10]
        )
        for item in revenue_by_country:
            item["revenue"] = float(item["revenue"] or 0)

        # Top products by revenue
        top_products = list(
            OrderItem.objects.filter(order__status="COMPLETED")
            .values("product_id", "product__name", "product__category")
            .annotate(
                total_units_sold=Sum("quantity"),
                total_revenue=Sum("subtotal"),
            )
            .order_by("-total_revenue")[:5]
        )
        for item in top_products:
            item["total_revenue"] = float(item["total_revenue"] or 0)

        # Top customers by revenue
        top_customers = list(
            Customer.objects.filter(orders__status="COMPLETED")
            .values("id", "name", "email", "customer_segment", "country")
            .annotate(
                lifetime_revenue=Sum("orders__total_amount"),
                order_count=Count("orders__id"),
            )
            .order_by("-lifetime_revenue")[:5]
        )
        for item in top_customers:
            item["lifetime_revenue"] = float(item["lifetime_revenue"] or 0)

        # Monthly revenue trend (last 12 months)
        monthly_trend = list(
            Order.objects.filter(status="COMPLETED")
            .annotate(month=TruncMonth("order_date"))
            .values("month")
            .annotate(
                revenue=Sum("total_amount"),
                order_count=Count("id"),
            )
            .order_by("month")
        )
        formatted_monthly = []
        for entry in monthly_trend:
            if entry["month"]:
                formatted_monthly.append(
                    {
                        "month": entry["month"].strftime("%Y-%m"),
                        "revenue": float(entry["revenue"] or 0),
                        "orders": entry["order_count"],
                    }
                )

        return api_response(
            data={
                "kpis": {
                    "total_customers": total_customers,
                    "total_orders": total_orders,
                    "total_revenue": total_revenue,
                    "avg_order_value": round(avg_order_value, 2),
                    "completed_orders": completed_count,
                },
                "revenue_by_month": formatted_monthly,
                "revenue_by_country": revenue_by_country,
                "order_status_distribution": status_distribution,
                "customer_segmentation": customer_segments,
                "top_products": top_products,
                "top_customers": top_customers,
            }
        )


class RevenueAnalyticsView(APIView):
    """Detailed revenue trend and breakdowns."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        monthly = list(
            Order.objects.filter(status="COMPLETED")
            .annotate(month=TruncMonth("order_date"))
            .values("month")
            .annotate(
                revenue=Sum("total_amount"),
                order_count=Count("id"),
                avg_value=Avg("total_amount"),
            )
            .order_by("month")
        )
        results = [
            {
                "month": item["month"].strftime("%Y-%m") if item["month"] else "Unknown",
                "revenue": float(item["revenue"] or 0),
                "orders": item["order_count"],
                "avg_value": round(float(item["avg_value"] or 0), 2),
            }
            for item in monthly
        ]
        return api_response(data=results)


class CustomerSegmentationAnalyticsView(APIView):
    """Customer cohort and segment metrics."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        segments = list(
            Customer.objects.values("customer_segment")
            .annotate(
                customer_count=Count("id"),
                total_spent=Sum("orders__total_amount", filter=models.Q(orders__status="COMPLETED")),
                avg_orders_per_customer=Count("orders__id") * 1.0 / Count("id", distinct=True),
            )
            .order_by("-total_spent")
        )
        for s in segments:
            s["total_spent"] = float(s["total_spent"] or 0)
            s["avg_orders_per_customer"] = round(float(s["avg_orders_per_customer"] or 0), 2)

        return api_response(data=segments)


class ProductPerformanceAnalyticsView(APIView):
    """Product category and sales metrics."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        categories = list(
            Product.objects.values("category")
            .annotate(
                product_count=Count("id"),
                total_stock=Sum("stock_quantity"),
                avg_price=Avg("price"),
                total_revenue=Sum("order_items__subtotal", filter=models.Q(order_items__order__status="COMPLETED")),
                units_sold=Sum("order_items__quantity", filter=models.Q(order_items__order__status="COMPLETED")),
            )
            .order_by("-total_revenue")
        )
        for c in categories:
            c["avg_price"] = round(float(c["avg_price"] or 0), 2)
            c["total_revenue"] = float(c["total_revenue"] or 0)
            c["units_sold"] = int(c["units_sold"] or 0)

        return api_response(data=categories)


class BusinessMetricsView(APIView):
    """
    Enterprise business metrics definitions and metadata layer.
    Exposes canonical formulas, required columns, filters, and assumptions.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        metric_id = request.query_params.get("metric_id")
        if metric_id:
            m = get_metric(metric_id)
            if not m:
                return api_error(
                    message=f"Metric '{metric_id}' not found in canonical metrics registry.",
                    code="METRIC_NOT_FOUND",
                    status_code=status.HTTP_404_NOT_FOUND,
                )
            return api_response(data=m.to_dict())

        return api_response(data=get_all_metrics())


class PeriodComparisonView(APIView):
    """
    Executes deterministic period-over-period performance comparisons (MoM, QoQ, YoY).
    Synthesizes structured business summaries separating observed facts from hypotheses.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        period_type = request.query_params.get("period", "mom").lower()
        dimension = request.query_params.get("dimension")
        limit_periods = int(request.query_params.get("limit", 6))

        try:
            result = calculate_period_comparison(
                period_type=period_type,
                dimension=dimension,
                limit_periods=limit_periods,
            )
            return api_response(data=result)
        except Exception as exc:
            return api_error(
                message=f"Failed to calculate period comparison: {exc}",
                code="CALCULATION_ERROR",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

    def post(self, request):
        period_type = request.data.get("period", "mom").lower()
        dimension = request.data.get("dimension")
        limit_periods = int(request.data.get("limit", 6))

        try:
            result = calculate_period_comparison(
                period_type=period_type,
                dimension=dimension,
                limit_periods=limit_periods,
            )
            return api_response(data=result)
        except Exception as exc:
            return api_error(
                message=f"Failed to calculate period comparison: {exc}",
                code="CALCULATION_ERROR",
                status_code=status.HTTP_400_BAD_REQUEST,
            )


class SavedReportViewSet(viewsets.ModelViewSet):
    """
    CRUD management for saved natural language reports and charts.
    Enforces multi-tenant isolation and re-validates execution permissions on refresh.
    """

    queryset = SavedReport.objects.all()
    serializer_class = SavedReportSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_authenticated:
            if not user.is_staff:
                qs = qs.filter(models.Q(user=user) | models.Q(user__isnull=True))
        else:
            qs = qs.filter(user__isnull=True)

        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category__iexact=category)
        return qs

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if getattr(self, "action", None) in ("refresh", "duplicate"):
            return
        if request.method not in permissions.SAFE_METHODS:
            if not request.user or not request.user.is_authenticated:
                self.permission_denied(
                    request,
                    message="Authentication required to modify saved reports.",
                    code="AUTHENTICATION_REQUIRED",
                )
            if obj.user and obj.user != request.user and not request.user.is_staff:
                self.permission_denied(
                    request,
                    message="You do not have permission to modify this report.",
                    code="FORBIDDEN",
                )
            if obj.user is None and not request.user.is_staff:
                self.permission_denied(
                    request,
                    message="System report templates can only be modified by administrators.",
                    code="ADMIN_REQUIRED",
                )

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return api_response(data=serializer.data, status_code=status.HTTP_201_CREATED)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return api_response(data=serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return api_response(data=serializer.data)

    @action(detail=True, methods=["post"], url_path="refresh")
    def refresh(self, request, pk=None):
        """Re-validate permissions and execute the saved query fresh against authorized source."""
        report = self.get_object()
        sql = report.sql

        # 1. Re-validate SQL security
        from apps.ai_assistant.sql_validator import SQLValidator

        validator = SQLValidator()
        allowed_tables = None
        dialect = "postgresql"

        if report.data_source:
            from apps.datasources.schema_discovery import get_datasource_schema_context

            dialect = report.data_source.engine
            _, allowed_tables = get_datasource_schema_context(report.data_source)

        validation = validator.validate(sql, allowed_tables=allowed_tables, dialect=dialect)
        if not validation.is_valid:
            return api_error(
                message=f"Saved report failed security validation: {validation.error_message}",
                code=validation.error_code or "VALIDATION_FAILED",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Execute fresh
        if report.data_source:
            from apps.datasources.executor import ExternalSQLExecutor

            executor = ExternalSQLExecutor(report.data_source)
            result = executor.execute(
                sql=validation.sanitized_sql,
                question=report.natural_language_question or report.name,
                user=request.user,
            )
        else:
            from apps.ai_assistant.executor import SQLExecutor

            executor = SQLExecutor()
            result = executor.execute(
                sql=validation.sanitized_sql,
                question=report.natural_language_question or report.name,
                user=request.user,
            )

        if not result["success"]:
            return api_error(
                message=f"Report execution failed: {result.get('error')}",
                code="EXECUTION_ERROR",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return api_response(
            data={
                "report_id": report.id,
                "name": report.name,
                "chart_type": report.chart_type,
                "chart_config": report.chart_config,
                "columns": result.get("columns", []),
                "rows": result.get("rows", []),
                "row_count": result.get("row_count", 0),
                "execution_time_ms": result.get("execution_time_ms", 0.0),
            }
        )

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        """Duplicate an existing report definition."""
        orig = self.get_object()
        copy_obj = SavedReport.objects.create(
            name=f"{orig.name} (Copy)",
            description=orig.description,
            category=orig.category,
            natural_language_question=orig.natural_language_question,
            sql=orig.sql,
            chart_type=orig.chart_type,
            chart_config=orig.chart_config,
            data_source=orig.data_source,
            user=request.user if request.user.is_authenticated else None,
        )
        serializer = self.get_serializer(copy_obj)
        return api_response(data=serializer.data, status_code=status.HTTP_201_CREATED)


class ScheduledReportViewSet(viewsets.ModelViewSet):
    """
    CRUD management for recurring report schedules.
    Provides toggle controls, manual trigger execution, and run history.
    """

    queryset = ScheduledReport.objects.all()
    serializer_class = ScheduledReportSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_authenticated:
            if not user.is_staff:
                qs = qs.filter(models.Q(user=user) | models.Q(user__isnull=True))
        else:
            qs = qs.filter(user__isnull=True)
        return qs

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method not in permissions.SAFE_METHODS:
            if not request.user or not request.user.is_authenticated:
                self.permission_denied(
                    request,
                    message="Authentication required to manage scheduled reports.",
                    code="AUTHENTICATION_REQUIRED",
                )
            if obj.user and obj.user != request.user and not request.user.is_staff:
                self.permission_denied(
                    request,
                    message="You do not have permission to modify this scheduled report.",
                    code="FORBIDDEN",
                )
            if obj.user is None and not request.user.is_staff:
                self.permission_denied(
                    request,
                    message="System schedules can only be modified by administrators.",
                    code="ADMIN_REQUIRED",
                )

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return api_response(data=serializer.data, status_code=status.HTTP_201_CREATED)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return api_response(data=serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return api_response(data=serializer.data)

    @action(detail=True, methods=["post"], url_path="toggle-active")
    def toggle_active(self, request, pk=None):
        """Toggle active/disabled status for schedule."""
        schedule = self.get_object()
        schedule.is_active = not schedule.is_active
        schedule.save(update_fields=["is_active", "updated_at"])
        return api_response(
            data={"id": schedule.id, "is_active": schedule.is_active},
            message=f"Schedule {'enabled' if schedule.is_active else 'disabled'}.",
        )

    @action(detail=True, methods=["post"], url_path="trigger-now")
    def trigger_now(self, request, pk=None):
        """Trigger an immediate run of the scheduled report."""
        schedule = self.get_object()
        report = schedule.report


        from apps.ai_assistant.executor import SQLExecutor
        from apps.ai_assistant.sql_validator import SQLValidator

        validator = SQLValidator()
        validation = validator.validate(report.sql)
        if not validation.is_valid:
            exec_rec = ScheduledReportExecution.objects.create(
                scheduled_report=schedule,
                status="FAILED",
                error_message=validation.error_message,
            )
            return api_error(
                message=f"Scheduled execution blocked by validator: {validation.error_message}",
                code="VALIDATION_FAILED",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        executor = SQLExecutor()
        result = executor.execute(
            sql=validation.sanitized_sql,
            question=report.natural_language_question or report.name,
            user=schedule.user,
        )

        exec_status = "SUCCESS" if result["success"] else "FAILED"
        exec_rec = ScheduledReportExecution.objects.create(
            scheduled_report=schedule,
            status=exec_status,
            row_count=result.get("row_count", 0),
            execution_time_ms=result.get("execution_time_ms", 0.0),
            error_message=result.get("error"),
            summary_payload={
                "report_name": report.name,
                "chart_type": report.chart_type,
            },
        )

        from django.utils import timezone
        schedule.last_run_at = timezone.now()
        schedule.save(update_fields=["last_run_at"])

        return api_response(
            data={
                "execution_id": exec_rec.id,
                "status": exec_status,
                "row_count": exec_rec.row_count,
                "execution_time_ms": exec_rec.execution_time_ms,
            },
            message="Scheduled report executed successfully.",
        )
