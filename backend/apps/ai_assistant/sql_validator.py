"""Enterprise SQL security validator and sanitizer."""

import re
from dataclasses import dataclass, field
from typing import Optional

import sqlparse
from django.conf import settings
from sqlparse.sql import Identifier, IdentifierList
from sqlparse.tokens import Keyword, Wildcard

from apps.ai_assistant.schema_context import ALLOWED_TABLES

# Forbidden SQL statement keywords and dangerous routines
FORBIDDEN_KEYWORDS = {
    "DROP",
    "DELETE",
    "TRUNCATE",
    "ALTER",
    "CREATE",
    "GRANT",
    "REVOKE",
    "INSERT",
    "UPDATE",
    "MERGE",
    "CALL",
    "COPY",
    "VACUUM",
    "REINDEX",
    "LOCK",
    "SET",
    "SHOW",
    "EXEC",
    "EXECUTE",
    "REPLACE",
    "SHUTDOWN",
    "INTO",
    "RECURSIVE",
    "SHARE",
    "PREPARE",
    "DEALLOCATE",
    "DISCARD",
    "LISTEN",
    "NOTIFY",
    "SECURITY",
    "DEFINER",
}

# Regex patterns matching dangerous PostgreSQL internal routines and data exfiltration vectors
FORBIDDEN_PATTERNS = [
    # Process & Denial of Service
    re.compile(r"\bpg_sleep(?:_for|_until)?\b", re.IGNORECASE),
    re.compile(r"\bpg_terminate_backend\b", re.IGNORECASE),
    re.compile(r"\bpg_cancel_backend\b", re.IGNORECASE),
    re.compile(r"\bpg_reload_conf\b", re.IGNORECASE),
    re.compile(r"\bpg_rotate_logfile\b", re.IGNORECASE),
    # Advisory locks & locking DoS
    re.compile(r"\bpg_(?:advisory_lock|advisory_unlock)\w*\b", re.IGNORECASE),
    # State-changing sequences
    re.compile(r"\b(?:setval|nextval)\b", re.IGNORECASE),
    # System catalogs & schemas
    re.compile(r"\bpg_catalog\b", re.IGNORECASE),
    re.compile(r"\binformation_schema\b", re.IGNORECASE),
    re.compile(r"\bpg_toast\b", re.IGNORECASE),
    re.compile(r"\bpg_temp\b", re.IGNORECASE),
    # Sensitive internal PostgreSQL tables
    re.compile(r"\b(?:pg_shadow|pg_authid|pg_user|pg_roles|pg_database|pg_tablespace|pg_settings|pg_stat_activity)\b", re.IGNORECASE),
    # File I/O & Large Object tampering
    re.compile(r"\bpg_(?:read|write|read_binary|write_binary)_file\b", re.IGNORECASE),
    re.compile(r"\bpg_ls_dir\b", re.IGNORECASE),
    re.compile(r"\bpg_stat_file\b", re.IGNORECASE),
    re.compile(r"\blo_(?:export|import|get|put|unlink)\b", re.IGNORECASE),
    # XML Data Exfiltration
    re.compile(r"\b(?:query|table|schema|database)_to_xml(?:schema|_and_xmlschema)?\b", re.IGNORECASE),
    # Remote DB links & external connectors
    re.compile(r"\bdblink(?:_exec|_connect|_open|_fetch|_close)?\b", re.IGNORECASE),
    # Settings & configuration manipulation
    re.compile(r"\bcurrent_setting\b", re.IGNORECASE),
    re.compile(r"\bset_config\b", re.IGNORECASE),
    # Administrative & diagnostic routines
    re.compile(r"\bpg_(?:export_snapshot|log_backend_memory_contexts|switch_wal|create_restore_point|walfile_name|current_wal_)\w*\b", re.IGNORECASE),
    # System network & server address disclosure
    re.compile(r"\b(?:inet_client_addr|inet_client_port|inet_server_addr|inet_server_port|txid_current|pg_backend_pid|pg_current_snapshot)\b", re.IGNORECASE),
    # File dump attacks
    re.compile(r"\binto\s+(?:out|dump)file\b", re.IGNORECASE),
    # Transaction boundary manipulation within read-only queries
    re.compile(r"\b(?:begin|commit|rollback|savepoint)\b", re.IGNORECASE),
]

# Regex patterns matching dangerous MySQL internal routines and exfiltration
MYSQL_FORBIDDEN_PATTERNS = [
    re.compile(r"\bbenchmark\s*\(", re.IGNORECASE),
    re.compile(r"\bsleep\s*\(", re.IGNORECASE),
    re.compile(r"\bload_file\s*\(", re.IGNORECASE),
    re.compile(r"\b(?:performance_schema|mysql|sys)\b", re.IGNORECASE),
]

# Regex patterns matching dangerous SQLite commands and introspection tables
SQLITE_FORBIDDEN_PATTERNS = [
    re.compile(r"\bpragma\b", re.IGNORECASE),
    re.compile(r"\battach\s+(?:database\s+)?", re.IGNORECASE),
    re.compile(r"\bdetach\s+(?:database\s+)?", re.IGNORECASE),
    re.compile(r"\b(?:sqlite_master|sqlite_schema|sqlite_temp_schema)\b", re.IGNORECASE),
]

# Sensitive database columns that must never be exposed or returned in analytics queries
FORBIDDEN_COLUMNS = {
    "password",
    "password_hash",
    "token",
    "secret",
    "is_superuser",
    "api_key",
    "access_token",
    "refresh_token",
    "auth_token",
    "private_key",
    "secret_key",
    "reset_token",
}


@dataclass
class ValidationResult:
    is_valid: bool
    sanitized_sql: str
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    tables_used: list[str] = field(default_factory=list)
    statement_type: str = "SELECT"


class SQLValidator:
    """
    Validates AI-generated SQL queries prior to database execution.
    Enforces strict read-only AST constraints, schema containment,
    sensitive column protection, and dangerous function prohibition.
    """

    def __init__(self, max_rows: Optional[int] = None, max_sql_length: Optional[int] = None):
        self.max_rows = max_rows or getattr(settings, "MAX_ROWS", 1000)
        self.max_sql_length = max_sql_length or getattr(settings, "MAX_SQL_LENGTH", 10000)
        self.allowed_tables = set(t.lower() for t in ALLOWED_TABLES)

    def validate(
        self,
        raw_sql: str,
        allowed_tables: Optional[list[str]] = None,
        dialect: str = "postgresql",
    ) -> ValidationResult:
        """Run full multi-stage validation pipeline on raw SQL string."""
        if not raw_sql or not raw_sql.strip():
            return ValidationResult(
                is_valid=False,
                sanitized_sql="",
                error_code="EMPTY_QUERY",
                error_message="The query cannot be empty.",
            )

        # 1. Null byte detection
        if "\x00" in raw_sql:
            return ValidationResult(
                is_valid=False,
                sanitized_sql="",
                error_code="NULL_BYTE_DETECTED",
                error_message="Null byte detected in SQL string.",
            )

        sql = raw_sql.strip()

        # 2. Length validation
        if len(sql) > self.max_sql_length:
            return ValidationResult(
                is_valid=False,
                sanitized_sql=sql,
                error_code="EXCESSIVE_LENGTH",
                error_message=f"Query exceeds maximum character length limit of {self.max_sql_length}.",
            )

        # 3. Comments check and stripping
        # Check for MySQL version-conditional / executable comments (/*!...*/) which bypass comment stripping
        if re.search(r"/\*!", sql):
            return ValidationResult(
                is_valid=False,
                sanitized_sql=sql,
                error_code="SUSPICIOUS_COMMENT_OBFUSCATION",
                error_message="Executable SQL comments (/*!...*/) are strictly prohibited.",
            )

        if "/*" in sql or "--" in sql:
            sql = sqlparse.format(sql, strip_comments=True).strip()
            if not sql:
                return ValidationResult(
                    is_valid=False,
                    sanitized_sql="",
                    error_code="INVALID_COMMENTS",
                    error_message="Query contains only comments.",
                )

        # 4. Multiple statement check (prohibit semicolon chaining)
        statements = sqlparse.split(sql)
        statements = [s.strip().rstrip(";") for s in statements if s.strip().rstrip(";")]
        if len(statements) > 1:
            return ValidationResult(
                is_valid=False,
                sanitized_sql=sql,
                error_code="MULTIPLE_STATEMENTS",
                error_message="Multiple SQL statements are strictly forbidden. Only a single query may be executed.",
            )

        single_sql = statements[0] if statements else sql.rstrip(";")

        # 5. Dangerous regex patterns check
        for pattern in FORBIDDEN_PATTERNS:
            if pattern.search(single_sql):
                return ValidationResult(
                    is_valid=False,
                    sanitized_sql=single_sql,
                    error_code="SUSPICIOUS_FUNCTION_CALL",
                    error_message="Query contains restricted internal PostgreSQL functions or catalog access.",
                )

        # Dialect-specific dangerous pattern checks
        if dialect == "mysql":
            for pattern in MYSQL_FORBIDDEN_PATTERNS:
                if pattern.search(single_sql):
                    return ValidationResult(
                        is_valid=False,
                        sanitized_sql=single_sql,
                        error_code="SUSPICIOUS_FUNCTION_CALL",
                        error_message="Query contains restricted MySQL functions or system tables.",
                    )
        elif dialect == "sqlite":
            for pattern in SQLITE_FORBIDDEN_PATTERNS:
                if pattern.search(single_sql):
                    return ValidationResult(
                        is_valid=False,
                        sanitized_sql=single_sql,
                        error_code="SUSPICIOUS_FUNCTION_CALL",
                        error_message="Query contains restricted SQLite commands or schema tables.",
                    )

        # 6. Parse AST
        parsed = sqlparse.parse(single_sql)
        if not parsed:
            return ValidationResult(
                is_valid=False,
                sanitized_sql=single_sql,
                error_code="PARSE_ERROR",
                error_message="Unable to parse SQL query structure.",
            )

        stmt = parsed[0]
        statement_type = stmt.get_type()

        # Prohibit recursive CTEs
        if re.search(r"\bwith\s+recursive\b", single_sql, re.IGNORECASE):
            return ValidationResult(
                is_valid=False,
                sanitized_sql=single_sql,
                error_code="FORBIDDEN_OPERATION",
                error_message="Recursive CTEs (WITH RECURSIVE) are not permitted.",
            )

        # Statement type must strictly be SELECT or WITH
        clean_first_word = single_sql.split()[0].upper() if single_sql.split() else ""
        if statement_type != "SELECT" and clean_first_word not in ("SELECT", "WITH"):
            return ValidationResult(
                is_valid=False,
                sanitized_sql=single_sql,
                error_code="FORBIDDEN_OPERATION",
                error_message=f"The query statement type '{clean_first_word or statement_type}' is not permitted. Only read-only SELECT and WITH queries are allowed.",
            )

        # 7. Deep token scan for prohibited keywords
        for token in stmt.flatten():
            val = token.value.upper()
            if val in FORBIDDEN_KEYWORDS:
                return ValidationResult(
                    is_valid=False,
                    sanitized_sql=single_sql,
                    error_code="UNSAFE_QUERY",
                    error_message=f"The query contains a prohibited operation: '{val}'.",
                )

        # 8. Extract and validate table names & schemas
        raw_tables_used = self._extract_table_names(stmt)
        tables_used = []
        effective_allowed = (
            set(t.lower() for t in allowed_tables)
            if allowed_tables is not None
            else self.allowed_tables
        )
        for tbl in raw_tables_used:
            clean_tbl = tbl.lower().strip('"').strip("'").strip("`")
            schema_name = None
            table_name = clean_tbl
            if "." in clean_tbl:
                schema_name, table_name = clean_tbl.split(".", 1)

            if schema_name:
                # System schemas are forbidden across all dialects
                if schema_name in (
                    "pg_catalog",
                    "information_schema",
                    "pg_toast",
                    "pg_temp",
                    "mysql",
                    "performance_schema",
                    "sys",
                ):
                    return ValidationResult(
                        is_valid=False,
                        sanitized_sql=single_sql,
                        error_code="UNAUTHORIZED_SCHEMA",
                        error_message=f"Access to system schema '{schema_name}' is unauthorized.",
                    )
                # If custom allowed_tables is not specified (default analytics database)
                if allowed_tables is None and schema_name != "public":
                    return ValidationResult(
                        is_valid=False,
                        sanitized_sql=single_sql,
                        error_code="UNAUTHORIZED_SCHEMA",
                        error_message=f"Access to schema '{schema_name}' is unauthorized.",
                    )

            # Check if table or qualified name is permitted or defined as CTE
            is_allowed = (
                clean_tbl in effective_allowed
                or table_name in effective_allowed
                or self._is_cte_alias(clean_tbl, single_sql)
                or self._is_cte_alias(table_name, single_sql)
            )

            if not is_allowed:
                return ValidationResult(
                    is_valid=False,
                    sanitized_sql=single_sql,
                    error_code="UNAUTHORIZED_TABLE",
                    error_message=f"Access to table '{clean_tbl}' is unauthorized or table does not exist in schema.",
                )
            tables_used.append(table_name)

        # 9. Check for sensitive columns exfiltration
        sensitive_col_result = self._check_sensitive_columns(stmt, single_sql, tables_used)
        if not sensitive_col_result[0]:
            return ValidationResult(
                is_valid=False,
                sanitized_sql=single_sql,
                error_code="SENSITIVE_COLUMN_PROHIBITED",
                error_message=sensitive_col_result[1],
            )

        # 10. Enforce LIMIT
        enforced_sql = self._enforce_limit(single_sql)

        return ValidationResult(
            is_valid=True,
            sanitized_sql=enforced_sql,
            tables_used=list(dict.fromkeys(tables_used)),
            statement_type=statement_type if statement_type != "UNKNOWN" else clean_first_word,
        )

    def _check_sensitive_columns(self, statement, sql: str, tables_used: list[str]) -> tuple[bool, Optional[str]]:
        """Verify query does not reference or exfiltrate sensitive columns like password hashes."""
        # 1. Prohibit wildcard queries whenever the users table is referenced
        users_referenced = any(
            t.lower().split(".")[-1].strip('"\'`') == "users" for t in tables_used
        ) or bool(re.search(r"\b(?:users)\b", sql, re.IGNORECASE))

        if users_referenced:
            for token in statement.flatten():
                tok_val = token.value.strip().lower()
                if token.ttype is Wildcard or tok_val == "*" or tok_val.endswith(".*"):
                    return (
                        False,
                        "Wildcard (*) queries involving the 'users' table are prohibited to protect credential confidentiality. Explicitly specify non-sensitive columns (id, name, email, created_at).",
                    )

        # 2. Check for explicit references to forbidden columns
        for token in statement.flatten():
            clean_val = token.value.lower().strip('"\'`')
            if "." in clean_val:
                clean_val = clean_val.split(".")[-1]
            if clean_val in FORBIDDEN_COLUMNS:
                return (
                    False,
                    f"Access to sensitive column '{clean_val}' is strictly prohibited.",
                )

        return (True, None)

    def _extract_table_names(self, statement) -> list[str]:
        """Extract table names from FROM and JOIN clauses recursively."""
        tables = []
        from_seen = False

        if not hasattr(statement, "tokens"):
            return tables

        for token in statement.tokens:
            if token.is_whitespace:
                continue

            # Recurse into groups (subqueries, parenthesized CTE bodies)
            if token.is_group:
                tables.extend(self._extract_table_names(token))

            if token.ttype is Keyword:
                kw = token.value.upper()
                if kw in ("FROM", "JOIN", "INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "FULL JOIN", "CROSS JOIN"):
                    from_seen = True
                    continue
                elif kw in ("WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "WINDOW", "UNION", "INTERSECT", "EXCEPT"):
                    from_seen = False

            if from_seen:
                if isinstance(token, IdentifierList):
                    for identifier in token.get_identifiers():
                        parent = identifier.get_parent_name()
                        real_name = identifier.get_real_name() or identifier.get_name()
                        if real_name:
                            full_name = f"{parent}.{real_name}" if parent else real_name
                            tables.append(full_name)
                elif isinstance(token, Identifier):
                    parent = token.get_parent_name()
                    real_name = token.get_real_name() or token.get_name()
                    if real_name:
                        full_name = f"{parent}.{real_name}" if parent else real_name
                        tables.append(full_name)
                elif token.ttype is None and not token.is_group:
                    val = token.value.strip().split()[0]
                    if val and val.replace(".", "").replace("_", "").isalnum():
                        tables.append(val)

        return list(dict.fromkeys(tables))

    def _is_cte_alias(self, alias_name: str, sql: str) -> bool:
        """Check if table name is a CTE defined inside WITH ... AS (...)."""
        pattern = rf"\bwith\s+.*?\b{re.escape(alias_name)}\s+as\b"
        return bool(re.search(pattern, sql, re.IGNORECASE | re.DOTALL))

    def _enforce_limit(self, sql: str) -> str:
        """Ensure query has a LIMIT clause <= max_rows."""
        limit_match = re.search(r"\blimit\s+(\d+)\b", sql, re.IGNORECASE)
        if limit_match:
            existing_limit = int(limit_match.group(1))
            if existing_limit > self.max_rows:
                return re.sub(
                    r"\blimit\s+\d+\b",
                    f"LIMIT {self.max_rows}",
                    sql,
                    flags=re.IGNORECASE,
                )
            return sql
        else:
            return f"{sql.rstrip(';')}\nLIMIT {self.max_rows};"
