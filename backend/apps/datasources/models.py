"""Models for external database connections, schema metadata, and tenant ownership."""

import urllib.parse

from django.conf import settings
from django.db import models

from apps.datasources.crypto import decrypt_credential, encrypt_credential


class DataSourceEngine(models.TextChoices):
    POSTGRESQL = "postgresql", "PostgreSQL"
    MYSQL = "mysql", "MySQL"
    SQLITE = "sqlite", "SQLite"


class SSLMode(models.TextChoices):
    DISABLE = "disable", "Disable"
    PREFER = "prefer", "Prefer"
    REQUIRE = "require", "Require"
    VERIFY_CA = "verify-ca", "Verify CA"
    VERIFY_FULL = "verify-full", "Verify Full"


class DataSource(models.Model):
    """
    Registered external database connection configured by a user.
    Stores encrypted connection parameters, discovered schema metadata,
    and user-configured table/schema access allowlists.
    """

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="datasources",
        help_text="Owning user for multi-tenant isolation.",
    )
    name = models.CharField(max_length=120, help_text="Friendly display name for data source.")
    description = models.TextField(blank=True, default="", help_text="Optional description.")
    engine = models.CharField(
        max_length=30,
        choices=DataSourceEngine.choices,
        default=DataSourceEngine.POSTGRESQL,
        db_index=True,
    )
    host = models.CharField(max_length=255, blank=True, default="localhost")
    port = models.IntegerField(default=5432)
    database_name = models.CharField(max_length=255)
    username = models.CharField(max_length=255, blank=True, default="")
    encrypted_password = models.TextField(blank=True, default="", editable=False)
    ssl_mode = models.CharField(
        max_length=30,
        choices=SSLMode.choices,
        default=SSLMode.PREFER,
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this connection is available for AI queries.",
    )

    # Discovered schema and AI context filters
    allowed_schemas = models.JSONField(
        default=list,
        blank=True,
        help_text="List of schemas exposed to AI (e.g. ['public']). Empty means default.",
    )
    allowed_tables = models.JSONField(
        default=list,
        blank=True,
        help_text="List of permitted tables exposed to AI. Empty means all non-system tables.",
    )
    cached_schema = models.JSONField(
        default=dict,
        blank=True,
        help_text="Cached introspection metadata: tables, columns, data types, keys.",
    )
    schema_last_synced_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "data_sources"
        verbose_name = "Data Source"
        verbose_name_plural = "Data Sources"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_active"], name="idx_ds_user_active"),
            models.Index(fields=["engine", "is_active"], name="idx_ds_engine_active"),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_engine_display()}) - {self.database_name}"

    def set_password(self, raw_password: str) -> None:
        """Encrypt and store credentials."""
        self.encrypted_password = encrypt_credential(raw_password)

    def get_password(self) -> str:
        """Decrypt and return plain credentials for connection execution."""
        return decrypt_credential(self.encrypted_password)

    def get_sqlalchemy_url(self, masked: bool = False) -> str:
        """
        Build standard SQLAlchemy connection URL for this data source.
        If masked=True, hides password for logging or auditing.
        """
        password = "***" if masked else self.get_password()
        encoded_user = urllib.parse.quote_plus(self.username) if self.username else ""
        encoded_pass = urllib.parse.quote_plus(password) if password else ""
        auth = ""
        if encoded_user:
            auth = f"{encoded_user}:{encoded_pass}@" if encoded_pass else f"{encoded_user}@"

        if self.engine == DataSourceEngine.POSTGRESQL:
            query_params = []
            if self.ssl_mode and self.ssl_mode != SSLMode.DISABLE:
                query_params.append(f"sslmode={self.ssl_mode}")
            query_str = f"?{'&'.join(query_params)}" if query_params else ""
            return f"postgresql+psycopg://{auth}{self.host}:{self.port}/{self.database_name}{query_str}"

        elif self.engine == DataSourceEngine.MYSQL:
            query_params = ["charset=utf8mb4"]
            if self.ssl_mode and self.ssl_mode in (SSLMode.REQUIRE, SSLMode.VERIFY_CA, SSLMode.VERIFY_FULL):
                query_params.append("ssl_check_hostname=true")
            query_str = f"?{'&'.join(query_params)}"
            return f"mysql+pymysql://{auth}{self.host}:{self.port}/{self.database_name}{query_str}"

        elif self.engine == DataSourceEngine.SQLITE:
            # For SQLite, database_name is the file path or :memory:
            return f"sqlite:///{self.database_name}"

        raise ValueError(f"Unsupported database engine: {self.engine}")
