"""Routing for AI query and execution endpoints."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.ai_assistant.views import (
    AIConfigStatusView,
    DirectSQLExecutionView,
    NaturalLanguageQueryView,
    QueryHistoryViewSet,
)

router = DefaultRouter()
router.register(r"history", QueryHistoryViewSet, basename="query-history")

urlpatterns = [
    path("", NaturalLanguageQueryView.as_view(), name="nl-query"),
    path("execute-direct/", DirectSQLExecutionView.as_view(), name="direct-sql-query"),
    path("status/", AIConfigStatusView.as_view(), name="ai-config-status"),
    path("", include(router.urls)),
]
