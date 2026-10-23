"""Cryptographic utilities for securely storing and retrieving external database credentials."""

import base64
import hashlib
import logging

from cryptography.fernet import Fernet
from django.conf import settings

logger = logging.getLogger(__name__)


def _get_fernet() -> Fernet:
    """Derive a URL-safe 32-byte base64 Fernet key from environment or Django SECRET_KEY."""
    raw_key = getattr(settings, "DATASOURCE_ENCRYPTION_KEY", "").strip() or settings.SECRET_KEY
    # Use SHA-256 digest encoded in base64 URL-safe format (32 bytes required by Fernet)
    derived = base64.urlsafe_b64encode(hashlib.sha256(raw_key.encode("utf-8")).digest())
    return Fernet(derived)


def encrypt_credential(plain_text: str) -> str:
    """Encrypt sensitive string (e.g. database password) using Fernet symmetric encryption."""
    if not plain_text:
        return ""
    try:
        fernet = _get_fernet()
        return fernet.encrypt(plain_text.encode("utf-8")).decode("utf-8")
    except Exception as exc:
        logger.error(f"Credential encryption error: {exc}")
        raise ValueError("Failed to encrypt database credentials securely.") from exc


def decrypt_credential(cipher_text: str) -> str:
    """Decrypt encrypted credential string using Fernet."""
    if not cipher_text:
        return ""
    try:
        fernet = _get_fernet()
        return fernet.decrypt(cipher_text.encode("utf-8")).decode("utf-8")
    except Exception as exc:
        logger.error(f"Credential decryption error: {exc}")
        return ""
