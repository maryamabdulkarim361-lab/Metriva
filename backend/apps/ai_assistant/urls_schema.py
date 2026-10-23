"""Routing for schema metadata endpoint."""

from django.urls import path

from apps.ai_assistant.views import SchemaExplorerView

urlpatterns = [
    path("", SchemaExplorerView.as_view(), name="schema-metadata"),
]
