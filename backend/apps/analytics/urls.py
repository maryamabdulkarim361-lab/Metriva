"""Routing for analytics viewsets."""

from rest_framework.routers import DefaultRouter

from apps.analytics.views import (
    CustomerViewSet,
    OrderViewSet,
    ProductViewSet,
    SavedReportViewSet,
    ScheduledReportViewSet,
    WebsiteEventViewSet,
)

router = DefaultRouter()
router.register(r"customers", CustomerViewSet, basename="customer")
router.register(r"products", ProductViewSet, basename="product")
router.register(r"orders", OrderViewSet, basename="order")
router.register(r"events", WebsiteEventViewSet, basename="event")
router.register(r"reports", SavedReportViewSet, basename="saved-report")
router.register(r"scheduled-reports", ScheduledReportViewSet, basename="scheduled-report")

urlpatterns = router.urls
