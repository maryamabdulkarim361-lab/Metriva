"""Dialect-aware schema discovery, connection testing, and AI context formatting."""

import logging
import re
import time
from typing import Any, Optional
from urllib.parse import quote_plus

from django.utils import timezone
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

from apps.datasources.models import DataSource, DataSourceEngine, SSLMode

logger = logging.getLogger(__name__)

# System schemas that must never be exposed or queried
SYSTEM_SCHEMAS = {
    "pg_catalog",
    "information_schema",
    "pg_toast",
    "pg_temp",
    "mysql",
    "performance_schema",
    "sys",
}

# Sensitive column name patterns to redact from LLM schema context
SENSITIVE_COLUMN_PATTERNS = [
    re.compile(r"password", re.IGNORECASE),
    re.compile(r"secret", re.IGNORECASE),
    re.compile(r"token", re.IGNORECASE),
    re.compile(r"api[_-]?key", re.IGNORECASE),
    re.compile(r"private[_-]?key", re.IGNORECASE),
    re.compile(r"auth[_-]?hash", re.IGNORECASE),
    re.compile(r"salt", re.IGNORECASE),
    re.compile(r"ssn", re.IGNORECASE),
]


def _build_test_url(
    engine_type: str,
    host: str,
    port: int,
    database_name: str,
    username: str = "",
    password: str = "",
    ssl_mode: str = "prefer",
) -> str:
    """Build SQLAlchemy connection string from raw parameters for pre-save testing."""
    encoded_user = quote_plus(username) if username else ""
    encoded_pass = quote_plus(password) if password else ""
    auth = ""
    if encoded_user:
        auth = f"{encoded_user}:{encoded_pass}@" if encoded_pass else f"{encoded_user}@"

    if engine_type == DataSourceEngine.POSTGRESQL:
        query_params = []
        if ssl_mode and ssl_mode != SSLMode.DISABLE:
            query_params.append(f"sslmode={ssl_mode}")
        query_str = f"?{'&'.join(query_params)}" if query_params else ""
        return f"postgresql+psycopg://{auth}{host}:{port}/{database_name}{query_str}"

    elif engine_type == DataSourceEngine.MYSQL:
        query_params = ["charset=utf8mb4"]
        if ssl_mode and ssl_mode in (SSLMode.REQUIRE, SSLMode.VERIFY_CA, SSLMode.VERIFY_FULL):
            query_params.append("ssl_check_hostname=true")
        query_str = f"?{'&'.join(query_params)}"
        return f"mysql+pymysql://{auth}{host}:{port}/{database_name}{query_str}"

    elif engine_type == DataSourceEngine.SQLITE:
        return f"sqlite:///{database_name}"

    raise ValueError(f"Unsupported database engine: {engine_type}")


def _create_scoped_engine(url: str, engine_type: str) -> Engine:
    """Instantiate SQLAlchemy engine with tight connection timeouts and clean disposal."""
    connect_args: dict[str, Any] = {}
    if engine_type == DataSourceEngine.POSTGRESQL:
        connect_args["connect_timeout"] = 5
    elif engine_type == DataSourceEngine.MYSQL:
        connect_args["connect_timeout"] = 5
    elif engine_type == DataSourceEngine.SQLITE:
        connect_args["timeout"] = 5

    return create_engine(
        url,
        connect_args=connect_args,
        pool_pre_ping=True,
        pool_size=3,
        max_overflow=2,
        pool_recycle=300,
    )


def test_connection_params(
    engine_type: str,
    host: str,
    port: int,
    database_name: str,
    username: str = "",
    password: str = "",
    ssl_mode: str = "prefer",
) -> dict[str, Any]:
    """Test connectivity using raw connection parameters before saving to database."""
    try:
        from apps.datasources.target_validator import validate_datasource_target
        validate_datasource_target(engine_type, host, port, database_name, username)
    except Exception as exc:
        msg = str(exc.detail if hasattr(exc, "detail") else exc)
        return {"success": False, "message": f"Target security validation failed: {msg}", "code": "SSRF_OR_TARGET_REJECTED"}

    try:
        url = _build_test_url(engine_type, host, port, database_name, username, password, ssl_mode)
    except Exception as exc:
        return {"success": False, "message": str(exc), "code": "INVALID_PARAMETERS"}

    start_time = time.perf_counter()
    engine = None
    try:
        engine = _create_scoped_engine(url, engine_type)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "success": True,
            "message": f"Connection established successfully in {latency_ms}ms.",
            "latency_ms": latency_ms,
        }
    except Exception as exc:
        err_msg = _sanitize_error_message(str(exc), password)
        return {
            "success": False,
            "message": f"Connection failed: {err_msg}",
            "code": "CONNECTION_FAILED",
        }
    finally:
        if engine is not None:
            engine.dispose()


def test_datasource(datasource: DataSource) -> dict[str, Any]:
    """Test connectivity of an existing saved DataSource."""
    return test_connection_params(
        engine_type=datasource.engine,
        host=datasource.host,
        port=datasource.port,
        database_name=datasource.database_name,
        username=datasource.username,
        password=datasource.get_password(),
        ssl_mode=datasource.ssl_mode,
    )


def introspect_schema(datasource: DataSource) -> dict[str, Any]:
    """
    Introspect external database to discover schemas, tables, columns, primary keys, and relations.
    Caches discovered metadata in datasource.cached_schema and updates schema_last_synced_at.
    """
    url = datasource.get_sqlalchemy_url()
    engine = None
    try:
        engine = _create_scoped_engine(url, datasource.engine)
        inspector = inspect(engine)

        # 1. Discover schemas
        available_schemas = []
        try:
            raw_schemas = inspector.get_schema_names()
            available_schemas = [s for s in raw_schemas if s.lower() not in SYSTEM_SCHEMAS]
        except Exception:
            available_schemas = ["default"]

        if not available_schemas and datasource.engine == DataSourceEngine.SQLITE:
            available_schemas = ["main"]
        elif not available_schemas:
            available_schemas = ["public"]

        tables_meta = []
        schemas_to_inspect = (
            datasource.allowed_schemas if datasource.allowed_schemas else available_schemas
        )

        # 2. Inspect each schema
        for schema in schemas_to_inspect:
            actual_schema = None if schema in ("default", "main") else schema
            try:
                table_names = inspector.get_table_names(schema=actual_schema)
            except Exception as exc:
                logger.warning(f"Could not inspect schema '{schema}': {exc}")
                continue

            for tbl in table_names:
                clean_tbl = tbl.lower()
                # Skip internal or temp tables
                if clean_tbl.startswith("pg_") or clean_tbl.startswith("sql_"):
                    continue

                try:
                    raw_columns = inspector.get_columns(tbl, schema=actual_schema)
                except Exception:
                    raw_columns = []

                pk_cols = set()
                try:
                    pk_info = inspector.get_pk_constraint(tbl, schema=actual_schema)
                    if pk_info and "constrained_columns" in pk_info:
                        pk_cols = set(pk_info["constrained_columns"])
                except Exception:
                    pass

                foreign_keys = []
                try:
                    fks = inspector.get_foreign_keys(tbl, schema=actual_schema)
                    for fk in fks:
                        foreign_keys.append(
                            {
                                "constrained_columns": fk.get("constrained_columns", []),
                                "referred_table": fk.get("referred_table", ""),
                                "referred_columns": fk.get("referred_columns", []),
                            }
                        )
                except Exception:
                    pass

                columns_data = []
                for col in raw_columns:
                    cname = col.get("name", "")
                    ctype = str(col.get("type", "TEXT")).upper()
                    is_pk = cname in pk_cols
                    is_sensitive = any(p.search(cname) for p in SENSITIVE_COLUMN_PATTERNS)

                    columns_data.append(
                        {
                            "name": cname,
                            "type": ctype,
                            "primary_key": is_pk,
                            "nullable": col.get("nullable", True),
                            "is_sensitive": is_sensitive,
                        }
                    )

                tables_meta.append(
                    {
                        "schema": schema,
                        "name": tbl,
                        "columns": columns_data,
                        "primary_keys": list(pk_cols),
                        "foreign_keys": foreign_keys,
                    }
                )

        schema_result = {
            "engine": datasource.engine,
            "database_name": datasource.database_name,
            "schemas": available_schemas,
            "tables": tables_meta,
            "table_count": len(tables_meta),
            "synced_at": timezone.now().isoformat(),
        }

        datasource.cached_schema = schema_result
        datasource.schema_last_synced_at = timezone.now()
        if datasource.pk:
            datasource.save(update_fields=["cached_schema", "schema_last_synced_at", "updated_at"])

        return schema_result

    except Exception as exc:
        err_msg = _sanitize_error_message(str(exc), datasource.get_password())
        logger.error(f"Schema discovery failed for datasource {datasource.id}: {err_msg}")
        raise ValueError(f"Schema introspection failed: {err_msg}") from exc
    finally:
        if engine is not None:
            engine.dispose()


def get_datasource_schema_context(datasource: DataSource) -> tuple[str, list[str]]:
    """
    Format compact, sanitized schema context for LLM prompt generation.
    Omits sensitive columns and filters tables by allowed_tables.
    Returns (schema_context_text, allowed_table_names).
    """
    cached = datasource.cached_schema
    if not cached or "tables" not in cached:
        cached = introspect_schema(datasource)

    raw_tables = cached.get("tables", [])
    allowed_configured = set(datasource.allowed_tables) if datasource.allowed_tables else None

    schema_lines = []
    allowed_table_names = []

    for tmeta in raw_tables:
        tname = tmeta.get("name", "")
        # Apply table allowlist if configured
        if allowed_configured is not None and tname not in allowed_configured:
            continue

        allowed_table_names.append(tname)
        col_descriptions = []
        for col in tmeta.get("columns", []):
            # STRICT PRIVACY: omit sensitive columns like password, secret, token from AI prompt
            if col.get("is_sensitive"):
                continue

            pk_mark = " (PK)" if col.get("primary_key") else ""
            col_descriptions.append(f"{col['name']} {col['type']}{pk_mark}")

        fk_descriptions = []
        for fk in tmeta.get("foreign_keys", []):
            c_cols = ",".join(fk.get("constrained_columns", []))
            r_tbl = fk.get("referred_table", "")
            r_cols = ",".join(fk.get("referred_columns", []))
            if c_cols and r_tbl:
                fk_descriptions.append(f"{c_cols} -> {r_tbl}({r_cols})")

        fk_str = f" | Relations: {'; '.join(fk_descriptions)}" if fk_descriptions else ""
        schema_lines.append(f"Table `{tname}`: {', '.join(col_descriptions)}{fk_str}")

    schema_text = (
        f"Database: {datasource.database_name} (Dialect: {datasource.get_engine_display()})\n"
        + "\n".join(schema_lines)
    )
    return schema_text, allowed_table_names


def _sanitize_error_message(error_str: str, password: Optional[str] = None) -> str:
    """Ensure raw passwords or sensitive tokens never leak in error messages."""
    if not error_str:
        return ""
    if password and password in error_str:
        error_str = error_str.replace(password, "***")
    # Mask password URI patterns if present
    error_str = re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", error_str)
    # Mask key-value credentials: password=..., pwd=..., token=..., secret=...
    error_str = re.sub(
        r"(password|pwd|secret|token|api_key)=['\"]?[^'\"\s,;]+['\"]?",
        r"\1=***",
        error_str,
        flags=re.IGNORECASE,
    )
    return error_str
