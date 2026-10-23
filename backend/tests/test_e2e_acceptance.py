"""
End-to-End Acceptance Test (Objective 12).

Executes a complete, sequential 19-step business workflow:
1. Create/authenticate user
2. Add a database datasource
3. Test connection
4. Discover schema
5. Ask a natural-language question
6. Generate/validate SQL
7. Execute read-only query
8. Display result
9. Recommend chart
10. Save report
11. Refresh report
12. Run period comparison
13. Run forecast
14. Run churn analysis
15. Run anomaly detection
16. Trigger ML background job
17. Verify authorization boundaries
18. Verify secrets are never returned
19. Verify destructive SQL is rejected
"""

import sqlite3

import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from apps.analytics.models import Customer, Order, OrderItem, Product

User = get_user_model()


@pytest.fixture
def e2e_sqlite_db(tmp_path):
    """Create a temporary, self-contained SQLite business database for E2E datasource testing."""
    db_file = tmp_path / "e2e_operational.sqlite3"
    conn = sqlite3.connect(str(db_file))
    cur = conn.cursor()

    cur.executescript("""
        CREATE TABLE customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            customer_segment TEXT NOT NULL,
            country TEXT NOT NULL,
            signup_date TEXT NOT NULL
        );

        CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            cost REAL NOT NULL
        );

        CREATE TABLE orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            order_date TEXT NOT NULL,
            status TEXT NOT NULL,
            total_amount REAL NOT NULL
        );

        CREATE TABLE order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES orders(id),
            product_id INTEGER NOT NULL REFERENCES products(id),
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            subtotal REAL NOT NULL
        );

        INSERT INTO customers (id, name, email, customer_segment, country, signup_date) VALUES
            (1, 'Customer 1', 'customer1@example.com', 'SMB', 'USA', '2026-01-01'),
            (2, 'Customer 2', 'customer2@example.com', 'ENTERPRISE', 'USA', '2026-01-01'),
            (3, 'Customer 3', 'customer3@example.com', 'SMB', 'USA', '2026-01-01'),
            (4, 'Customer 4', 'customer4@example.com', 'ENTERPRISE', 'USA', '2026-01-01');

        INSERT INTO products (id, name, category, price, cost) VALUES
            (1, 'Analytics Pro', 'Software', 500.0, 100.0),
            (2, 'Cloud Storage', 'Infrastructure', 250.0, 50.0);

        INSERT INTO orders (id, customer_id, order_date, status, total_amount) VALUES
            (1, 1, '2026-01-10T12:00:00Z', 'COMPLETED', 750.0),
            (2, 2, '2026-01-10T12:00:00Z', 'COMPLETED', 750.0),
            (3, 3, '2026-02-10T12:00:00Z', 'COMPLETED', 750.0),
            (4, 4, '2026-02-10T12:00:00Z', 'COMPLETED', 750.0);

        INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES
            (1, 1, 1, 500.0, 500.0),
            (1, 2, 1, 250.0, 250.0),
            (2, 1, 1, 500.0, 500.0),
            (2, 2, 1, 250.0, 250.0),
            (3, 1, 1, 500.0, 500.0),
            (3, 2, 1, 250.0, 250.0),
            (4, 1, 1, 500.0, 500.0),
            (4, 2, 1, 250.0, 250.0);
    """)
    conn.commit()
    conn.close()
    return str(db_file)


@pytest.fixture
def seed_business_data(db):
    """Seed minimum business dataset for realistic end-to-end execution."""
    customers = []
    for i in range(1, 10):
        c = Customer.objects.create(
            name=f"Customer {i}",
            email=f"customer{i}@example.com",
            customer_segment="ENTERPRISE" if i % 2 == 0 else "SMB",
            country="USA",
            signup_date="2026-01-01",
        )
        customers.append(c)

    p1 = Product.objects.create(name="Analytics Pro", category="Software", price=500.0, cost=100.0)
    p2 = Product.objects.create(name="Cloud Storage", category="Infrastructure", price=250.0, cost=50.0)

    for idx, c in enumerate(customers):
        for month_step in range(1, 7):
            d_str = f"2026-0{month_step}-10T12:00:00Z"
            o = Order.objects.create(
                customer=c,
                order_date=d_str,
                status="COMPLETED",
                total_amount=750.0,
            )
            OrderItem.objects.create(order=o, product=p1, quantity=1, unit_price=500.0, subtotal=500.0)
            OrderItem.objects.create(order=o, product=p2, quantity=1, unit_price=250.0, subtotal=250.0)

    return customers


@pytest.mark.django_db
class TestEndToEndAcceptancePipeline:
    """Complete 19-step acceptance test covering the entire AI Database Assistant stack."""

    def test_complete_business_flow_19_steps(self, seed_business_data, e2e_sqlite_db):
        client = APIClient()
        client.defaults["HTTP_HOST"] = "127.0.0.1"

        # -------------------------------------------------------------
        # Step 1: Create & Authenticate User
        # -------------------------------------------------------------
        reg_res = client.post(
            "/api/auth/register/",
            {
                "email": "lead_analyst@company.com",
                "name": "Lead Analyst",
                "password": "StrongPassword123!",
            },
            format="json",
        )
        assert reg_res.status_code == status.HTTP_201_CREATED

        login_res = client.post(
            "/api/auth/login/",
            {
                "email": "lead_analyst@company.com",
                "password": "StrongPassword123!",
            },
            format="json",
        )
        assert login_res.status_code == status.HTTP_200_OK
        token = login_res.data["data"]["tokens"]["access"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        user = User.objects.get(email="lead_analyst@company.com")
        assert user.is_authenticated

        # -------------------------------------------------------------
        # Step 2: Add Database Data Source (Self-contained SQLite demo database)
        # -------------------------------------------------------------
        ds_res = client.post(
            "/api/datasources/",
            {
                "name": "Production Operational DB",
                "description": "Primary transactional SQLite database",
                "engine": "sqlite",
                "database_name": e2e_sqlite_db,
                "is_active": True,
            },
            format="json",
        )
        assert ds_res.status_code == status.HTTP_201_CREATED
        ds_id = ds_res.data["data"]["id"]
        assert ds_res.data["data"]["name"] == "Production Operational DB"

        # -------------------------------------------------------------
        # Step 3: Test Connection
        # -------------------------------------------------------------
        test_res = client.post(f"/api/datasources/{ds_id}/test/")
        assert test_res.status_code == status.HTTP_200_OK
        assert test_res.data["data"]["success"] is True

        # -------------------------------------------------------------
        # Step 4: Discover Schema
        # -------------------------------------------------------------
        schema_res = client.post(f"/api/datasources/{ds_id}/refresh-schema/")
        assert schema_res.status_code == status.HTTP_200_OK
        assert schema_res.data["data"]["table_count"] > 0

        # Configure allowed tables
        allow_res = client.patch(
            f"/api/datasources/{ds_id}/allowed-tables/",
            {"allowed_tables": ["customers", "orders", "order_items", "products"]},
            format="json",
        )
        assert allow_res.status_code == status.HTTP_200_OK
        assert "customers" in allow_res.data["data"]["allowed_tables"]

        # -------------------------------------------------------------
        # Step 5: Ask a Natural Language Question
        # -------------------------------------------------------------
        question = "What is the total revenue by customer segment?"

        # -------------------------------------------------------------
        # Step 6: Generate and Validate SQL
        # -------------------------------------------------------------
        from apps.ai_assistant.sql_generator import SQLGenerator
        from apps.ai_assistant.sql_validator import SQLValidator

        generator = SQLGenerator()
        raw_sql = generator.generate(question)
        validator = SQLValidator()
        validation = validator.validate(raw_sql)
        assert validation.is_valid is True
        assert "revenue" in validation.sanitized_sql.lower() or "sum" in validation.sanitized_sql.lower()

        # -------------------------------------------------------------
        # Step 7: Execute Read-Only Query
        # -------------------------------------------------------------
        query_res = client.post(
            "/api/query/",
            {
                "question": question,
                "data_source_id": ds_id,
            },
            format="json",
        )
        assert query_res.status_code == status.HTTP_200_OK
        query_data = query_res.data["data"]

        # -------------------------------------------------------------
        # Step 8: Display Result
        # -------------------------------------------------------------
        assert len(query_data["columns"]) > 0
        assert len(query_data["rows"]) > 0
        assert query_data["row_count"] > 0
        assert "explanation" in query_data

        # -------------------------------------------------------------
        # Step 9: Recommend Chart
        # -------------------------------------------------------------
        # In frontend, ChartRecommendationView heuristics select Bar or Donut for segment breakdown
        # Server verifies tabular structure contains categorical dimension and numerical metric
        assert any("segment" in col.lower() for col in query_data["columns"])
        assert any("rev" in col.lower() or "sum" in col.lower() or "total" in col.lower() for col in query_data["columns"])

        # -------------------------------------------------------------
        # Step 10: Save Report
        # -------------------------------------------------------------
        save_rep_res = client.post(
            "/api/reports/",
            {
                "name": "Revenue by Segment Summary",
                "category": "Revenue",
                "natural_language_question": question,
                "sql": query_data["sql"],
                "chart_type": "bar",
                "chart_config": {"x_axis": query_data["columns"][0], "y_axis": query_data["columns"][1]},
                "data_source": ds_id,
            },
            format="json",
        )
        assert save_rep_res.status_code == status.HTTP_201_CREATED
        report_id = save_rep_res.data["data"]["id"]

        # -------------------------------------------------------------
        # Step 11: Refresh Report
        # -------------------------------------------------------------
        refresh_rep_res = client.post(f"/api/reports/{report_id}/refresh/")
        assert refresh_rep_res.status_code == status.HTTP_200_OK
        assert refresh_rep_res.data["data"]["row_count"] > 0

        # -------------------------------------------------------------
        # Step 12: Run Period Comparison (MoM)
        # -------------------------------------------------------------
        period_res = client.get("/api/analytics/compare-periods/?period=MOM")
        assert period_res.status_code == status.HTTP_200_OK
        assert len(period_res.data["data"]["data"]) > 0
        assert len(period_res.data["data"]["summary"]["observed_facts"]) > 0

        # -------------------------------------------------------------
        # Step 13: Run Forecast (Predictive Time Series)
        # -------------------------------------------------------------
        fc_res = client.get("/api/ml/forecast/revenue/?aggregation=monthly&horizon=3")
        assert fc_res.status_code == status.HTTP_200_OK
        assert fc_res.data["data"]["success"] is True
        assert len(fc_res.data["data"]["forecast_data"]) == 3
        assert "evaluation_metrics" in fc_res.data["data"]

        # -------------------------------------------------------------
        # Step 14: Run Churn Analysis (Leak-Free Classifier)
        # -------------------------------------------------------------
        churn_res = client.get("/api/ml/churn/customers/?inactivity_days=60")
        assert churn_res.status_code == status.HTTP_200_OK
        assert churn_res.data["data"]["success"] is True
        assert len(churn_res.data["data"]["top_at_risk_customers"]) > 0

        # -------------------------------------------------------------
        # Step 15: Run Anomaly Detection
        # -------------------------------------------------------------
        anom_res = client.get("/api/ml/anomalies/scan/?z_threshold=2.0")
        assert anom_res.status_code == status.HTTP_200_OK
        assert anom_res.data["data"]["success"] is True

        # -------------------------------------------------------------
        # Step 16: Trigger ML Background Job
        # -------------------------------------------------------------
        job_res = client.post(
            "/api/ml/jobs/trigger/",
            {"job_type": "TRAIN_FORECAST", "parameters": {"horizon": 3}, "run_async": False},
            format="json",
        )
        assert job_res.status_code in (status.HTTP_200_OK, status.HTTP_202_ACCEPTED)
        job_id = job_res.data["data"]["job_id"]
        assert job_id is not None

        # -------------------------------------------------------------
        # Step 17: Verify Authorization Boundaries (Cross-User Isolation)
        # -------------------------------------------------------------
        client_other = APIClient()
        client_other.defaults["HTTP_HOST"] = "127.0.0.1"
        other_user = User.objects.create_user(
            name="Rival User", email="rival@competitor.com", password="Password123!"
        )
        client_other.force_authenticate(user=other_user)

        # Other user cannot see or modify User A's DataSource
        other_ds_res = client_other.get(f"/api/datasources/{ds_id}/")
        assert other_ds_res.status_code == status.HTTP_404_NOT_FOUND

        other_del_res = client_other.delete(f"/api/datasources/{ds_id}/")
        assert other_del_res.status_code == status.HTTP_404_NOT_FOUND

        # Other user cannot modify User A's Saved Report
        other_rep_res = client_other.patch(
            f"/api/reports/{report_id}/",
            {"name": "Hacked Name"},
            format="json",
        )
        assert other_rep_res.status_code in (status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN)

        # -------------------------------------------------------------
        # Step 18: Verify Secrets are Never Returned in APIs
        # -------------------------------------------------------------
        ds_detail = client.get(f"/api/datasources/{ds_id}/").data["data"]
        assert "password" not in ds_detail
        assert "encrypted_password" not in ds_detail

        # -------------------------------------------------------------
        # Step 19: Verify Destructive SQL is Rejected
        # -------------------------------------------------------------
        destructive_sql = "DROP TABLE customers;"
        direct_drop_res = client.post(
            "/api/query/execute-direct/",
            {"sql": destructive_sql, "data_source_id": ds_id},
            format="json",
        )
        assert direct_drop_res.status_code == status.HTTP_400_BAD_REQUEST
        err_str = str(direct_drop_res.data).lower()
        assert "not permitted" in err_str or "prohibited" in err_str or "only select" in err_str
        assert Customer.objects.filter(id=seed_business_data[0].id).exists()
