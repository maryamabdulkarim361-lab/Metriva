"""Authentication views."""

from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from apps.authentication.serializers import LoginSerializer, RegisterSerializer, UserSerializer
from apps.core.responses import api_error, api_response


class RegisterView(APIView):
    """Register a new user account."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return api_response(
                data=UserSerializer(user).data,
                message="User registered successfully.",
                status_code=status.HTTP_201_CREATED,
            )
        return api_error(
            message="Registration validation failed.",
            code="VALIDATION_ERROR",
            details=serializer.errors,
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class LoginView(APIView):
    """Authenticate with email and password and receive JWT tokens."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            return api_response(
                data=serializer.validated_data,
                message="Authentication successful.",
            )
        return api_error(
            message="Invalid credentials.",
            code="AUTHENTICATION_FAILED",
            details=serializer.errors,
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class MeView(APIView):
    """Retrieve current authenticated user profile."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return api_response(data=UserSerializer(request.user).data)


class CustomTokenRefreshView(TokenRefreshView):
    """Wrapped JWT token refresh view returning uniform response."""

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        return api_response(data=response.data, message="Token refreshed successfully.")
