"""Serializers for Organization, Membership, and Masking Policy APIs."""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.organizations.models import (
    ColumnMaskingPolicy,
    Organization,
    OrganizationMembership,
    RoleChoices,
)

User = get_user_model()


class OrganizationSerializer(serializers.ModelSerializer):
    """Organization metadata with current requesting user's assigned role."""

    role = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "slug",
            "role",
            "member_count",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "role", "member_count", "created_at", "updated_at"]

    def get_role(self, obj) -> str:
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            mem = OrganizationMembership.objects.filter(
                organization=obj,
                user=request.user,
            ).first()
            if mem:
                return mem.role
        return RoleChoices.VIEWER

    def get_member_count(self, obj) -> int:
        return obj.memberships.count()


class OrganizationMembershipSerializer(serializers.ModelSerializer):
    """Member profile within an organization."""

    user_id = serializers.IntegerField(source="user.id", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.name", read_only=True)

    class Meta:
        model = OrganizationMembership
        fields = [
            "id",
            "user_id",
            "user_email",
            "user_name",
            "role",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user_id", "user_email", "user_name", "created_at", "updated_at"]


class AddMemberSerializer(serializers.Serializer):
    """Payload for adding an existing registered user to an organization."""

    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=RoleChoices.choices, default=RoleChoices.VIEWER)

    def validate_email(self, value):
        normalized = value.strip().lower()
        try:
            user = User.objects.get(email__iexact=normalized)
        except User.DoesNotExist:
            raise serializers.ValidationError(
                f"No registered account found with email '{value}'. Only existing registered users can be added."
            )
        self.context["target_user"] = user
        return normalized


class ChangeRoleSerializer(serializers.Serializer):
    """Payload for updating a member's role."""

    role = serializers.ChoiceField(choices=RoleChoices.choices)


class ColumnMaskingPolicySerializer(serializers.ModelSerializer):
    """Configuration serializer for column data masking rules."""

    class Meta:
        model = ColumnMaskingPolicy
        fields = [
            "id",
            "rule_name",
            "match_type",
            "match_pattern",
            "masking_type",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_match_pattern(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Match pattern cannot be empty.")
        return val
