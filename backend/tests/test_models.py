"""Tests for analytics database models, relationships, and constraints."""

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from django.db import IntegrityError

from apps.analytics.models import (
    Customer,
    CustomerSegment,
    EventType,
    Order,
    OrderItem,
    OrderStatus,
    Payment,
    PaymentMethod,
    PaymentStatus,
    Product,
    WebsiteEvent,
)


@pytest.mark.django_db
class TestAnalyticsModels:
    def test_customer_creation(self):
        customer = Customer.objects.create(
            name="Acme Corp",
            email="contact@acme.com",
            country="United States",
            signup_date=date(2025, 1, 15),
            customer_segment=CustomerSegment.ENTERPRISE,
        )
        assert customer.id is not None
        assert str(customer) == "Acme Corp (contact@acme.com)"
        assert customer.customer_segment == "ENTERPRISE"

    def test_customer_unique_email(self):
        Customer.objects.create(
            name="User 1",
            email="duplicate@example.com",
            country="Canada",
            signup_date=date(2025, 2, 1),
        )
        with pytest.raises(IntegrityError):
            Customer.objects.create(
                name="User 2",
                email="duplicate@example.com",
                country="France",
                signup_date=date(2025, 2, 2),
            )

    def test_product_creation_and_constraints(self):
        prod = Product.objects.create(
            name="Developer Laptop Stand",
            category="Accessories",
            price=Decimal("79.99"),
            cost=Decimal("30.00"),
            stock_quantity=150,
        )
        assert prod.id is not None
        assert prod.price == Decimal("79.99")

    def test_order_creation_and_cascade(self):
        customer = Customer.objects.create(
            name="Cascade User",
            email="cascade@example.com",
            country="Germany",
            signup_date=date(2025, 3, 1),
        )
        order = Order.objects.create(
            customer=customer,
            order_date=datetime(2025, 3, 2, 14, 0, tzinfo=timezone.utc),
            status=OrderStatus.COMPLETED,
            total_amount=Decimal("150.00"),
        )
        assert order.customer == customer
        assert customer.orders.count() == 1

        # Deleting customer cascades to orders
        customer.delete()
        assert Order.objects.filter(id=order.id).count() == 0

    def test_order_item_product_protection(self):
        customer = Customer.objects.create(
            name="Buyer",
            email="buyer@example.com",
            country="UK",
            signup_date=date(2025, 3, 1),
        )
        product = Product.objects.create(
            name="Protected Software License",
            category="Software",
            price=Decimal("200.00"),
            cost=Decimal("20.00"),
            stock_quantity=10,
        )
        order = Order.objects.create(
            customer=customer,
            order_date=datetime(2025, 3, 2, tzinfo=timezone.utc),
            status=OrderStatus.COMPLETED,
            total_amount=Decimal("200.00"),
        )
        item = OrderItem.objects.create(
            order=order,
            product=product,
            quantity=1,
            unit_price=Decimal("200.00"),
            subtotal=Decimal("200.00"),
        )
        assert item.id is not None

        # Deleting product should be protected (raise IntegrityError or ProtectedError)
        with pytest.raises(Exception):
            product.delete()

    def test_payment_creation(self):
        customer = Customer.objects.create(
            name="Payer",
            email="payer@example.com",
            country="Australia",
            signup_date=date(2025, 3, 1),
        )
        order = Order.objects.create(
            customer=customer,
            order_date=datetime(2025, 3, 2, tzinfo=timezone.utc),
            status=OrderStatus.COMPLETED,
            total_amount=Decimal("50.00"),
        )
        payment = Payment.objects.create(
            order=order,
            payment_date=datetime(2025, 3, 2, 1, 0, tzinfo=timezone.utc),
            amount=Decimal("50.00"),
            payment_method=PaymentMethod.STRIPE,
            payment_status=PaymentStatus.SUCCESS,
        )
        assert payment.id is not None
        assert payment.payment_status == PaymentStatus.SUCCESS

    def test_website_event_telemetry(self):
        customer = Customer.objects.create(
            name="Visitor",
            email="visitor@example.com",
            country="Japan",
            signup_date=date(2025, 3, 1),
        )
        event = WebsiteEvent.objects.create(
            customer=customer,
            event_type=EventType.PAGE_VIEW,
            event_timestamp=datetime(2025, 3, 5, 12, 0, tzinfo=timezone.utc),
            metadata={"browser": "chrome", "device": "mobile"},
        )
        assert event.id is not None
        assert event.metadata["browser"] == "chrome"
