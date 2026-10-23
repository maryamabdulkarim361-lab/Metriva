"""High-performance deterministic seed data generator for AI Database Assistant."""

import random
import time
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

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

User = get_user_model()

FIRST_NAMES = [
    "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Sam", "Chris",
    "Pat", "Avery", "Jamie", "Logan", "Dana", "Cameron", "Quinn", "Skyler",
    "Jesse", "Reese", "Kendall", "Harper", "Rowan", "Peyton", "Emerson", "Finley",
    "Adrian", "Dakota", "Hayden", "Kai", "Rory", "Shiloh", "Milan", "Sage",
]
LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
]
COUNTRIES = [
    ("United States", 0.45),
    ("United Kingdom", 0.15),
    ("Germany", 0.10),
    ("Canada", 0.08),
    ("Australia", 0.06),
    ("France", 0.05),
    ("Japan", 0.04),
    ("Netherlands", 0.04),
    ("Singapore", 0.03),
]
CATEGORIES = [
    ("Cloud Infrastructure", [
        ("Cloud Compute Instance - 4 vCPU", 80.00, 25.00),
        ("Dedicated Storage Volume 1TB", 45.00, 12.00),
        ("Load Balancer Standard Tier", 35.00, 8.00),
        ("Kubernetes Managed Node", 120.00, 40.00),
        ("Global CDN Acceleration", 60.00, 15.00),
    ]),
    ("Enterprise Software", [
        ("AI Analytics Suite - Monthly", 249.00, 30.00),
        ("Customer Data Platform Seat", 89.00, 10.00),
        ("API Gateway Enterprise License", 199.00, 20.00),
        ("Security Compliance Monitor", 149.00, 18.00),
        ("Real-time Stream Processor", 299.00, 45.00),
    ]),
    ("Developer Hardware", [
        ("Ultra-wide Curved Monitor 38-inch", 899.00, 520.00),
        ("Mechanical Coding Keyboard Pro", 169.00, 75.00),
        ("Precision Ergonomic Mouse", 89.00, 35.00),
        ("Thunderbolt 4 Docking Station", 249.00, 110.00),
        ("Noise-cancelling Developer Headset", 299.00, 140.00),
    ]),
    ("DevOps & Security", [
        ("SSL Wildcard Certificate Pack", 120.00, 20.00),
        ("Vulnerability Scanner License", 350.00, 50.00),
        ("CI/CD Build Pipeline Accelerator", 75.00, 15.00),
        ("Secrets Management Appliance", 450.00, 80.00),
    ]),
]


def weighted_choice(choices):
    total = sum(w for c, w in choices)
    r = random.uniform(0, total)
    upto = 0
    for c, w in choices:
        if upto + w >= r:
            return c
        upto += w
    return choices[0][0]


class Command(BaseCommand):
    help = "Seed database with realistic business analytics data for development and benchmarking."

    def add_arguments(self, parser):
        parser.add_argument(
            "--scale",
            type=str,
            choices=["demo", "standard", "full"],
            default="demo",
            help="Dataset size: demo (fast dev), standard (10k orders), or full (50k+ orders for portfolio scale).",
        )
        parser.add_argument(
            "--seed",
            type=int,
            default=42,
            help="Deterministic random seed for reproducibility.",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Truncate/clear existing data before seeding.",
        )

    def handle(self, *args, **options):
        scale = options["scale"]
        seed_val = options["seed"]
        clear = options["clear"]

        random.seed(seed_val)
        start_time = time.perf_counter()

        self.stdout.write(self.style.NOTICE(f"Seeding database at scale '{scale}' (Seed: {seed_val})..."))

        # Configuration profiles
        profiles = {
            "demo": {
                "users": 5,
                "customers": 250,
                "products_count": 100,
                "orders": 2500,
                "events": 5000,
            },
            "standard": {
                "users": 10,
                "customers": 1000,
                "products_count": 250,
                "orders": 10000,
                "events": 20000,
            },
            "full": {
                "users": 20,
                "customers": 5200,
                "products_count": 520,
                "orders": 52000,
                "events": 105000,
            },
        }
        cfg = profiles[scale]

        if clear:
            self.stdout.write("Clearing existing data...")
            WebsiteEvent.objects.all().delete()
            Payment.objects.all().delete()
            OrderItem.objects.all().delete()
            Order.objects.all().delete()
            Product.objects.all().delete()
            Customer.objects.all().delete()
            self.stdout.write(self.style.SUCCESS("Existing analytics data cleared."))

        # 1. Seed Users
        self.stdout.write("Creating demo and staff users...")
        demo_user, _ = User.objects.get_or_create(
            email="demo@aidatabaseassistant.com",
            defaults={"name": "Demo Analyst", "is_staff": False, "is_active": True},
        )
        demo_user.set_password("DemoPassword123!")
        demo_user.save()

        admin_user, _ = User.objects.get_or_create(
            email="admin@aidatabaseassistant.com",
            defaults={"name": "System Administrator", "is_staff": True, "is_superuser": True, "is_active": True},
        )
        admin_user.set_password("AdminPassword123!")
        admin_user.save()

        for i in range(1, cfg["users"]):
            fname = random.choice(FIRST_NAMES)
            lname = random.choice(LAST_NAMES)
            email = f"user_{i}_{fname.lower()}@aidatabaseassistant.com"
            if not User.objects.filter(email=email).exists():
                u = User(email=email, name=f"{fname} {lname}", is_staff=(i % 5 == 0))
                u.set_password("Password123!")
                u.save()

        # 2. Seed Products
        self.stdout.write("Generating products catalog...")
        existing_products = list(Product.objects.all())
        if len(existing_products) < cfg["products_count"]:
            products_to_create = []
            prod_idx = len(existing_products) + 1
            while len(products_to_create) + len(existing_products) < cfg["products_count"]:
                category, items = random.choice(CATEGORIES)
                base_name, base_price, base_cost = random.choice(items)
                tier = random.choice(["v1", "v2", "Pro", "Enterprise", "Developer Edition", "Max"])
                name = f"{base_name} ({tier} #{prod_idx})"
                price = Decimal(str(round(base_price * random.uniform(0.85, 1.35), 2)))
                cost = Decimal(str(round(base_cost * random.uniform(0.85, 1.25), 2)))
                stock = random.randint(10, 500)
                products_to_create.append(
                    Product(
                        name=name,
                        category=category,
                        price=price,
                        cost=cost,
                        stock_quantity=stock,
                    )
                )
                prod_idx += 1
            Product.objects.bulk_create(products_to_create, batch_size=2000)
            existing_products = list(Product.objects.all())
        self.stdout.write(f"Products available: {len(existing_products)}")

        # 3. Seed Customers
        self.stdout.write("Generating customer records...")
        existing_customers = list(Customer.objects.all())
        if len(existing_customers) < cfg["customers"]:
            customers_to_create = []
            cust_idx = len(existing_customers) + 1
            start_date = date(2024, 1, 1)
            end_date = date(2026, 10, 1)
            days_span = (end_date - start_date).days

            segments = [
                (CustomerSegment.CONSUMER, 0.60),
                (CustomerSegment.SMB, 0.30),
                (CustomerSegment.ENTERPRISE, 0.10),
            ]

            while len(customers_to_create) + len(existing_customers) < cfg["customers"]:
                fname = random.choice(FIRST_NAMES)
                lname = random.choice(LAST_NAMES)
                name = f"{fname} {lname}"
                email = f"{fname.lower()}.{lname.lower()}{cust_idx}@example.com"
                country = weighted_choice(COUNTRIES)
                segment = weighted_choice(segments)
                signup_date = start_date + timedelta(days=random.randint(0, days_span))

                customers_to_create.append(
                    Customer(
                        name=name,
                        email=email,
                        country=country,
                        signup_date=signup_date,
                        customer_segment=segment,
                    )
                )
                cust_idx += 1

            Customer.objects.bulk_create(customers_to_create, batch_size=2500)
            existing_customers = list(Customer.objects.all())
        self.stdout.write(f"Customers available: {len(existing_customers)}")

        # 4. Seed Orders, OrderItems, Payments
        self.stdout.write("Generating orders and items (in bulk)...")
        order_count_target = cfg["orders"]
        existing_orders_count = Order.objects.count()

        if existing_orders_count < order_count_target:
            needed_orders = order_count_target - existing_orders_count
            start_dt = datetime(2025, 1, 1, tzinfo=timezone.utc)
            end_dt = datetime(2026, 10, 20, tzinfo=timezone.utc)
            seconds_span = int((end_dt - start_dt).total_seconds())

            order_statuses = [
                (OrderStatus.COMPLETED, 0.78),
                (OrderStatus.PENDING, 0.10),
                (OrderStatus.CANCELLED, 0.08),
                (OrderStatus.REFUNDED, 0.04),
            ]
            payment_methods = [
                (PaymentMethod.STRIPE, 0.45),
                (PaymentMethod.CREDIT_CARD, 0.35),
                (PaymentMethod.PAYPAL, 0.12),
                (PaymentMethod.BANK_TRANSFER, 0.08),
            ]

            # Batch process in chunks of 5000
            chunk_size = 5000
            orders_created_total = 0

            while orders_created_total < needed_orders:
                batch_limit = min(chunk_size, needed_orders - orders_created_total)
                orders_batch = []
                for _ in range(batch_limit):
                    cust = random.choice(existing_customers)
                    order_date = start_dt + timedelta(seconds=random.randint(0, seconds_span))
                    st = weighted_choice(order_statuses)
                    orders_batch.append(
                        Order(
                            customer=cust,
                            order_date=order_date,
                            status=st,
                            total_amount=Decimal("0.00"),
                        )
                    )

                created_orders = Order.objects.bulk_create(orders_batch, batch_size=2500)

                # Generate items and payments for created orders
                items_batch = []
                payments_batch = []

                for ord_obj in created_orders:
                    num_items = random.randint(1, 4)
                    order_total = Decimal("0.00")
                    chosen_products = random.sample(existing_products, min(num_items, len(existing_products)))

                    for prod in chosen_products:
                        qty = random.randint(1, 3)
                        unit_p = prod.price
                        sub = Decimal(str(round(unit_p * qty, 2)))
                        order_total += sub
                        items_batch.append(
                            OrderItem(
                                order=ord_obj,
                                product=prod,
                                quantity=qty,
                                unit_price=unit_p,
                                subtotal=sub,
                            )
                        )

                    ord_obj.total_amount = order_total

                    # Payment record
                    pay_status = PaymentStatus.SUCCESS if ord_obj.status == OrderStatus.COMPLETED else (
                        PaymentStatus.FAILED if ord_obj.status == OrderStatus.CANCELLED else PaymentStatus.PENDING
                    )
                    payments_batch.append(
                        Payment(
                            order=ord_obj,
                            payment_date=ord_obj.order_date + timedelta(seconds=random.randint(10, 600)),
                            amount=order_total,
                            payment_method=weighted_choice(payment_methods),
                            payment_status=pay_status,
                        )
                    )

                OrderItem.objects.bulk_create(items_batch, batch_size=3000)
                Payment.objects.bulk_create(payments_batch, batch_size=2500)
                Order.objects.bulk_update(created_orders, ["total_amount"], batch_size=2500)

                orders_created_total += batch_limit
                self.stdout.write(f"  Created {orders_created_total}/{needed_orders} orders...")

        # 5. Seed Website Events
        self.stdout.write("Generating website telemetry events...")
        event_count_target = cfg["events"]
        existing_events_count = WebsiteEvent.objects.count()

        if existing_events_count < event_count_target:
            needed_events = event_count_target - existing_events_count
            event_types = [
                (EventType.PAGE_VIEW, 0.50),
                (EventType.PRODUCT_VIEW, 0.25),
                (EventType.ADD_TO_CART, 0.12),
                (EventType.CHECKOUT_START, 0.08),
                (EventType.PURCHASE, 0.05),
            ]
            start_dt = datetime(2026, 1, 1, tzinfo=timezone.utc)
            end_dt = datetime(2026, 10, 20, tzinfo=timezone.utc)
            seconds_span = int((end_dt - start_dt).total_seconds())

            events_created_total = 0
            chunk_size = 10000

            while events_created_total < needed_events:
                batch_limit = min(chunk_size, needed_events - events_created_total)
                events_batch = []
                for _ in range(batch_limit):
                    cust = random.choice(existing_customers) if random.random() > 0.2 else None
                    etype = weighted_choice(event_types)
                    evt_time = start_dt + timedelta(seconds=random.randint(0, seconds_span))
                    meta = {
                        "device": random.choice(["desktop", "mobile", "tablet"]),
                        "browser": random.choice(["chrome", "safari", "firefox", "edge"]),
                        "path": random.choice(["/", "/products", "/checkout", "/pricing", "/features"]),
                    }
                    events_batch.append(
                        WebsiteEvent(
                            customer=cust,
                            event_type=etype,
                            event_timestamp=evt_time,
                            metadata=meta,
                        )
                    )

                WebsiteEvent.objects.bulk_create(events_batch, batch_size=3000)
                events_created_total += batch_limit
                self.stdout.write(f"  Created {events_created_total}/{needed_events} events...")

        elapsed = round(time.perf_counter() - start_time, 2)
        self.stdout.write(
            self.style.SUCCESS(
                f"\n[DONE] Database successfully seeded in {elapsed}s!\n"
                f"  - Users: {User.objects.count()}\n"
                f"  - Customers: {Customer.objects.count()}\n"
                f"  - Products: {Product.objects.count()}\n"
                f"  - Orders: {Order.objects.count()}\n"
                f"  - Order Items: {OrderItem.objects.count()}\n"
                f"  - Payments: {Payment.objects.count()}\n"
                f"  - Website Events: {WebsiteEvent.objects.count()}\n"
            )
        )
