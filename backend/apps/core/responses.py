"""Standardized API response utilities for consistent client communication."""

from typing import Any, Optional

from rest_framework import status
from rest_framework.response import Response


def api_response(
    data: Any = None,
    message: Optional[str] = None,
    success: bool = True,
    status_code: int = status.HTTP_200_OK,
    extra: Optional[dict] = None,
) -> Response:
    """Return a uniform success API response."""
    payload: dict[str, Any] = {
        "success": success,
        "data": data,
    }
    if message is not None:
        payload["message"] = message
    if extra:
        payload.update(extra)
    return Response(payload, status=status_code)


def api_error(
    message: str,
    code: str = "ERROR",
    details: Any = None,
    status_code: int = status.HTTP_400_BAD_REQUEST,
) -> Response:
    """Return a uniform error API response following enterprise API specifications."""
    error_payload: dict[str, Any] = {
        "code": code,
        "message": message,
    }
    if details is not None:
        error_payload["details"] = details

    return Response(
        {
            "success": False,
            "error": error_payload,
        },
        status=status_code,
    )
