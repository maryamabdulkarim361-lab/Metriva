# Connecting an External Database to Metriva (Read-Only Guide)

Metriva supports connecting live **PostgreSQL**, **MySQL**, and **SQLite** external business databases for natural language querying, automated chart generation, and executive analytics.

To protect your production systems, Metriva requires and enforces **strict read-only access**.

---

## 1. Provision a Read-Only User on Your Database

### PostgreSQL

Run the following commands as a database administrator (`postgres` or `superuser`):

```sql
-- 1. Create a dedicated read-only user
CREATE USER metriva_readonly WITH PASSWORD 'YOUR_STRONG_SECURE_PASSWORD';

-- 2. Grant connection rights to target database
GRANT CONNECT ON DATABASE "your_production_db" TO metriva_readonly;

-- 3. Connect to target database
\c your_production_db

-- 4. Grant USAGE on relevant schemas (e.g., public)
GRANT USAGE ON SCHEMA public TO metriva_readonly;

-- 5. Grant SELECT privileges only on existing and future tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO metriva_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO metriva_readonly;

-- 6. Enforce read-only transaction defaults at the user level
ALTER USER metriva_readonly SET default_transaction_read_only = on;
ALTER USER metriva_readonly SET statement_timeout = '15s';
```

### MySQL / MariaDB

```sql
-- 1. Create dedicated user restricted to your host/VPC
CREATE USER 'metriva_readonly'@'%' IDENTIFIED BY 'YOUR_STRONG_SECURE_PASSWORD';

-- 2. Grant SELECT privileges only on target database
GRANT SELECT ON your_production_db.* TO 'metriva_readonly'@'%';

-- 3. Apply privileges
FLUSH PRIVILEGES;
```

---

## 2. Register the Connection in Metriva

1. Open the Metriva Application and navigate to **Database Connections** in the sidebar.
2. Click **+ Add Connection**.
3. Choose your database engine:
   - **PostgreSQL**: Enter host, port (default `5432`), database name, username (`metriva_readonly`), and password. Set SSL mode to `require` or `prefer`.
   - **MySQL**: Enter host, port (default `3306`), database name, username (`metriva_readonly`), and password.
   - **SQLite**: Provide the path to the database file (e.g. `/app/data/my_business_data.sqlite3`).
4. Click **Test Connection**. Metriva validates:
   - Network handshake and latency.
   - SSRF and private metadata IP protection (blocks `169.254.169.254`, localhost loopback tampering, restricted infrastructure ports).
   - Valid database credentials.
5. Click **Save Connection**. Metriva automatically encrypts sensitive database credentials at rest using **Fernet symmetric encryption** (128-bit AES in CBC mode with HMAC-SHA256 authentication).

> [!NOTE]
> **Verification Status**:
> - **Internal Primary Database (PostgreSQL 16)**: Fully verified and populated with 2,500 orders and business entities.
> - **External File Database (SQLite 3)**: Verified end-to-end against live isolated B2B SaaS business data (`/app/data/test_business_db.sqlite3`).
> - **External Client/Server Databases (PostgreSQL / MySQL)**: Connector drivers and security validation pipelines are fully implemented and verified with automated test suites; live connection requires network reachability and provisioning per the steps above.

---

## 3. Configure Schema Discovery & Table Allowlists

1. On your registered data source card, click **Inspect Schema**.
2. Metriva introspects tables, columns, data types, and foreign key relations.
3. Under **Permitted Tables (AI Allowlist)**, optionally select which tables the AI query engine is authorized to access.
4. Any table not selected will be strictly prohibited by server-side Abstract Syntax Tree (AST) query validators.

---

## 4. Querying Your External Database

1. Navigate to **Natural Language Query**.
2. Select your external database from the **Target Database** dropdown.
3. Ask business questions in natural English (e.g., *"Show top accounts by MRR"* or *"List quarterly revenue by product category"*).
4. Metriva inspects the external schema, generates safe dialect-appropriate SQL, verifies that no mutations (INSERT, UPDATE, DELETE, DROP) are present, executes the query against your external database, and returns interactive visualizations and business summaries.

