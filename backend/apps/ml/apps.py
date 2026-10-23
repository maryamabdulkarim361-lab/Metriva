"""Machine Learning and Predictive Analytics Django App Configuration."""

from django.apps import AppConfig


class MLConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.ml"
    verbose_name = "Machine Learning & Predictive Analytics"
