"""Serializers for database analytics models."""

from rest_framework import serializers

from apps.analytics.models import (
    Customer,
    Order,
    OrderItem,
    Payment,
    Product,
    SavedReport,
    ScheduledReport,
    ScheduledReportExecution,
    WebsiteEvent,
)


class CustomerSerializer(serializers.ModelSerializer):
    order_count = serializers.IntegerField(read_only=True, required=False)
    total_spent = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, required=False)

    class Meta:
        model = Customer
        fields = [
            "id",
            "name",
            "email",
            "country",
            "signup_date",
            "customer_segment",
            "created_at",
            "order_count",
            "total_spent",
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            from apps.organizations.masking_service import mask_email
            from apps.organizations.models import RoleChoices
            from apps.organizations.service import resolve_tenant_context

            _, role = resolve_tenant_context(request)
            if role != RoleChoices.ADMIN and ret.get("email"):
                ret["email"] = mask_email(ret["email"])
        return ret


class ProductSerializer(serializers.ModelSerializer):
    profit_margin = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "category",
            "price",
            "cost",
            "stock_quantity",
            "created_at",
            "profit_margin",
        ]

    def get_profit_margin(self, obj):
        if obj.price > 0:
            return round(float((obj.price - obj.cost) / obj.price * 100), 2)
        return 0.0


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "order",
            "product",
            "product_name",
            "quantity",
            "unit_price",
            "subtotal",
        ]


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            "id",
            "order",
            "payment_date",
            "amount",
            "payment_method",
            "payment_status",
        ]


class OrderSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_email = serializers.CharField(source="customer.email", read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "customer",
            "customer_name",
            "customer_email",
            "order_date",
            "status",
            "total_amount",
            "created_at",
            "items",
            "payments",
        ]


class WebsiteEventSerializer(serializers.ModelSerializer):
    customer_email = serializers.CharField(source="customer.email", read_only=True, allow_null=True)

    class Meta:
        model = WebsiteEvent
        fields = [
            "id",
            "customer",
            "customer_email",
            "event_type",
            "event_timestamp",
            "metadata",
        ]


class SavedReportSerializer(serializers.ModelSerializer):
    """Serializer for saved natural language reports and charts."""

    user_email = serializers.CharField(source="user.email", read_only=True, default=None)
    data_source_name = serializers.CharField(source="data_source.name", read_only=True, default=None)

    class Meta:
        model = SavedReport
        fields = [
            "id",
            "name",
            "description",
            "category",
            "natural_language_question",
            "sql",
            "chart_type",
            "chart_config",
            "data_source",
            "data_source_name",
            "user",
            "user_email",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "user", "user_email"]


class ScheduledReportExecutionSerializer(serializers.ModelSerializer):
    """Serializer for scheduled run telemetry."""

    class Meta:
        model = ScheduledReportExecution
        fields = [
            "id",
            "scheduled_report",
            "executed_at",
            "status",
            "row_count",
            "execution_time_ms",
            "error_message",
            "summary_payload",
        ]
        read_only_fields = fields


class ScheduledReportSerializer(serializers.ModelSerializer):
    """Serializer for recurring report schedules."""

    report_name = serializers.CharField(source="report.name", read_only=True)
    executions = ScheduledReportExecutionSerializer(many=True, read_only=True)

    class Meta:
        model = ScheduledReport
        fields = [
            "id",
            "report",
            "report_name",
            "name",
            "frequency",
            "day_of_week",
            "day_of_month",
            "time_of_day",
            "timezone",
            "is_active",
            "delivery_channel",
            "delivery_target",
            "last_run_at",
            "next_run_at",
            "executions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "last_run_at", "next_run_at", "created_at", "updated_at"]
