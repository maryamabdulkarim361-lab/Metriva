"""Routing for dashboard endpoint."""

from django.urls import path

from apps.analytics.views import DashboardSummaryView

urlpatterns = [
    path("", DashboardSummaryView.as_view(), name="dashboard-summary"),
]
