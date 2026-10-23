"""URL routing for Data Sources API."""

from rest_framework.routers import DefaultRouter

from apps.datasources.views import DataSourceViewSet

router = DefaultRouter()
router.register(r"", DataSourceViewSet, basename="datasource")

urlpatterns = router.urls
