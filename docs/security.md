# Security Model & Production Hardening Architecture

The **AI Database Assistant** implements a multi-layered defense-in-depth security model to ensure that natural language questions, AI-generated SQL, and direct analytics queries are rigorously validated, bounded, and audited before reaching the database engine.

---

## 1. Threat Model & Mitigation Matrix

| Threat Category | Potential Attack Vector | Mitigation in AI Database Assistant |
| :--- | :--- | :--- |
| **Data Modification (DML)** | AI generates or injects `DELETE`, `UPDATE`, or `INSERT` queries. | AST Keyword Scanner + `SET TRANSACTION READ ONLY` on PostgreSQL transaction. |
| **Schema Destruction (DDL)** | Prompt injection generates `DROP TABLE customers;`, `TRUNCATE`, or `ALTER`. | Immediate rejection by AST Token Scanner; logged to `QueryHistory` with status `BLOCKED`. |
| **Credential Exfiltration** | Queries like `SELECT password FROM users;` or `SELECT * FROM users;`. | Strict column blocklist (`FORBIDDEN_COLUMNS`) and prohibition of wildcards on sensitive tables (`users`). |
| **Query Chaining / Injection** | Semicolons used to execute stacked statements (`SELECT 1; DROP TABLE users;`). | AST parser splits queries; rejects any payload where statement count != 1. |
| **Null-Byte Injection** | Embedded `\x00` characters attempting to truncate strings or bypass parser regexes. | Early null-byte scanner rejects payloads before parsing (`NULL_BYTE_DETECTED`). |
| **Denial of Service (CPU / Loop)** | `WITH RECURSIVE` CTE infinite loops or expensive cartesian products. | Explicit AST ban on `RECURSIVE`; PostgreSQL `SET LOCAL statement_timeout = 10000;`. |
| **Memory Exhaustion (DoS)** | Queries returning millions of rows or gigabytes of serialized JSON. | Bounded `cursor.fetchmany(MAX_ROWS)` + incremental serialized byte tracking enforcing `MAX_RESULT_SIZE_MB` (5 MB default). |
| **Dangerous Internal Functions** | Exploitation of PostgreSQL built-ins (`pg_read_file`, `query_to_xml`, `lo_export`, `dblink`). | Regex and AST pattern detection blocking file I/O, XML extraction, dblink, process termination, and server address disclosure. |
| **Catalog & Schema Enumeration** | Queries targeting `pg_catalog`, `information_schema`, or `django_migrations`. | Strict table allowlist limited to business analytics models; schema qualifications restricted exclusively to `public`. |
| **Multi-Tenant History Leakage** | Users viewing or re-running other users' proprietary query history. | Object-level queryset filtering in DRF: authenticated users only access their own history; anonymous callers cannot access authenticated queries. |
| **API Denial of Service / Flooding**| Repeated automated AI requests or expensive SQL executions. | DRF Throttling enabled (`AnonRateThrottle` at 120/min, `UserRateThrottle` at 600/min, scoped `ai_query`). |
| **Container Compromise / Escape** | Attacker gaining shell access inside Docker container. | Non-root container execution (`USER appuser`) in `Dockerfile`; drop of root privileges. |

---

## 2. Multi-Stage SQL Validation Pipeline

```mermaid
flowchart TD
    RawSQL["Input SQL Query"] --> Step1["Step 1: Null-Byte & Length Check<br/>(No \\x00, len <= MAX_SQL_LENGTH)"]
    Step1 --> Step2["Step 2: Comment Stripping & Audit<br/>(Strip /* */ and --)"]
    Step2 --> Step3["Step 3: Statement Count Check<br/>(Exactly ONE statement allowed)"]
    Step3 --> Step4["Step 4: AST Root Statement Check<br/>(Must be SELECT or non-recursive WITH)"]
    Step4 --> Step5["Step 5: Prohibited Keyword Scan<br/>(DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, INTO, SHARE, etc.)"]
    Step5 --> Step6["Step 6: Dangerous Function & Pattern Scan<br/>(pg_read_file, query_to_xml, dblink, lo_export, pg_sleep)"]
    Step6 --> Step7["Step 7: Sensitive Column Protection<br/>(No password, token, api_key; No * on users)"]
    Step7 --> Step8["Step 8: Table & Schema Allowlist Containment<br/>(Only allowed analytics tables; Only public schema)"]
    Step8 --> Step9["Step 9: Automatic LIMIT Enforcer<br/>(Appends or clamps LIMIT <= MAX_ROWS)"]
    Step9 --> Ready["Safe Executable Read-Only SQL"]
```

---

## 3. Database Execution Boundaries & Isolation

When safe SQL is dispatched to PostgreSQL:

```python
with transaction.atomic():
    with connection.cursor() as cursor:
        if connection.vendor == "postgresql":
            # 1. Statement Timeout: Terminates query if execution exceeds MAX_QUERY_SECONDS (default 10s)
            cursor.execute(f"SET LOCAL statement_timeout = {timeout_ms};")
            
            # 2. Read-Only Transaction: Engine-level guarantee preventing any data mutation
            cursor.execute("SET TRANSACTION READ ONLY;")

        # 3. Dynamic Quote Identification
        cursor.execute(sanitized_sql)
        
        # 4. Bounded Row Fetching
        raw_rows = cursor.fetchmany(self.max_rows)

# 5. Memory Byte Size Check during Serialization
# Raises ValueError if approx_bytes > MAX_RESULT_SIZE_MB * 1024 * 1024
```

---

## 4. Production Environment Configuration

All security parameters are externalized in `.env` and verified via `python manage.py check --deploy`:

```env
# Application Settings
DEBUG=False
SECRET_KEY=<generate-strong-50-character-random-secret>
ALLOWED_HOSTS=ai-assistant.yourdomain.com

# PostgreSQL Connection
DATABASE_URL=postgresql://app_user:strongpassword@postgres:5432/aidb

# Security & Query Execution Limits
MAX_ROWS=1000
MAX_QUERY_SECONDS=10
MAX_SQL_LENGTH=10000
MAX_RESULT_SIZE_MB=5

# API Rate Limiting
THROTTLE_ANON_RATE=120/minute
THROTTLE_USER_RATE=600/minute
THROTTLE_AI_QUERY_RATE=60/minute

# SSL & Security Headers
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

---

## 5. Audit Logging & Non-Repudiation

Every query attempt—whether successful, blocked by validator, timed out, or failed at the database engine—is automatically recorded in `QueryHistory`:
- Natural language question
- Generated / executed SQL
- Execution status (`SUCCESS`, `BLOCKED`, `FAILED`, `TIMEOUT`)
- Execution duration in milliseconds (`execution_time_ms`)
- Row count returned
- Explicit error message and error code (e.g. `SENSITIVE_COLUMN_PROHIBITED`, `SUSPICIOUS_FUNCTION_CALL`, `UNAUTHORIZED_TABLE`)
- Owning user ID and timestamp
