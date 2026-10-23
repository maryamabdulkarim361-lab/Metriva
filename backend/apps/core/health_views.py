"""
Liveness and Readiness Health Check Endpoints for Kubernetes, Docker, and Load Balancers.
"""

import logging
import shutil
import time

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from apps.core.responses import api_error, api_response

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def health_liveness(request):
    """Liveness probe: verifies process is alive and web server responds."""
    return api_response(
        data={
            "status": "UP",
            "service": "ai-database-assistant",
            "timestamp": time.time(),
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def health_readiness(request):
    """
    Readiness probe: verifies backend dependencies before routing traffic:
    1. Primary PostgreSQL / SQLite database connectivity.
    2. Applied database migration state.
    3. Storage availability.
    """
    checks = {}
    is_ready = True

    # 1. Database Connectivity Ping
    try:
        t0 = time.perf_counter()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
            cursor.fetchone()
        db_latency = round((time.perf_counter() - t0) * 1000, 2)
        checks["database"] = {
            "status": "UP",
            "vendor": connection.vendor,
            "latency_ms": db_latency,
        }
    except Exception as exc:
        is_ready = False
        checks["database"] = {
            "status": "DOWN",
            "error": str(exc),
        }
        logger.error(f"Readiness check database failure: {exc}")

    # 2. Migration state check
    try:
        executor = MigrationExecutor(connection)
        targets = executor.loader.graph.leaf_nodes()
        unapplied = executor.migration_plan(targets)
        checks["migrations"] = {
            "status": "UP",
            "pending_count": len(unapplied),
            "up_to_date": len(unapplied) == 0,
        }
    except Exception as exc:
        checks["migrations"] = {
            "status": "UNKNOWN",
            "error": str(exc),
        }

    # 3. Disk space
    try:
        total, used, free = shutil.disk_usage("/")
        free_gb = round(free / (2**30), 2)
        checks["disk"] = {
            "status": "UP" if free_gb > 0.5 else "LOW",
            "free_gb": free_gb,
        }
    except Exception:
        pass

    if not is_ready:
        return api_error(
            message="Service is not ready to receive traffic.",
            code="NOT_READY",
            details=checks,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return api_response(
        data={
            "status": "READY",
            "checks": checks,
        }
    )
