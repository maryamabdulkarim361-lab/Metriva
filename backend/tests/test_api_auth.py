"""Tests for Authentication REST endpoints."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.mark.django_db
class TestAuthenticationAPI:
    def setup_method(self):
        self.client = APIClient()

    def test_user_registration_success(self):
        payload = {
            "name": "Jane Developer",
            "email": "jane@example.com",
            "password": "SecurePassword123!",
        }
        res = self.client.post("/api/auth/register/", payload, format="json")
        assert res.status_code == 201
        assert res.data["success"] is True
        assert res.data["data"]["email"] == "jane@example.com"
        assert User.objects.filter(email="jane@example.com").exists()

    def test_user_login_success(self):
        User.objects.create_user(
            email="login_user@example.com",
            password="LoginPassword123!",
            name="Login User",
        )
        payload = {
            "email": "login_user@example.com",
            "password": "LoginPassword123!",
        }
        res = self.client.post("/api/auth/login/", payload, format="json")
        assert res.status_code == 200
        assert res.data["success"] is True
        assert "tokens" in res.data["data"]
        assert "access" in res.data["data"]["tokens"]
        assert "refresh" in res.data["data"]["tokens"]

    def test_user_login_invalid_credentials(self):
        payload = {
            "email": "unknown@example.com",
            "password": "WrongPassword123!",
        }
        res = self.client.post("/api/auth/login/", payload, format="json")
        assert res.status_code == 401
        assert res.data["success"] is False
        assert res.data["error"]["code"] == "AUTHENTICATION_FAILED"

    def test_me_endpoint_authenticated(self):
        User.objects.create_user(
            email="me_user@example.com",
            password="Password123!",
            name="Me User",
        )
        login_res = self.client.post(
            "/api/auth/login/",
            {"email": "me_user@example.com", "password": "Password123!"},
            format="json",
        )
        access_token = login_res.data["data"]["tokens"]["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        me_res = self.client.get("/api/auth/me/")
        assert me_res.status_code == 200
        assert me_res.data["data"]["email"] == "me_user@example.com"
