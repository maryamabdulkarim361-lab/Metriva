"""Query history and audit model."""

from django.conf import settings
from django.db import models


class QueryStatus(models.TextChoices):
    SUCCESS = "SUCCESS", "Success"
    FAILED = "FAILED", "Failed"
    BLOCKED = "BLOCKED", "Blocked (Security Violation)"
    TIMEOUT = "TIMEOUT", "Timeout"


class QueryHistory(models.Model):
    """
    Audit record for every natural language query generated and executed.
    Tracks execution metrics, performance, and validation status.
    """

    id = models.BigAutoField(primary_key=True)
    organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="query_histories",
        help_text="Owning organization for multi-tenant audit isolation.",
    )
    datasource = models.ForeignKey(
        "datasources.DataSource",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="query_histories",
        help_text="Target data source queried, if external.",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="query_histories",
    )
    natural_language_question = models.TextField()
    generated_sql = models.TextField()
    execution_status = models.CharField(
        max_length=50,
        choices=QueryStatus.choices,
        default=QueryStatus.SUCCESS,
        db_index=True,
    )
    execution_time_ms = models.FloatField(default=0.0)
    row_count = models.IntegerField(default=0)
    error_message = models.TextField(null=True, blank=True)
    explanation = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "query_history"
        verbose_name = "Query History"
        verbose_name_plural = "Query Histories"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "created_at"], name="idx_qh_org_created"),
            models.Index(fields=["created_at", "execution_status"], name="idx_qh_created_status"),
        ]

    def __str__(self):
        return f"Query #{self.id} [{self.execution_status}] - {self.natural_language_question[:50]}"

