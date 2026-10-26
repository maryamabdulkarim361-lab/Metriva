"""Core RBAC permission service and tenant context resolution."""

import logging
from typing import Optional, Tuple

from rest_framework.exceptions import PermissionDenied

from apps.organizations.models import Organization, OrganizationMembership, RoleChoices

logger = logging.getLogger(__name__)

# Permission Key Constants
PERM_ORG_MANAGE = "org:manage"
PERM_ORG_MANAGE_MEMBERS = "org:manage_members"
PERM_DATASOURCE_MANAGE = "datasource:manage"
PERM_DATASOURCE_VIEW = "datasource:view"
PERM_DATASOURCE_TEST = "datasource:test"
PERM_DATASOURCE_TEST_RAW = "datasource:test_raw"
PERM_QUERY_DIRECT_SQL = "query:direct_sql"
PERM_QUERY_AI_NLQ = "query:ai_nlq"
PERM_QUERY_HISTORY_ALL = "query:history_all"
PERM_DASHBOARD_VIEW = "dashboard:view"
PERM_DASHBOARD_MANAGE = "dashboard:manage"
PERM_REPORT_VIEW = "report:view"
PERM_REPORT_MANAGE = "report:manage"
PERM_ML_VIEW = "ml:view"
PERM_ML_EXECUTE = "ml:execute"
PERM_ML_APPROVE = "ml:approve_model"
PERM_DATA_EXPORT_CSV = "data:export_csv"
PERM_POLICY_MASKING_MANAGE = "policy:masking_manage"
PERM_VIEW_UNMASKED = "data:view_unmasked"

ROLE_PERMISSIONS = {
    RoleChoices.ADMIN: {
        PERM_ORG_MANAGE,
        PERM_ORG_MANAGE_MEMBERS,
        PERM_DATASOURCE_MANAGE,
        PERM_DATASOURCE_VIEW,
        PERM_DATASOURCE_TEST,
        PERM_DATASOURCE_TEST_RAW,
        PERM_QUERY_DIRECT_SQL,
        PERM_QUERY_AI_NLQ,
        PERM_QUERY_HISTORY_ALL,
        PERM_DASHBOARD_VIEW,
        PERM_DASHBOARD_MANAGE,
        PERM_REPORT_VIEW,
        PERM_REPORT_MANAGE,
        PERM_ML_VIEW,
        PERM_ML_EXECUTE,
        PERM_ML_APPROVE,
        PERM_DATA_EXPORT_CSV,
        PERM_POLICY_MASKING_MANAGE,
        PERM_VIEW_UNMASKED,
    },
    RoleChoices.ANALYST: {
        PERM_DATASOURCE_VIEW,
        PERM_DATASOURCE_TEST,
        PERM_QUERY_DIRECT_SQL,
        PERM_QUERY_AI_NLQ,
        PERM_DASHBOARD_VIEW,
        PERM_DASHBOARD_MANAGE,
        PERM_REPORT_VIEW,
        PERM_REPORT_MANAGE,
        PERM_ML_VIEW,
        PERM_ML_EXECUTE,
        PERM_DATA_EXPORT_CSV,
    },
    RoleChoices.VIEWER: {
        PERM_DATASOURCE_VIEW,
        PERM_DASHBOARD_VIEW,
        PERM_REPORT_VIEW,
        PERM_ML_VIEW,
    },
}


def resolve_tenant_context(request) -> Tuple[Optional[Organization], Optional[str]]:
    """
    Resolve active Organization and user Role for an incoming request.
    Priority:
    1. X-Organization-ID header (must be an active membership of request.user)
    2. Primary / first active organization membership of request.user
    Returns (organization, role_string) or (None, None).
    """
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return None, None

    org_header = request.headers.get("X-Organization-ID")
    memberships = OrganizationMembership.objects.filter(
        user=user,
        organization__is_active=True,
    ).select_related("organization")

    if org_header:
        try:
            org_id = int(org_header)
            mem = memberships.filter(organization_id=org_id).first()
            if mem:
                return mem.organization, mem.role
            # User sent an explicit Org ID that they do not belong to
            return None, None
        except (ValueError, TypeError):
            return None, None

    # Fallback to primary membership
    first_mem = memberships.first()
    if first_mem:
        return first_mem.organization, first_mem.role

    return None, None


def has_org_permission(role: Optional[str], permission: str) -> bool:
    """Check if a given role possesses the specified permission."""
    if not role:
        return False
    allowed_perms = ROLE_PERMISSIONS.get(role, set())
    return permission in allowed_perms


def enforce_org_permission(request, permission: str) -> Tuple[Organization, str]:
    """
    Enforce that the requesting user has the required permission in their active organization.
    Raises PermissionDenied (403) with an informative error message if unauthorized.
    Returns (organization, role).
    """
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentication required to access organization resources.")

    org, role = resolve_tenant_context(request)
    if not org:
        raise PermissionDenied("You do not belong to an active organization or X-Organization-ID is invalid.")

    if not has_org_permission(role, permission):
        raise PermissionDenied(
            f"Your current role ({role}) does not have permission '{permission}' in {org.name}."
        )

    return org, role

