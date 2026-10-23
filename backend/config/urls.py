"""Root URL Configuration for AI Database Assistant."""

from django.contrib import admin
from django.urls import include, path

from apps.core.health_views import health_liveness, health_readiness
from apps.core.responses import api_response


def api_root(request):
    """Root health and status endpoint."""
    return api_response(
        data={
            "service": "AI Database Assistant API",
            "version": "1.0.0",
            "status": "healthy",
            "endpoints": {
                "auth": "/api/auth/",
                "dashboard": "/api/dashboard/",
                "query": "/api/query/",
                "query_history": "/api/query/history/",
                "schema": "/api/schema/",
                "customers": "/api/customers/",
                "products": "/api/products/",
                "orders": "/api/orders/",
                "analytics": "/api/analytics/",
                "datasources": "/api/datasources/",
                "ml": "/api/ml/",
            },
        }
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api_root, name="api-root"),
    path("api/health/", health_liveness, name="health-liveness"),
    path("api/ready/", health_readiness, name="health-readiness"),
    path("api/auth/", include("apps.authentication.urls")),
    path("api/dashboard/", include("apps.analytics.urls_dashboard")),
    path("api/analytics/", include("apps.analytics.urls_analytics")),
    path("api/schema/", include("apps.ai_assistant.urls_schema")),
    path("api/query/", include("apps.ai_assistant.urls_query")),
    path("api/datasources/", include("apps.datasources.urls")),
    path("api/ml/", include("apps.ml.urls")),
    path("api/", include("apps.analytics.urls")),
]
