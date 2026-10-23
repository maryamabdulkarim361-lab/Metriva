"""
Business Analytics Database Schema.

Normalized 3NF relational model representing an e-commerce / SaaS business:
- Customers
- Products
- Orders
- Order Items
- Payments
- Website Events
"""

from decimal import Decimal

from django.conf import settings
from django.db import models


class CustomerSegment(models.TextChoices):
    ENTERPRISE = "ENTERPRISE", "Enterprise"
    SMB = "SMB", "Small and Medium Business"
    CONSUMER = "CONSUMER", "Consumer"


class OrderStatus(models.TextChoices):
    COMPLETED = "COMPLETED", "Completed"
    PENDING = "PENDING", "Pending"
    CANCELLED = "CANCELLED", "Cancelled"
    REFUNDED = "REFUNDED", "Refunded"


class PaymentMethod(models.TextChoices):
    CREDIT_CARD = "CREDIT_CARD", "Credit Card"
    BANK_TRANSFER = "BANK_TRANSFER", "Bank Transfer"
    PAYPAL = "PAYPAL", "PayPal"
    STRIPE = "STRIPE", "Stripe"


class PaymentStatus(models.TextChoices):
    SUCCESS = "SUCCESS", "Success"
    PENDING = "PENDING", "Pending"
    FAILED = "FAILED", "Failed"


class EventType(models.TextChoices):
    PAGE_VIEW = "PAGE_VIEW", "Page View"
    PRODUCT_VIEW = "PRODUCT_VIEW", "Product View"
    ADD_TO_CART = "ADD_TO_CART", "Add to Cart"
    CHECKOUT_START = "CHECKOUT_START", "Checkout Start"
    PURCHASE = "PURCHASE", "Purchase"


class Customer(models.Model):
    """
    Customer entity for business demographic and segmentation analysis.
    Indexed on email (unique identity lookup), country (geographical aggregations),
    and customer_segment (cohort & churn analysis).
    """

    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255)
    email = models.EmailField(max_length=255, unique=True, db_index=True)
    country = models.CharField(max_length=100, db_index=True)
    signup_date = models.DateField(db_index=True)
    customer_segment = models.CharField(
        max_length=50,
        choices=CustomerSegment.choices,
        default=CustomerSegment.CONSUMER,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "customers"
        verbose_name = "Customer"
        verbose_name_plural = "Customers"
        ordering = ["-signup_date", "-id"]
        indexes = [
            models.Index(fields=["country", "customer_segment"], name="idx_cust_country_seg"),
        ]

    def __str__(self):
        return f"{self.name} ({self.email})"


class Product(models.Model):
    """
    Product inventory entity.
    Maintains pricing, unit manufacturing cost, and stock quantity.
    Includes check constraints to guarantee non-negative financial values.
    """

    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255, db_index=True)
    category = models.CharField(max_length=100, db_index=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    cost = models.DecimalField(max_digits=12, decimal_places=2)
    stock_quantity = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "products"
        verbose_name = "Product"
        verbose_name_plural = "Products"
        ordering = ["category", "name"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(price__gte=Decimal("0.00")),
                name="chk_product_price_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(cost__gte=Decimal("0.00")),
                name="chk_product_cost_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(stock_quantity__gte=0),
                name="chk_product_stock_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["category", "price"], name="idx_prod_category_price"),
        ]

    def __str__(self):
        return f"{self.name} [{self.category}] - ${self.price}"


class Order(models.Model):
    """
    Transaction header entity.
    Relates customers to sales transactions.
    Indexes customer_id for customer lifetime value joins,
    order_date for timeseries aggregations, and status for filtering.
    """

    id = models.BigAutoField(primary_key=True)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="orders",
        db_index=True,
    )
    order_date = models.DateTimeField(db_index=True)
    status = models.CharField(
        max_length=50,
        choices=OrderStatus.choices,
        default=OrderStatus.PENDING,
        db_index=True,
    )
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "orders"
        verbose_name = "Order"
        verbose_name_plural = "Orders"
        ordering = ["-order_date"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(total_amount__gte=Decimal("0.00")),
                name="chk_order_total_amount_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["order_date", "status"], name="idx_order_date_status"),
            models.Index(fields=["customer", "order_date"], name="idx_order_customer_date"),
        ]

    def __str__(self):
        return f"Order #{self.id} - Customer {self.customer_id} - ${self.total_amount}"


class OrderItem(models.Model):
    """
    Transaction line item entity.
    Relates orders to products with unit prices captured at point of sale.
    Prevents deletion of products that have purchase history (PROTECT).
    """

    id = models.BigAutoField(primary_key=True)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
        db_index=True,
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="order_items",
        db_index=True,
    )
    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = "order_items"
        verbose_name = "Order Item"
        verbose_name_plural = "Order Items"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="chk_order_item_qty_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_price__gte=Decimal("0.00")),
                name="chk_order_item_unit_price_non_neg",
            ),
            models.CheckConstraint(
                condition=models.Q(subtotal__gte=Decimal("0.00")),
                name="chk_order_item_subtotal_non_neg",
            ),
        ]
        indexes = [
            models.Index(fields=["order", "product"], name="idx_item_order_product"),
        ]

    def __str__(self):
        return f"OrderItem #{self.id} - Order #{self.order_id} - Product #{self.product_id}"


class Payment(models.Model):
    """
    Payment transaction record for an order.
    Enables reconciliation, payment method analysis, and cash flow auditing.
    """

    id = models.BigAutoField(primary_key=True)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="payments",
        db_index=True,
    )
    payment_date = models.DateTimeField(db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(
        max_length=50,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CREDIT_CARD,
    )
    payment_status = models.CharField(
        max_length=50,
        choices=PaymentStatus.choices,
        default=PaymentStatus.SUCCESS,
        db_index=True,
    )

    class Meta:
        db_table = "payments"
        verbose_name = "Payment"
        verbose_name_plural = "Payments"
        ordering = ["-payment_date"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gte=Decimal("0.00")),
                name="chk_payment_amount_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["payment_status", "payment_date"], name="idx_payment_status_date"),
        ]

    def __str__(self):
        return f"Payment #{self.id} - Order #{self.order_id} - ${self.amount} ({self.payment_status})"


class WebsiteEvent(models.Model):
    """
    Clickstream and user behavior tracking entity.
    Stores high-velocity interaction telemetry with arbitrary metadata payload.
    """

    id = models.BigAutoField(primary_key=True)
    customer = models.ForeignKey(
        Customer,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="events",
        db_index=True,
    )
    event_type = models.CharField(
        max_length=50,
        choices=EventType.choices,
        default=EventType.PAGE_VIEW,
        db_index=True,
    )
    event_timestamp = models.DateTimeField(db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "website_events"
        verbose_name = "Website Event"
        verbose_name_plural = "Website Events"
        ordering = ["-event_timestamp"]
        indexes = [
            models.Index(fields=["customer", "event_timestamp"], name="idx_event_cust_timestamp"),
            models.Index(fields=["event_type", "event_timestamp"], name="idx_event_type_timestamp"),
        ]

    def __str__(self):
        return f"Event {self.event_type} at {self.event_timestamp}"


class SavedReport(models.Model):
    """
    Saved natural language query or validated SQL report definition.
    Persists query metadata, target visualization configuration, and tenant ownership
    without permanently retaining sensitive raw result payloads.
    """

    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True, default="")
    category = models.CharField(max_length=100, default="General", db_index=True)
    natural_language_question = models.TextField(blank=True, default="")
    sql = models.TextField()
    chart_type = models.CharField(max_length=50, default="table")
    chart_config = models.JSONField(default=dict, blank=True)
    data_source = models.ForeignKey(
        "datasources.DataSource",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="saved_reports",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="saved_reports",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "saved_reports"
        verbose_name = "Saved Report"
        verbose_name_plural = "Saved Reports"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.name} [{self.category}]"


class ScheduledReportFrequency(models.TextChoices):
    DAILY = "DAILY", "Daily"
    WEEKLY = "WEEKLY", "Weekly"
    MONTHLY = "MONTHLY", "Monthly"


class ScheduledReport(models.Model):
    """
    Opt-in recurring schedule configuration for automated report generation.
    Supports time-zone handling, enable/disable controls, and delivery routing.
    """

    id = models.BigAutoField(primary_key=True)
    report = models.ForeignKey(
        SavedReport,
        on_delete=models.CASCADE,
        related_name="schedules",
    )
    name = models.CharField(max_length=255)
    frequency = models.CharField(
        max_length=50,
        choices=ScheduledReportFrequency.choices,
        default=ScheduledReportFrequency.DAILY,
    )
    day_of_week = models.IntegerField(null=True, blank=True, default=0)  # 0=Monday
    day_of_month = models.IntegerField(null=True, blank=True, default=1)
    time_of_day = models.TimeField(default="08:00:00")
    timezone = models.CharField(max_length=50, default="UTC")
    is_active = models.BooleanField(default=True, db_index=True)
    delivery_channel = models.CharField(
        max_length=50,
        choices=[("IN_APP", "In-App Notification & Log"), ("WEBHOOK", "Webhook POST")],
        default="IN_APP",
    )
    delivery_target = models.CharField(max_length=500, blank=True, default="")
    last_run_at = models.DateTimeField(null=True, blank=True)
    next_run_at = models.DateTimeField(null=True, blank=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="scheduled_reports",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "scheduled_reports"
        verbose_name = "Scheduled Report"
        verbose_name_plural = "Scheduled Reports"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Schedule: {self.name} ({self.frequency})"


class ScheduledReportExecution(models.Model):
    """Execution history and telemetry log for scheduled report runs."""

    id = models.BigAutoField(primary_key=True)
    scheduled_report = models.ForeignKey(
        ScheduledReport,
        on_delete=models.CASCADE,
        related_name="executions",
    )
    executed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    status = models.CharField(max_length=50, default="SUCCESS")
    row_count = models.IntegerField(default=0)
    execution_time_ms = models.FloatField(default=0.0)
    error_message = models.TextField(null=True, blank=True)
    summary_payload = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "scheduled_report_executions"
        verbose_name = "Scheduled Report Execution"
        verbose_name_plural = "Scheduled Report Executions"
        ordering = ["-executed_at"]

    def __str__(self):
        return f"Run #{self.id} for Schedule {self.scheduled_report_id} - {self.status}"
