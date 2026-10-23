"""Tests for database seeding command."""

import pytest
from django.core.management import call_command

from apps.analytics.models import Customer, Order, Product, WebsiteEvent


@pytest.mark.django_db
class TestSeedDatabaseCommand:
    def test_seed_demo_scale(self):
        call_command("seed_database", scale="demo", seed=100, clear=True)
        assert Customer.objects.count() >= 200
        assert Product.objects.count() >= 100
        assert Order.objects.count() >= 2000
        assert WebsiteEvent.objects.count() >= 4000
