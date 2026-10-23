"""Global exception handling for Django REST Framework."""

import logging

from rest_framework.exceptions import (
    AuthenticationFailed,
    NotAuthenticated,
    NotFound,
    PermissionDenied,
    ValidationError,
)
from rest_framework.views import exception_handler

from apps.core.responses import api_error

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """Custom exception handler to standardize all API error responses."""
    response = exception_handler(exc, context)

    if response is not None:
        code = "API_ERROR"
        message = "An error occurred while processing your request."
        details = response.data

        if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
            code = "AUTHENTICATION_FAILED"
            message = "Authentication credentials were not provided or are invalid."
        elif isinstance(exc, PermissionDenied):
            code = "PERMISSION_DENIED"
            message = "You do not have permission to perform this action."
        elif isinstance(exc, NotFound):
            code = "NOT_FOUND"
            message = "The requested resource was not found."
        elif isinstance(exc, ValidationError):
            code = "VALIDATION_ERROR"
            message = "Invalid input data provided."
            # Extract first message if possible
            if isinstance(response.data, dict):
                first_key = next(iter(response.data))
                first_val = response.data[first_key]
                if isinstance(first_val, list) and len(first_val) > 0:
                    message = f"{first_key}: {first_val[0]}"
                elif isinstance(first_val, str):
                    message = f"{first_key}: {first_val}"

        return api_error(
            message=message,
            code=code,
            details=details,
            status_code=response.status_code,
        )

    # Unhandled exception
    logger.exception(f"Unhandled server error: {exc}")
    return api_error(
        message="An unexpected internal server error occurred.",
        code="INTERNAL_SERVER_ERROR",
        status_code=500,
    )
