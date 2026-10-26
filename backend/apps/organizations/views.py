"""Views and API endpoints for Organizations, Memberships, and Masking Policies."""

from django.db import models, transaction
from django.utils.text import slugify
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action

from apps.core.responses import api_error, api_response
from apps.organizations.models import (
    ColumnMaskingPolicy,
    MaskingType,
    Organization,
    OrganizationMembership,
    RoleChoices,
)
from apps.organizations.serializers import (
    AddMemberSerializer,
    ChangeRoleSerializer,
    ColumnMaskingPolicySerializer,
    OrganizationMembershipSerializer,
    OrganizationSerializer,
)


class OrganizationViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Organizations and team membership management.
    """

    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Organization.objects.none()
        # Return all organizations where the user has active membership
        return Organization.objects.filter(
            memberships__user=user,
            is_active=True,
        ).distinct()

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        serializer = self.get_serializer(qs, many=True)
        return api_response(data=serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return api_response(data=serializer.data)

    def create(self, request, *args, **kwargs):
        name = request.data.get("name", "").strip()
        if not name:
            return api_error(
                message="Organization name is required.",
                code="VALIDATION_ERROR",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        base_slug = slugify(name) or "org"
        slug = base_slug
        counter = 1
        while Organization.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        with transaction.atomic():
            org = Organization.objects.create(name=name, slug=slug, is_active=True)
            # Creator is automatically assigned the ADMIN role
            OrganizationMembership.objects.create(
                organization=org,
                user=request.user,
                role=RoleChoices.ADMIN,
            )

            # Seed standard default masking policies
            ColumnMaskingPolicy.objects.create(
                organization=org,
                rule_name="Mask Email Addresses",
                match_type="EXACT",
                match_pattern="email",
                masking_type=MaskingType.EMAIL,
                is_active=True,
            )
            ColumnMaskingPolicy.objects.create(
                organization=org,
                rule_name="Mask Phone Numbers",
                match_type="EXACT",
                match_pattern="phone",
                masking_type=MaskingType.PHONE,
                is_active=True,
            )
            ColumnMaskingPolicy.objects.create(
                organization=org,
                rule_name="Redact Secrets and Credentials",
                match_type="REGEX",
                match_pattern=r"(password|secret|token|api_key|private_key|auth_hash|salt|ssn)",
                masking_type=MaskingType.REDACT,
                is_active=True,
            )

        serializer = self.get_serializer(org)
        return api_response(
            data=serializer.data,
            message=f"Organization '{name}' created successfully with Admin membership.",
            status_code=status.HTTP_201_CREATED,
        )

    # -------------------------------------------------------------
    # Team Membership Management
    # -------------------------------------------------------------

    @action(detail=True, methods=["get", "post"], url_path="members")
    def members(self, request, pk=None):
        """List or add members to the organization."""
        org = self.get_object()

        # Check membership of caller
        caller_mem = OrganizationMembership.objects.filter(
            organization=org,
            user=request.user,
        ).first()
        if not caller_mem:
            return api_error(
                message="You do not belong to this organization.",
                code="FORBIDDEN",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        if request.method == "GET":
            members_qs = org.memberships.select_related("user").order_by("role", "user__name")
            serializer = OrganizationMembershipSerializer(members_qs, many=True)
            return api_response(data=serializer.data)

        # POST: Add member (Admin only)
        if caller_mem.role != RoleChoices.ADMIN:
            return api_error(
                message="Only organization Administrators can add new members.",
                code="ADMIN_REQUIRED",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        serializer = AddMemberSerializer(data=request.data)
        if not serializer.is_valid():
            err_code = "VALIDATION_ERROR"
            if "email" in serializer.errors:
                email_errs = str(serializer.errors["email"])
                if "No registered account found" in email_errs:
                    err_code = "USER_NOT_FOUND"
            return api_error(
                message="Validation failed when adding member.",
                code=err_code,
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        target_user = serializer.context["target_user"]
        target_role = serializer.validated_data["role"]

        existing_mem = OrganizationMembership.objects.filter(
            organization=org,
            user=target_user,
        ).first()

        if existing_mem:
            return api_error(
                message=f"User '{target_user.email}' is already a member with role '{existing_mem.role}'.",
                code="ALREADY_MEMBER",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        new_mem = OrganizationMembership.objects.create(
            organization=org,
            user=target_user,
            role=target_role,
        )

        return api_response(
            data=OrganizationMembershipSerializer(new_mem).data,
            message=f"User '{target_user.email}' added to {org.name} as {target_role}.",
            status_code=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["patch", "delete"], url_path=r"members/(?P<user_id>\d+)")
    def member_detail(self, request, pk=None, user_id=None):
        """Update role or remove member from organization."""
        org = self.get_object()

        caller_mem = OrganizationMembership.objects.filter(
            organization=org,
            user=request.user,
        ).first()
        if not caller_mem or caller_mem.role != RoleChoices.ADMIN:
            return api_error(
                message="Only organization Administrators can modify member roles or remove members.",
                code="ADMIN_REQUIRED",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        target_mem = OrganizationMembership.objects.filter(
            organization=org
        ).filter(models.Q(user_id=user_id) | models.Q(id=user_id)).first()
        if not target_mem:
            return api_error(
                message="Member not found in this organization.",
                code="NOT_FOUND",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Count current admins to prevent last-admin removal/demotion
        admin_count = OrganizationMembership.objects.filter(
            organization=org,
            role=RoleChoices.ADMIN,
        ).count()

        if request.method == "DELETE":
            if target_mem.role == RoleChoices.ADMIN and admin_count <= 1:
                return api_error(
                    message="Cannot remove the sole Administrator of the organization.",
                    code="CANNOT_REMOVE_LAST_ADMIN",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            target_email = target_mem.user.email
            target_mem.delete()
            return api_response(
                data={"user_id": int(target_mem.user_id)},
                message=f"Member '{target_email}' removed from {org.name}.",
            )

        # PATCH: Update role
        serializer = ChangeRoleSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error(
                message="Invalid role update payload.",
                code="VALIDATION_ERROR",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        new_role = serializer.validated_data["role"]
        if target_mem.role == RoleChoices.ADMIN and new_role != RoleChoices.ADMIN and admin_count <= 1:
            return api_error(
                message="Cannot demote the sole Administrator of the organization.",
                code="CANNOT_DEMOTE_LAST_ADMIN",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        target_mem.role = new_role
        target_mem.save(update_fields=["role", "updated_at"])

        return api_response(
            data=OrganizationMembershipSerializer(target_mem).data,
            message=f"Role updated to {new_role} for {target_mem.user.email}.",
        )

    # -------------------------------------------------------------
    # Column Masking Policy Management
    # -------------------------------------------------------------

    @action(detail=True, methods=["get", "post"], url_path="masking-policies")
    def masking_policies(self, request, pk=None):
        """List or create column data masking policies for the organization."""
        org = self.get_object()

        caller_mem = OrganizationMembership.objects.filter(
            organization=org,
            user=request.user,
        ).first()
        if not caller_mem:
            return api_error(
                message="You do not belong to this organization.",
                code="FORBIDDEN",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        if request.method == "GET":
            policies = org.masking_policies.all().order_by("-created_at")
            serializer = ColumnMaskingPolicySerializer(policies, many=True)
            return api_response(data=serializer.data)

        # POST: Create policy (Admin only)
        if caller_mem.role != RoleChoices.ADMIN:
            return api_error(
                message="Only Administrators can configure column masking policies.",
                code="ADMIN_REQUIRED",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        serializer = ColumnMaskingPolicySerializer(data=request.data)
        if not serializer.is_valid():
            return api_error(
                message="Validation failed for masking policy.",
                code="VALIDATION_ERROR",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        policy = serializer.save(organization=org)
        return api_response(
            data=ColumnMaskingPolicySerializer(policy).data,
            message=f"Masking policy '{policy.rule_name}' created.",
            status_code=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["patch", "delete"], url_path=r"masking-policies/(?P<policy_id>\d+)")
    def masking_policy_detail(self, request, pk=None, policy_id=None):
        """Update or delete a column masking policy."""
        org = self.get_object()

        caller_mem = OrganizationMembership.objects.filter(
            organization=org,
            user=request.user,
        ).first()
        if not caller_mem or caller_mem.role != RoleChoices.ADMIN:
            return api_error(
                message="Only Administrators can modify or delete column masking policies.",
                code="ADMIN_REQUIRED",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        policy = org.masking_policies.filter(id=policy_id).first()
        if not policy:
            return api_error(
                message="Masking policy not found in this organization.",
                code="NOT_FOUND",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if request.method == "DELETE":
            policy.delete()
            return api_response(
                data={"id": int(policy_id)},
                message="Masking policy deleted successfully.",
            )

        # PATCH: Update policy
        serializer = ColumnMaskingPolicySerializer(policy, data=request.data, partial=True)
        if not serializer.is_valid():
            return api_error(
                message="Invalid update payload for masking policy.",
                code="VALIDATION_ERROR",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        updated_policy = serializer.save()
        return api_response(
            data=ColumnMaskingPolicySerializer(updated_policy).data,
            message=f"Masking policy '{updated_policy.rule_name}' updated.",
        )
