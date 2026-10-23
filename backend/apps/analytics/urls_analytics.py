"""Routing for deep analytics endpoints."""

from django.urls import path

from apps.analytics.views import (
    BusinessMetricsView,
    CustomerSegmentationAnalyticsView,
    PeriodComparisonView,
    ProductPerformanceAnalyticsView,
    RevenueAnalyticsView,
)

urlpatterns = [
    path("revenue/", RevenueAnalyticsView.as_view(), name="analytics-revenue"),
    path("customers/", CustomerSegmentationAnalyticsView.as_view(), name="analytics-customers"),
    path("products/", ProductPerformanceAnalyticsView.as_view(), name="analytics-products"),
    path("metrics/", BusinessMetricsView.as_view(), name="analytics-metrics"),
    path("compare-periods/", PeriodComparisonView.as_view(), name="analytics-period-comparison"),
]
