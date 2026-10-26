"""Data migration to safely map existing legacy users and records to explicit organizations."""

from django.db import migrations


def seed_legacy_organizations(apps, schema_editor):
    User = apps.get_model("authentication", "User")
    Organization = apps.get_model("organizations", "Organization")
    OrganizationMembership = apps.get_model("organizations", "OrganizationMembership")
    ColumnMaskingPolicy = apps.get_model("organizations", "ColumnMaskingPolicy")
    DataSource = apps.get_model("datasources", "DataSource")
    SavedReport = apps.get_model("analytics", "SavedReport")
    ScheduledReport = apps.get_model("analytics", "ScheduledReport")
    QueryHistory = apps.get_model("ai_assistant", "QueryHistory")

    # 1. Create or get primary enterprise organization
    admin_user = User.objects.filter(is_staff=True).order_by("id").first()
    if not admin_user:
        admin_user = User.objects.order_by("id").first()

    primary_org, _ = Organization.objects.get_or_create(
        slug="primary-enterprise",
        defaults={"name": "Primary Enterprise", "is_active": True},
    )

    demo_org, _ = Organization.objects.get_or_create(
        slug="metriva-demo-org",
        defaults={"name": "Metriva Demo Org", "is_active": True},
    )

    # 2. Add memberships for existing users
    for user in User.objects.all():
        role = "ADMIN" if (user.is_staff or user.id == 2) else "ANALYST"
        target_org = demo_org if user.email == "demo@aidatabaseassistant.com" else primary_org
        OrganizationMembership.objects.get_or_create(
            organization=target_org,
            user=user,
            defaults={"role": role},
        )

    # 3. Associate legacy SavedReport records
    for report in SavedReport.objects.filter(organization__isnull=True):
        if report.user:
            membership = OrganizationMembership.objects.filter(user=report.user).first()
            report.organization = membership.organization if membership else primary_org
        else:
            report.organization = demo_org
        report.save(update_fields=["organization"])

    # 4. Associate legacy ScheduledReport records
    for schedule in ScheduledReport.objects.filter(organization__isnull=True):
        if schedule.user:
            membership = OrganizationMembership.objects.filter(user=schedule.user).first()
            schedule.organization = membership.organization if membership else primary_org
        else:
            schedule.organization = demo_org
        schedule.save(update_fields=["organization"])

    # 5. Associate legacy DataSources
    for ds in DataSource.objects.filter(organization__isnull=True):
        if ds.user:
            membership = OrganizationMembership.objects.filter(user=ds.user).first()
            ds.organization = membership.organization if membership else primary_org
        else:
            ds.organization = demo_org
        ds.save(update_fields=["organization"])

    # 6. Associate legacy QueryHistory
    for qh in QueryHistory.objects.filter(organization__isnull=True):
        if qh.user:
            membership = OrganizationMembership.objects.filter(user=qh.user).first()
            qh.organization = membership.organization if membership else primary_org
        else:
            qh.organization = demo_org
        qh.save(update_fields=["organization"])

    # 7. Seed standard default masking policies on organizations
    for org in [primary_org, demo_org]:
        ColumnMaskingPolicy.objects.get_or_create(
            organization=org,
            rule_name="Mask Email Addresses",
            defaults={
                "match_type": "EXACT",
                "match_pattern": "email",
                "masking_type": "EMAIL",
                "is_active": True,
            },
        )
        ColumnMaskingPolicy.objects.get_or_create(
            organization=org,
            rule_name="Mask Phone Numbers",
            defaults={
                "match_type": "EXACT",
                "match_pattern": "phone",
                "masking_type": "PHONE",
                "is_active": True,
            },
        )
        ColumnMaskingPolicy.objects.get_or_create(
            organization=org,
            rule_name="Redact Secrets and Credentials",
            defaults={
                "match_type": "REGEX",
                "match_pattern": r"(password|secret|token|api_key|private_key|auth_hash|salt|ssn)",
                "masking_type": "REDACT",
                "is_active": True,
            },
        )


def reverse_seed_legacy_organizations(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0001_initial"),
        ("datasources", "0002_datasource_organization_datasource_idx_ds_org_active"),
        ("analytics", "0003_savedreport_organization_and_more"),
        ("ai_assistant", "0003_queryhistory_datasource_queryhistory_organization_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_legacy_organizations, reverse_seed_legacy_organizations),
    ]

