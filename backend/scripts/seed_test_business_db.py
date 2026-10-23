"""
Seed script to create a standalone, safe, disposable external SQLite business database.
Schema is distinct from the demo PostgreSQL database (accounts, subscriptions, invoices vs customers, products, orders).
"""

import os
import sqlite3

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
DB_PATH = os.path.join(DATA_DIR, "test_business_db.sqlite3")


def seed_test_database():
    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")

    # 1. Accounts Table
    cursor.execute("""
    CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_name TEXT NOT NULL,
        industry TEXT NOT NULL,
        plan_tier TEXT NOT NULL CHECK(plan_tier IN ('Enterprise', 'Growth', 'Starter')),
        status TEXT NOT NULL CHECK(status IN ('active', 'trial', 'churned')),
        mrr_amount REAL NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    # 2. Subscriptions Table
    cursor.execute("""
    CREATE TABLE subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        plan_name TEXT NOT NULL,
        seats_purchased INTEGER NOT NULL,
        billing_cycle TEXT NOT NULL CHECK(billing_cycle IN ('annual', 'monthly')),
        status TEXT NOT NULL CHECK(status IN ('active', 'past_due', 'canceled')),
        renewal_date TEXT NOT NULL
    );
    """)

    # 3. Invoices Table
    cursor.execute("""
    CREATE TABLE invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        invoice_number TEXT NOT NULL UNIQUE,
        amount REAL NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('paid', 'pending', 'overdue')),
        issue_date TEXT NOT NULL,
        paid_date TEXT
    );
    """)

    # Seed Accounts
    accounts_data = [
        ("Acme Cloud", "Technology", "Enterprise", "active", 5200.0, "2024-01-15"),
        ("Nexus Dynamics", "Logistics", "Enterprise", "active", 4800.0, "2024-02-10"),
        ("Vertex AI", "Technology", "Enterprise", "active", 6500.0, "2024-03-01"),
        ("Starlight Media", "Entertainment", "Growth", "active", 1800.0, "2024-03-20"),
        ("Hyperion Health", "Healthcare", "Enterprise", "active", 7200.0, "2024-04-05"),
        ("Astra Logistics", "Supply Chain", "Growth", "active", 2100.0, "2024-05-12"),
        ("Cipher Systems", "Cybersecurity", "Enterprise", "active", 5900.0, "2024-06-01"),
        ("Prism Interactive", "Gaming", "Starter", "active", 450.0, "2024-06-18"),
        ("Zenith Energy", "Utilities", "Growth", "active", 2400.0, "2024-07-04"),
        ("Solaria Labs", "Biotech", "Starter", "trial", 0.0, "2024-08-15"),
        ("Beacon Analytics", "Marketing", "Growth", "active", 1950.0, "2024-08-22"),
        ("Echo Security", "Security", "Starter", "churned", 350.0, "2024-02-01"),
        ("Vanguard Financial", "Fintech", "Enterprise", "active", 8400.0, "2024-01-10"),
        ("Polaris Systems", "Aerospace", "Enterprise", "active", 9200.0, "2024-04-18"),
        ("OmniCorp Global", "Conglomerate", "Growth", "active", 3100.0, "2024-05-30"),
    ]
    cursor.executemany(
        "INSERT INTO accounts (account_name, industry, plan_tier, status, mrr_amount, created_at) VALUES (?, ?, ?, ?, ?, ?);",
        accounts_data,
    )

    # Seed Subscriptions
    subscriptions_data = [
        (1, "Cloud Platform Pro", 50, "annual", "active", "2027-01-15"),
        (2, "Logistics Suite", 40, "annual", "active", "2027-02-10"),
        (3, "Enterprise AI Suite", 75, "annual", "active", "2027-03-01"),
        (4, "Content Delivery Pro", 15, "monthly", "active", "2026-11-20"),
        (5, "Health Compliance Platform", 60, "annual", "active", "2027-04-05"),
        (6, "Fleet Tracker Pro", 20, "annual", "active", "2027-05-12"),
        (7, "Zero Trust Vault", 45, "annual", "active", "2027-06-01"),
        (8, "Game Engine Cloud", 5, "monthly", "active", "2026-11-18"),
        (9, "Grid Management Suite", 25, "annual", "active", "2027-07-04"),
        (10, "Genomics Sandbox", 10, "monthly", "active", "2026-11-15"),
        (11, "Attribution Engine", 18, "monthly", "active", "2026-11-22"),
        (12, "Endpoint Scanner", 5, "monthly", "canceled", "2024-08-01"),
        (13, "Banking Core Gateway", 100, "annual", "active", "2027-01-10"),
        (14, "Telemetry Hub", 120, "annual", "active", "2027-04-18"),
        (15, "Multi-Org Management", 35, "annual", "active", "2027-05-30"),
    ]
    cursor.executemany(
        "INSERT INTO subscriptions (account_id, plan_name, seats_purchased, billing_cycle, status, renewal_date) VALUES (?, ?, ?, ?, ?, ?);",
        subscriptions_data,
    )

    # Seed Invoices
    invoices_data = [
        (1, "INV-2026-001", 5200.0, "paid", "2026-10-01", "2026-10-02"),
        (2, "INV-2026-002", 4800.0, "paid", "2026-10-01", "2026-10-03"),
        (3, "INV-2026-003", 6500.0, "paid", "2026-10-01", "2026-10-01"),
        (4, "INV-2026-004", 1800.0, "paid", "2026-10-01", "2026-10-05"),
        (5, "INV-2026-005", 7200.0, "paid", "2026-10-01", "2026-10-02"),
        (6, "INV-2026-006", 2100.0, "pending", "2026-10-15", None),
        (7, "INV-2026-007", 5900.0, "paid", "2026-10-01", "2026-10-04"),
        (8, "INV-2026-008", 450.0, "paid", "2026-10-01", "2026-10-02"),
        (9, "INV-2026-009", 2400.0, "paid", "2026-10-01", "2026-10-06"),
        (11, "INV-2026-010", 1950.0, "pending", "2026-10-18", None),
        (13, "INV-2026-011", 8400.0, "paid", "2026-10-01", "2026-10-01"),
        (14, "INV-2026-012", 9200.0, "paid", "2026-10-01", "2026-10-02"),
        (15, "INV-2026-013", 3100.0, "overdue", "2026-09-15", None),
    ]
    cursor.executemany(
        "INSERT INTO invoices (account_id, invoice_number, amount, status, issue_date, paid_date) VALUES (?, ?, ?, ?, ?, ?);",
        invoices_data,
    )

    conn.commit()
    conn.close()
    print(f"Successfully generated external SQLite business database: {DB_PATH}")


if __name__ == "__main__":
    seed_test_database()

