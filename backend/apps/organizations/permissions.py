"""DRF Permission classes for Organization RBAC."""

from rest_framework import permissions

from apps.organizations.models import RoleChoices
from apps.organizations.service import (
    has_org_permission,
    resolve_tenant_context,
)


class IsOrgMember(permissions.BasePermission):
    """Allows access only to authenticated users belonging to an active organization."""

    message = "You must belong to an active organization to access this resource."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        org, role = resolve_tenant_context(request)
        if not org or not role:
            return False
        request.org = org
        request.user_role = role
        return True


class IsOrgAdmin(permissions.BasePermission):
    """Allows access only to Organization Administrators."""

    message = "Administrator role required for this action."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        org, role = resolve_tenant_context(request)
        if not org or role != RoleChoices.ADMIN:
            return False
        request.org = org
        request.user_role = role
        return True


class IsOrgAnalystOrAbove(permissions.BasePermission):
    """Allows access to Analysts and Administrators (denies Viewers)."""

    message = "Analyst or Administrator role required for this action."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        org, role = resolve_tenant_context(request)
        if not org or role not in (RoleChoices.ADMIN, RoleChoices.ANALYST):
            return False
        request.org = org
        request.user_role = role
        return True


def require_permission(perm: str):
    """Factory creating a DRF Permission class checking a specific permission string."""

    class DynamicOrgPermission(permissions.BasePermission):
        message = f"Permission '{perm}' required for this action."

        def has_permission(self, request, view):
            if not request.user or not request.user.is_authenticated:
                return False
            org, role = resolve_tenant_context(request)
            if not org or not has_org_permission(role, perm):
                return False
            request.org = org
            request.user_role = role
            return True

    return DynamicOrgPermission
