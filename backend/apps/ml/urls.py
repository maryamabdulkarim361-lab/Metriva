"""Routing for Machine Learning and Predictive Analytics endpoints."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.ml.views import (
    AnomalyScanAPIView,
    CustomerChurnAPIView,
    MLAnomalyAlertViewSet,
    MLInsightsAPIView,
    MLJobViewSet,
    MLModelViewSet,
    MLPredictionViewSet,
    RevenueForecastAPIView,
    TriggerMLJobAPIView,
)

router = DefaultRouter()
router.register(r"models", MLModelViewSet, basename="ml-model")
router.register(r"predictions", MLPredictionViewSet, basename="ml-prediction")
router.register(r"anomalies", MLAnomalyAlertViewSet, basename="ml-anomaly")
router.register(r"jobs", MLJobViewSet, basename="ml-job")

urlpatterns = [
    path("forecast/revenue/", RevenueForecastAPIView.as_view(), name="ml-forecast-revenue"),
    path("churn/customers/", CustomerChurnAPIView.as_view(), name="ml-churn-customers"),
    path("anomalies/scan/", AnomalyScanAPIView.as_view(), name="ml-anomalies-scan"),
    path("insights/", MLInsightsAPIView.as_view(), name="ml-insights"),
    path("jobs/trigger/", TriggerMLJobAPIView.as_view(), name="ml-jobs-trigger"),
    path("", include(router.urls)),
]
