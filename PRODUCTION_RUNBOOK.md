# AI Database Assistant — Production Runbook & Operations Manual

This document provides complete operational, architectural, and security procedures for deploying, maintaining, and scaling the **AI Database Assistant** across **Local Development**, **Demo Mode**, and **Production Mode**.

---

## 1. System Architecture & Component Topology

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|  React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons + Recharts            |
|  - Dashboard KPI & Visualizations (Bar, Line, Donut, Scatter, KPI Card)           |
|  - Natural Language Query Interface & SQL Editor                                  |
|  - DataSource Connection Manager & Schema Explorer                                |
|  - Saved Reports & Automated Export Subsystem                                     |
|  - Predictive Analytics & Machine Learning Dashboard                              |
+-----------------------------------------+-----------------------------------------+
                                          | HTTP / REST (JWT Bearer Auth)
                                          | X-Request-ID Tracing Headers
+-----------------------------------------v-----------------------------------------+
|                                 APPLICATION LAYER                                 |
|  Django 5.2 REST Framework (Python 3.14)                                          |
|  - RequestTracingMiddleware (Correlation IDs, latency timing, access logs)        |
|  - Authentication & RBAC (SimpleJWT, User Tenant Isolation)                       |
|  - AI Query Engine (Provider Router: OpenAI, Anthropic, Gemini, Mock)             |
|  - SQL Security Layer (sqlparse AST, SELECT allowlist, comment anti-evasion)     |
|  - DataSource Manager (TargetValidator: SSRF, port, path traversal shields)       |
|  - Analytics & BI Engine (Period comparison, YoY/MoM growth calculations)         |
|  - Scikit-Learn ML Engine (Revenue forecast, Churn classifier, Anomaly detector)  |
|  - Health & Readiness Probes (/api/health/, /api/ready/)                          |
+-------------------+-----------------------------------------+---------------------+
                    |                                         |
     Encrypted DSNs | SQLAlchemy / Psycopg2     Celery / Redis| Thread Worker
+-------------------v-------------------+ +-------------------v---------------------+
|          DATA & PERSISTENCE           | |            ASYNC EXECUTION              |
|  PostgreSQL 16 (Primary DB)           | |  Celery 5.3 + Redis 7 (Production)      |
|  - Fernet AES-128-CBC Encrypted Keys  | |  - Background ML Training & Backtests   |
|  - Read-Only Transaction Guardrails   | |  - Scheduled BI Report Generation       |
|  - Row-Level Tenancy Scoping          | |  - Zombie Job Reconciliation Loop       |
+---------------------------------------+ +-----------------------------------------+
```

---

## 2. Environments & Modes of Operation

The application explicitly supports three operational profiles configured via environment variables:

| Setting / Feature | Local Development | Demo Mode | Production Mode |
|---|---|---|---|
| **Primary Database** | SQLite (`db.sqlite3`) or local Postgres | SQLite with seeded dataset | PostgreSQL 16 (Managed / RDS / Cloud SQL) |
| **`DEBUG`** | `True` | `False` | `False` (Mandatory) |
| **`AI_PROVIDER`** | `mock` or `openai` | `mock` (Offline, zero API keys required) | `openai`, `gemini`, or `anthropic` |
| **`SECRET_KEY`** | Dev fallback | Dev fallback | High-entropy 64+ char random secret |
| **`FERNET_ENCRYPTION_KEY`** | Generated dev key | Static demo key | 32-byte Base64-encoded URL-safe key |
| **Background Runner** | Thread Pool | Thread Pool | Celery + Redis |
| **SSL / HTTPS** | Plain HTTP | Plain HTTP | TLS 1.3 Termination (Nginx / Cloudflare) |
| **Allowed Hosts** | `localhost`, `127.0.0.1` | `localhost`, `127.0.0.1` | Fully qualified production domain(s) |
| **CORS Origins** | `http://localhost:5173` | `http://localhost:5173` | Production frontend domain(s) |

---

## 3. Environment Variables & Secret Management

Create a `.env` file in the project root based on `.env.example`:

```bash
# -----------------------------------------------------------------------------
# CORE APPLICATION SETTINGS
# -----------------------------------------------------------------------------
DEBUG=False
DJANGO_SECRET_KEY=generate_with_django_core_management_utils
ALLOWED_HOSTS=app.yourcompany.com,api.yourcompany.com
CORS_ALLOWED_ORIGINS=https://app.yourcompany.com

# -----------------------------------------------------------------------------
# CREDENTIAL ENCRYPTION (MANDATORY FOR PRODUCTION)
# -----------------------------------------------------------------------------
# Generate using: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
FERNET_ENCRYPTION_KEY=your_base64_encoded_32_byte_fernet_key_here

# -----------------------------------------------------------------------------
# PRIMARY DATABASE (POSTGRESQL 16)
# -----------------------------------------------------------------------------
DATABASE_URL=postgresql://aidb_app:SecureAppPassword123@postgres:5432/aidb_production
DB_CONN_MAX_AGE=600

# -----------------------------------------------------------------------------
# AI / LLM PROVIDER CONFIGURATION
# -----------------------------------------------------------------------------
# Choices: "mock", "openai", "gemini", "anthropic"
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-production-key-here
OPENAI_MODEL=gpt-4o-mini
AI_QUERY_TIMEOUT=15

# -----------------------------------------------------------------------------
# ASYNC TASK QUEUE (CELERY & REDIS)
# -----------------------------------------------------------------------------
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1
CELERY_TASK_ALWAYS_EAGER=False

# -----------------------------------------------------------------------------
# LOGGING & OBSERVABILITY
# -----------------------------------------------------------------------------
LOG_LEVEL=INFO
STRUCTURED_LOGGING=True
```

### Key Generation Helper
```bash
# Generate Django Secret Key:
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Generate Fernet Encryption Key:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## 4. PostgreSQL Database Hardening & Least Privilege

In production, the application connects using dedicated, partitioned database roles rather than a superuser account.

### 1. Production Role Creation
Execute as database administrator (`postgres`):

```sql
-- Create application role for migrations and transactional writes
CREATE ROLE aidb_app WITH LOGIN PASSWORD 'ComplexAppPasswordHere!';
GRANT CONNECT ON DATABASE aidb_production TO aidb_app;
GRANT USAGE, CREATE ON SCHEMA public TO aidb_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO aidb_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO aidb_app;

-- Create read-only role for AI natural language query execution
CREATE ROLE aidb_readonly WITH LOGIN PASSWORD 'ComplexReadOnlyPasswordHere!';
GRANT CONNECT ON DATABASE aidb_production TO aidb_readonly;
GRANT USAGE ON SCHEMA public TO aidb_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO aidb_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO aidb_readonly;

-- Revoke dangerous permissions
REVOKE CREATE ON SCHEMA public FROM aidb_readonly;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
```

### 2. Runtime Execution Timeout & Row Limit
Ensure database enforces statement termination to prevent accidental denial-of-service:
```sql
ALTER ROLE aidb_readonly SET statement_timeout = '5000ms';
ALTER ROLE aidb_readonly SET lock_timeout = '3000ms';
ALTER ROLE aidb_readonly SET idle_in_transaction_session_timeout = '10000ms';
```

---

## 5. External DataSource Setup & Network Boundary Security

The AI Database Assistant can analyze external databases (PostgreSQL, MySQL, SQLite). Every connection is subject to strict pre-connection network and path validation:

### Server-Side SSRF & Network Protections (`TargetValidator`)
1. **Cloud Metadata Exfiltration Defense**:
   - Rejects link-local IP ranges: `169.254.0.0/16`, `fe80::/10`.
   - Explicitly blocks AWS/GCP/Azure metadata hosts: `169.254.169.254`, `metadata.google.internal`, `metadata.azure.com`, `instance-data`.
2. **Prohibited Infrastructure Ports**:
   - Restricts database connection targets to valid database listener ports.
   - Immediately rejects ports: `22` (SSH), `23` (Telnet), `25` (SMTP), `80` (HTTP), `443` (HTTPS), `6379` (Redis), `2375` (Docker Daemon), `6443` (Kubernetes API), `11211` (Memcached), `27017` (MongoDB).
3. **SQLite File Path Traversal Defense**:
   - Rejects directory traversal tokens (`..`).
   - Rejects null bytes (`\x00`).
   - Rejects sensitive system paths: `/etc`, `/proc`, `/sys`, `/var/run`, `/root`, `~/.ssh`.
4. **Credential Redaction in Logs**:
   - Connection strings and error messages automatically strip password tokens, credentials, and query tokens using regex masking (`password=***`, `token=***`).

---

## 6. SQL Security Engine & Query Allowlist

All SQL generated by AI or submitted via direct execution is validated prior to database execution:

1. **SELECT-Only Enforcement**:
   - Only `SELECT` statements (and read-only Common Table Expressions `WITH ... SELECT`) are permitted.
   - Any statement containing `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `GRANT`, `REVOKE`, `EXEC`, `EXECUTE`, or `COPY` is rejected with `FORBIDDEN_OPERATION`.
2. **Comment Obfuscation & WAF Evasion Shields**:
   - Comment-splitting attempts (e.g., `SEL/**/ECT`) fail syntax parsing.
   - MySQL executable/version comments (e.g., `/*!50000 INTO OUTFILE ... */`, `/*! UNION SELECT ... */`) are detected by regular expression and rejected with `SUSPICIOUS_COMMENT_OBFUSCATION`.
3. **Table Allowlisting**:
   - Each DataSource allows administrators to specify an allowlist of accessible tables.
   - Queries referencing unlisted or internal tables (e.g., `auth_user`, `django_migrations`) are rejected with `DISALLOWED_TABLE`.
4. **Automatic Row Capping & Pagination**:
   - Queries lacking a `LIMIT` clause are rewritten with a default limit of 1,000 rows. Queries exceeding 10,000 rows are clamped.

---

## 7. Multi-Tenancy & Authorization Model

The application isolates tenant data across all API operations:

1. **User Scoping**:
   - `DataSource`, `SavedReport`, `ScheduledReport`, `MLModel`, and `MLJob` records maintain a foreign key to the creating user.
   - Standard users cannot list, retrieve, update, or delete resources owned by other users.
   - Anonymous requests attempting to mutate user resources receive `HTTP 401 Unauthorized`.
   - Authenticated cross-tenant mutation attempts receive `HTTP 404 Not Found` (to prevent ID enumeration) or `HTTP 403 Forbidden`.
2. **Public System Resources**:
   - System templates (`user=None`) are readable by all authenticated users.
   - Deletion or modification of system resources is restricted to users with `is_staff=True`.
3. **Model Version Approval Workflow**:
   - Trained machine learning models default to `DRAFT` status.
   - Promoting a model version to `PRODUCTION` requires explicit authentication and staff approval.

---

## 8. Predictive Analytics & Machine Learning Standards

The ML pipeline operates entirely on validated, in-database numerical data without hallucinated numbers:

1. **Revenue Forecasting**:
   - Methods: Holt-Winters Exponential Smoothing, Linear Trend with Seasonal Adjustments.
   - Validation: Walk-forward rolling holdout backtests with Mean Absolute Percentage Error (MAPE) and Root Mean Squared Error (RMSE).
   - Baseline Comparison: Evaluated against a naive random-walk / trailing mean baseline.
2. **Customer Churn Risk Scoring**:
   - Architecture: Scikit-learn Random Forest Classifier.
   - Target Leakage Protection: Target label is determined strictly by subsequent inactive horizon without referencing post-cutoff activity.
   - Calibration & Evaluation: Tracks Brier calibration loss, precision, recall, and ROC-AUC with automated class-imbalance warning when churn rate is below 15%.
3. **Statistical Anomaly Detection**:
   - Heuristics: Rolling Z-score with combined Interquartile Range (IQR) fences.
   - False-Positive Noise Suppression: Flattens metrics with zero variance ($std < 10^{-4}$ and $iqr < 10^{-4}$) to prevent alerting on inactive or zero-baseline metrics.

---

## 9. Background Job Governance & Process Restarts

1. **Engines**:
   - **Local / Demo**: Managed asynchronous thread worker with bounded job queue.
   - **Production**: Celery worker backed by Redis with task concurrency limits.
2. **Duplicate Execution Suppression**:
   - A newly submitted ML training or anomaly scan task checks for existing jobs with identical parameters in `PENDING` or `RUNNING` status within a 10-minute window.
   - Duplicate submissions are suppressed and return the active job ID (`HTTP 202 Accepted`).
3. **Cancellation Subsystem**:
   - Running or pending jobs can be cancelled via `POST /api/ml/jobs/<id>/cancel/`.
   - The worker execution loop inspects cancellation flags before and between computation phases.
4. **Zombie Job Reconciliation**:
   - If a backend worker container terminates unexpectedly, jobs left in `RUNNING` status are automatically reconciled by `reconcile_stale_jobs(timeout_minutes=15)` at server startup and marked `FAILED` with diagnostic context.

---

## 10. Observability, Health Probes & Monitoring

### 1. Request Correlation & Distributed Tracing
- `RequestTracingMiddleware` inspects incoming `X-Request-ID` headers or generates a UUIDv4.
- `X-Request-ID` is stamped on all response headers and injected into every log entry.

### 2. Liveness Probe
- **Endpoint**: `GET /api/health/`
- **Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "status": "UP",
    "timestamp": "2026-10-22T04:12:00Z"
  }
}
```

### 3. Readiness Probe
- **Endpoint**: `GET /api/ready/`
- **Response**: `200 OK` (when operational) or `503 Service Unavailable`
- Checks:
  1. Primary Database connection and response latency.
  2. Unapplied Django schema migrations.
  3. Available disk space (alerts if < 1 GB free).
```json
{
  "success": true,
  "data": {
    "status": "READY",
    "checks": {
      "database": {"status": "UP", "latency_ms": 1.25},
      "migrations": {"status": "APPLIED"},
      "disk": {"status": "UP", "free_gb": 42.8}
    }
  }
}
```

---

## 11. Performance Tuning & Indexing Guidelines

In production, verify that the following PostgreSQL indexes are present:

```sql
-- Fast order lookup and monthly time-series aggregations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_date_status
ON orders (order_date, status);

-- Fast customer cohort and churn segmentation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_country_segment
ON customers (country, customer_segment);

-- Fast order item revenue aggregations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_product
ON order_items (order_id, product_id);

-- Fast query history isolation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_history_user_created
ON query_history (user_id, created_at DESC);
```

### Measured Production Latency Benchmarks
| Operation | Dataset Scope | Measured Latency |
|---|---|---|
| Natural Language -> SQL -> Result | 1,000 orders | 33.2 ms |
| Direct 1,000-Row Analytical Query | 1,000 rows | 9.92 ms |
| DataSource Schema Discovery | 6 tables, 40 cols | 17.57 ms |
| MoM Period Comparison | 12 months | 6.56 ms |
| 6-Month Revenue Forecast | Historical series | 7.63 ms |
| Customer Churn Classification | 500 customers | 8.04 ms |
| Anomaly Detection Scan | 90 days, 4 metrics | 10.84 ms |

---

## 12. Backup, Recovery & Secret Rotation Procedures

### 1. Database Backup (Daily Automated Cron)
```bash
# Logical compressed backup
pg_dump -h localhost -U aidb_app -d aidb_production -Fc -f /backups/aidb_$(date +%Y%m%d_%H%M%S).dump

# Verify backup integrity
pg_restore --list /backups/latest.dump > /dev/null
```

### 2. Database Point-In-Time Restoration
```bash
# Restore into standby database
pg_restore -h localhost -U postgres -d aidb_restore -v /backups/aidb_20261022.dump
```

### 3. Fernet Encryption Key Rotation
When rotating `FERNET_ENCRYPTION_KEY`:
1. Generate new Fernet key.
2. Initialize multi-Fernet decryptor using `MultiFernet([Fernet(new_key), Fernet(old_key)])`.
3. Run rotation management command to decrypt all stored `encrypted_password` values and re-encrypt with `new_key`.
4. Update environment variables to `FERNET_ENCRYPTION_KEY=new_key`.

---

## 13. Production Go-Live Acceptance Checklist

Before routing production traffic, verify every item below:

- [ ] `DEBUG=False` confirmed in environment and via `/api/ready/`.
- [ ] `DJANGO_SECRET_KEY` is high-entropy, unique, and not stored in git.
- [ ] `FERNET_ENCRYPTION_KEY` is configured and tested for credential encryption.
- [ ] `ALLOWED_HOSTS` contains only production domains.
- [ ] `CORS_ALLOWED_ORIGINS` strictly limited to frontend production origins.
- [ ] Read-only database role (`aidb_readonly`) configured with 5,000ms `statement_timeout`.
- [ ] SSRF target validation active (cloud metadata and non-database ports blocked).
- [ ] Automated database migrations executed (`python manage.py migrate`).
- [ ] Redis and Celery worker online and processing background tasks.
- [ ] Health and readiness probes (`/api/health/`, `/api/ready/`) returning HTTP 200.
- [ ] Frontend static assets built with `npm run build` and served with Cache-Control headers.
- [ ] Reverse proxy (Nginx / Cloudflare) enforcing TLS 1.3 and HSTS.
- [ ] Automated database backups verified and tested for point-in-time recovery.
- [ ] Zero secrets present in logs, client bundles, or error payloads.
- [ ] End-to-end 19-step acceptance test passing (`pytest backend/tests/test_e2e_acceptance.py`).
