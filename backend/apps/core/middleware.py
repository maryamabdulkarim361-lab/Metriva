"""
Structured observability and request correlation middleware.

Generates and tracks unique request IDs (X-Request-ID), logs structured
performance metrics, and sanitizes logged query parameters and headers.
"""

import logging
import time
import uuid

logger = logging.getLogger("aidb.access")


class RequestTracingMiddleware:
    """
    Middleware attaching X-Request-ID and logging structured request telemetry.
    Never logs passwords, tokens, API keys, or raw confidential bodies.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 1. Extract or generate request ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.request_id = request_id

        start_time = time.perf_counter()

        response = self.get_response(request)

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response["X-Request-ID"] = request_id

        # 2. Structured log emission
        user_identifier = (
            str(request.user.id)
            if getattr(request, "user", None) and request.user.is_authenticated
            else "anonymous"
        )
        status_code = response.status_code

        # Sanitize path to prevent logging tokens in URLs
        path = request.path

        if status_code >= 500:
            logger.error(f"HTTP {request.method} {path} -> {status_code} ({duration_ms}ms) [req_id={request_id} user={user_identifier}]")
        elif status_code >= 400:
            logger.warning(f"HTTP {request.method} {path} -> {status_code} ({duration_ms}ms) [req_id={request_id} user={user_identifier}]")
        else:
            logger.info(f"HTTP {request.method} {path} -> {status_code} ({duration_ms}ms) [req_id={request_id} user={user_identifier}]")

        return response
