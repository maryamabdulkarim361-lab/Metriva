"""Serializers for user authentication and profile management."""

from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication.models import User


class UserSerializer(serializers.ModelSerializer):
    """Public user serializer with organization memberships."""

    organizations = serializers.SerializerMethodField()
    active_organization = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "name",
            "email",
            "is_staff",
            "active_organization",
            "organizations",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "is_staff",
            "active_organization",
            "organizations",
            "created_at",
        ]

    def get_organizations(self, obj):
        memberships = obj.memberships.filter(
            organization__is_active=True
        ).select_related("organization")
        return [
            {
                "id": m.organization_id,
                "name": m.organization.name,
                "slug": m.organization.slug,
                "role": m.role,
            }
            for m in memberships
        ]

    def get_active_organization(self, obj):
        request = self.context.get("request")
        org_header = request.headers.get("X-Organization-ID") if request else None
        memberships = obj.memberships.filter(
            organization__is_active=True
        ).select_related("organization")

        if org_header and str(org_header).isdigit():
            m = memberships.filter(organization_id=int(org_header)).first()
            if m:
                return {
                    "id": m.organization_id,
                    "name": m.organization.name,
                    "slug": m.organization.slug,
                    "role": m.role,
                }
        first = memberships.first()
        if first:
            return {
                "id": first.organization_id,
                "name": first.organization.name,
                "slug": first.organization.slug,
                "role": first.role,
            }
        return None


class RegisterSerializer(serializers.ModelSerializer):
    """User registration serializer."""

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "name", "email", "password"]

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            name=validated_data.get("name", ""),
        )
        try:
            import uuid

            from django.utils.text import slugify

            from apps.organizations.models import (
                ColumnMaskingPolicy,
                Organization,
                OrganizationMembership,
                RoleChoices,
            )

            org_name = f"{user.name}'s Workspace" if user.name else f"{user.email.split('@')[0]}'s Workspace"
            base_slug = slugify(org_name) or "workspace"
            slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"
            org = Organization.objects.create(name=org_name, slug=slug, is_active=True)
            OrganizationMembership.objects.create(
                organization=org,
                user=user,
                role=RoleChoices.ADMIN,
            )
            ColumnMaskingPolicy.objects.create(
                organization=org,
                rule_name="Mask Email Addresses",
                match_type="EXACT",
                match_pattern="email",
                masking_type="EMAIL",
                is_active=True,
            )
            ColumnMaskingPolicy.objects.create(
                organization=org,
                rule_name="Mask Phone Numbers",
                match_type="EXACT",
                match_pattern="phone",
                masking_type="PHONE",
                is_active=True,
            )
        except Exception:
            pass
        return user


class LoginSerializer(serializers.Serializer):
    """User login serializer."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        if not email or not password:
            raise serializers.ValidationError("Must include both email and password.")

        user = authenticate(email=email, password=password)
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This user account is disabled.")

        refresh = RefreshToken.for_user(user)
        return {
            "user": UserSerializer(user).data,
            "tokens": {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
        }
