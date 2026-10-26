"""Models for Organizations, Memberships, and Column Masking Policies."""

from django.conf import settings
from django.db import models


class RoleChoices(models.TextChoices):
    ADMIN = "ADMIN", "Administrator"
    ANALYST = "ANALYST", "Data Analyst"
    VIEWER = "VIEWER", "Viewer"


class MaskingType(models.TextChoices):
    REDACT = "REDACT", "Full Redaction ([REDACTED])"
    EMAIL = "EMAIL", "Email Masking (m***m@example.com)"
    PHONE = "PHONE", "Phone Masking (***-***-1234)"
    NULLIFY = "NULLIFY", "Set to Null"


class Organization(models.Model):
    """
    Multi-tenant organization boundary.
    All datasources, saved reports, query history, and masking policies
    belong to an organization.
    """

    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organizations"
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"
        ordering = ["name"]

    def __str__(self):
        return self.name


class OrganizationMembership(models.Model):
    """
    User membership and role assignment within an organization.
    Enforces that each user has exactly one assigned role per organization.
    """

    id = models.BigAutoField(primary_key=True)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(
        max_length=20,
        choices=RoleChoices.choices,
        default=RoleChoices.VIEWER,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organization_memberships"
        verbose_name = "Organization Membership"
        verbose_name_plural = "Organization Memberships"
        unique_together = ("organization", "user")
        indexes = [
            models.Index(fields=["user", "organization"], name="idx_org_mem_user_org"),
        ]

    def __str__(self):
        return f"{self.user} - {self.organization.name} ({self.role})"


class ColumnMaskingPolicy(models.Model):
    """
    Organization-wide default column-level data masking policy.
    Applied automatically to query results, exports, and dashboards
    for non-admin roles (Analysts and Viewers).
    """

    id = models.BigAutoField(primary_key=True)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="masking_policies",
    )
    rule_name = models.CharField(max_length=120)
    match_type = models.CharField(
        max_length=20,
        choices=[("EXACT", "Exact Column Name"), ("REGEX", "Regex Pattern")],
        default="EXACT",
    )
    match_pattern = models.CharField(
        max_length=255,
        help_text="Exact column name (case-insensitive) or regex pattern",
    )
    masking_type = models.CharField(
        max_length=20,
        choices=MaskingType.choices,
        default=MaskingType.REDACT,
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "column_masking_policies"
        verbose_name = "Column Masking Policy"
        verbose_name_plural = "Column Masking Policies"
        ordering = ["rule_name"]

    def __str__(self):
        return f"{self.organization.name} - {self.rule_name} ({self.masking_type})"

