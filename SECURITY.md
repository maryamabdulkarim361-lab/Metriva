# Security Policy

## Supported Versions

The following versions of **AI Database Assistant** currently receive security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

---

## Reporting a Vulnerability

Security is paramount when interfacing Large Language Models with production databases.

If you discover a security vulnerability (such as a bypass in the SQL AST validator or unauthorized schema exposure), please **do NOT report it in public GitHub issues**.

Instead, report it responsibly:
- **Email**: `security@aidatabaseassistant.com`
- **Response Target**: Within 48 hours

Please include:
1. Steps to reproduce or sample payload (e.g., prompt injection or SQL token sequence).
2. The expected vs observed behavior.
3. Impact assessment.

---

## Core Security Safeguards
1. **Zero Raw DDL/DML**: The system operates exclusively in read-only mode (`SET TRANSACTION READ ONLY`).
2. **Statement Timeout Guard**: Execution aborts after `MAX_QUERY_SECONDS` (default: 10 seconds).
3. **AST Validation**: Rejects `DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `TRUNCATE`, and multiple statement chaining.
4. **Result Size Clamping**: Mandatory `LIMIT` enforcement up to `MAX_ROWS` (default: 1,000 rows) and memory size limits (`MAX_RESULT_SIZE_MB`).
5. **Sensitive Column Protection**: Access to `password`, `password_hash`, `token`, `secret`, `api_key` strictly blocked; wildcard `SELECT *` on `users` rejected.
6. **Dangerous Function Blocking**: Prohibits file I/O (`pg_read_file`), XML exfiltration (`query_to_xml`), large objects (`lo_export`), remote connections (`dblink`), and process routines (`pg_terminate_backend`).
7. **Anti-DoS Controls**: `WITH RECURSIVE` prohibited; null-byte injection blocked; request throttling via DRF.
8. **Multi-Tenant History Isolation**: Query history is scoped to the requesting user; anonymous users cannot inspect authenticated records.
9. **Unprivileged Container Execution**: Docker container runs as non-root `appuser`.
10. **No Committed Secrets**: API keys, credentials, and tokens are read exclusively from environment variables.

