"""Real database benchmarking command measuring EXPLAIN ANALYZE and query performance."""

import logging
import time
from typing import Any

from django.core.management.base import BaseCommand
from django.db import connection

logger = logging.getLogger(__name__)

BENCHMARK_SUITE = [
    {
        "name": "Customer Lifetime Value Join",
        "description": "JOIN between customers and orders with aggregation and descending order.",
        "sql": """
        SELECT
            c.id, c.name, c.country, c.customer_segment,
            COUNT(o.id) AS order_count,
            ROUND(SUM(o.total_amount)::numeric, 2) AS total_revenue
        FROM customers c
        INNER JOIN orders o ON c.id = o.customer_id
        WHERE o.status = 'COMPLETED'
        GROUP BY c.id, c.name, c.country, c.customer_segment
        ORDER BY total_revenue DESC
        LIMIT 10;
        """,
        "sqlite_sql": """
        SELECT
            c.id, c.name, c.country, c.customer_segment,
            COUNT(o.id) AS order_count,
            ROUND(SUM(o.total_amount), 2) AS total_revenue
        FROM customers c
        INNER JOIN orders o ON c.id = o.customer_id
        WHERE o.status = 'COMPLETED'
        GROUP BY c.id, c.name, c.country, c.customer_segment
        ORDER BY total_revenue DESC
        LIMIT 10;
        """,
        "key_index": "idx_order_customer_date (orders.customer_id)",
    },
    {
        "name": "Monthly Revenue Timeseries",
        "description": "Date truncation and monthly aggregation across transactions.",
        "sql": """
        SELECT
            DATE_TRUNC('month', order_date)::date AS sales_month,
            COUNT(id) AS total_orders,
            ROUND(SUM(total_amount)::numeric, 2) AS monthly_revenue,
            ROUND(AVG(total_amount)::numeric, 2) AS avg_order_value
        FROM orders
        WHERE status = 'COMPLETED'
        GROUP BY DATE_TRUNC('month', order_date)
        ORDER BY sales_month ASC;
        """,
        "sqlite_sql": """
        SELECT
            strftime('%Y-%m', order_date) AS sales_month,
            COUNT(id) AS total_orders,
            ROUND(SUM(total_amount), 2) AS monthly_revenue,
            ROUND(AVG(total_amount), 2) AS avg_order_value
        FROM orders
        WHERE status = 'COMPLETED'
        GROUP BY strftime('%Y-%m', order_date)
        ORDER BY sales_month ASC;
        """,
        "key_index": "idx_order_date_status (orders.order_date, orders.status)",
    },
    {
        "name": "Top Products per Category with Window Function",
        "description": "Multi-table join with DENSE_RANK() partitioning by category.",
        "sql": """
        WITH CategoryRanks AS (
            SELECT
                p.category,
                p.name AS product_name,
                SUM(oi.quantity) AS units_sold,
                ROUND(SUM(oi.subtotal)::numeric, 2) AS total_revenue,
                DENSE_RANK() OVER (
                    PARTITION BY p.category
                    ORDER BY SUM(oi.subtotal) DESC
                ) AS rank_in_cat
            FROM products p
            INNER JOIN order_items oi ON p.id = oi.product_id
            INNER JOIN orders o ON oi.order_id = o.id
            WHERE o.status = 'COMPLETED'
            GROUP BY p.category, p.id, p.name
        )
        SELECT category, rank_in_cat, product_name, units_sold, total_revenue
        FROM CategoryRanks
        WHERE rank_in_cat <= 3
        ORDER BY category, rank_in_cat;
        """,
        "sqlite_sql": """
        WITH CategoryRanks AS (
            SELECT
                p.category,
                p.name AS product_name,
                SUM(oi.quantity) AS units_sold,
                ROUND(SUM(oi.subtotal), 2) AS total_revenue,
                DENSE_RANK() OVER (
                    PARTITION BY p.category
                    ORDER BY SUM(oi.subtotal) DESC
                ) AS rank_in_cat
            FROM products p
            INNER JOIN order_items oi ON p.id = oi.product_id
            INNER JOIN orders o ON oi.order_id = o.id
            WHERE o.status = 'COMPLETED'
            GROUP BY p.category, p.id, p.name
        )
        SELECT category, rank_in_cat, product_name, units_sold, total_revenue
        FROM CategoryRanks
        WHERE rank_in_cat <= 3
        ORDER BY category, rank_in_cat;
        """,
        "key_index": "idx_item_order_product (order_items.order_id, order_items.product_id)",
    },
    {
        "name": "High-Velocity Telemetry Funnel",
        "description": "Event aggregation across clickstream dataset with customer mapping.",
        "sql": """
        SELECT
            event_type,
            COUNT(id) AS total_events,
            COUNT(DISTINCT customer_id) AS active_customers
        FROM website_events
        GROUP BY event_type
        ORDER BY total_events DESC;
        """,
        "sqlite_sql": """
        SELECT
            event_type,
            COUNT(id) AS total_events,
            COUNT(DISTINCT customer_id) AS active_customers
        FROM website_events
        GROUP BY event_type
        ORDER BY total_events DESC;
        """,
        "key_index": "idx_event_type_timestamp (website_events.event_type)",
    },
    {
        "name": "90-Day Churn Inactivity Analysis",
        "description": "LEFT JOIN detecting customers with no orders in past 90 days.",
        "sql": """
        SELECT
            c.id, c.name, c.email, c.customer_segment,
            MAX(o.order_date) AS last_order_date
        FROM customers c
        LEFT JOIN orders o ON c.id = o.customer_id
        GROUP BY c.id, c.name, c.email, c.customer_segment
        HAVING MAX(o.order_date) < (CURRENT_DATE - INTERVAL '90 days')
            OR MAX(o.order_date) IS NULL
        ORDER BY last_order_date ASC NULLS FIRST
        LIMIT 20;
        """,
        "sqlite_sql": """
        SELECT
            c.id, c.name, c.email, c.customer_segment,
            MAX(o.order_date) AS last_order_date
        FROM customers c
        LEFT JOIN orders o ON c.id = o.customer_id
        GROUP BY c.id, c.name, c.email, c.customer_segment
        HAVING MAX(o.order_date) < datetime('now', '-90 days')
            OR MAX(o.order_date) IS NULL
        ORDER BY last_order_date ASC
        LIMIT 20;
        """,
        "key_index": "idx_order_customer_date",
    },
]


class Command(BaseCommand):
    help = "Execute real query performance benchmarks with EXPLAIN ANALYZE and output metrics."

    def add_arguments(self, parser):
        parser.add_argument(
            "--runs",
            type=int,
            default=5,
            help="Number of iterations to run each benchmark query for statistical averaging.",
        )
        parser.add_argument(
            "--output-file",
            type=str,
            default="",
            help="Optional file path to write generated markdown benchmark report (e.g., docs/database-performance.md).",
        )

    def handle(self, *args, **options):
        runs = options["runs"]
        output_file = options["output_file"]
        is_postgres = connection.vendor == "postgresql"

        self.stdout.write(self.style.NOTICE(f"Starting Database Benchmark Suite ({connection.vendor.upper()}, {runs} iterations per test)...\n"))

        results = []

        with connection.cursor() as cursor:
            for item in BENCHMARK_SUITE:
                query_sql = item["sql"] if is_postgres else item["sqlite_sql"]
                self.stdout.write(f"Executing: {item['name']}...")

                # 1. Warm up run
                try:
                    cursor.execute(query_sql)
                    cursor.fetchall()
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  Warm-up failed: {e}"))
                    continue

                # 2. Timing iterations
                times = []
                for _ in range(runs):
                    t0 = time.perf_counter()
                    cursor.execute(query_sql)
                    cursor.fetchall()
                    t1 = time.perf_counter()
                    times.append((t1 - t0) * 1000)

                avg_ms = round(sum(times) / len(times), 2)
                min_ms = round(min(times), 2)
                max_ms = round(max(times), 2)

                # 3. Query Plan / EXPLAIN
                explain_plan = ""
                try:
                    if is_postgres:
                        cursor.execute(f"EXPLAIN (ANALYZE, BUFFERS) {query_sql}")
                        explain_rows = cursor.fetchall()
                        explain_plan = "\n".join(r[0] for r in explain_rows)
                    else:
                        cursor.execute(f"EXPLAIN QUERY PLAN {query_sql}")
                        explain_rows = cursor.fetchall()
                        explain_plan = "\n".join(str(r) for r in explain_rows)
                except Exception as e:
                    explain_plan = f"EXPLAIN unavailable: {e}"

                results.append({
                    "name": item["name"],
                    "description": item["description"],
                    "key_index": item["key_index"],
                    "avg_ms": avg_ms,
                    "min_ms": min_ms,
                    "max_ms": max_ms,
                    "runs": runs,
                    "plan": explain_plan,
                })

                self.stdout.write(self.style.SUCCESS(f"  Average: {avg_ms} ms (Min: {min_ms} ms, Max: {max_ms} ms)"))

        # Print Markdown Summary Table
        markdown_report = self._generate_markdown(results, is_postgres)
        self.stdout.write("\n" + markdown_report)

        if output_file:
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(markdown_report)
            self.stdout.write(self.style.SUCCESS(f"\nBenchmark report successfully written to {output_file}"))

    def _generate_markdown(self, results: list[dict[str, Any]], is_postgres: bool) -> str:
        lines = [
            "# Database Performance & Query Optimization Benchmarks",
            "",
            f"> **Engine**: {'PostgreSQL 16' if is_postgres else 'SQLite (Local Engine)'}  ",
            "> **Methodology**: Real execution telemetry measured across multiple isolated test runs.  ",
            "> *Note: Timings are measured in milliseconds (ms) on actual database data.*",
            "",
            "## Summary Performance Table",
            "",
            "| Benchmark Query | Key Index Utilized | Avg Latency | Min Latency | Max Latency |",
            "| :--- | :--- | :---: | :---: | :---: |",
        ]

        for r in results:
            lines.append(f"| **{r['name']}** | `{r['key_index']}` | **{r['avg_ms']} ms** | {r['min_ms']} ms | {r['max_ms']} ms |")

        lines.extend([
            "",
            "## Query Execution Plans & Engineering Analysis",
            "",
        ])

        for r in results:
            lines.extend([
                f"### {r['name']}",
                f"*{r['description']}*",
                "",
                f"- **Target Index**: `{r['key_index']}`",
                f"- **Average Duration**: `{r['avg_ms']} ms`",
                "",
                "```text",
                r['plan'],
                "```",
                "",
            ])

        return "\n".join(lines)
