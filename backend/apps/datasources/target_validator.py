"""
Security validator for external database connection targets.

Protects against Server-Side Request Forgery (SSRF), internal port scanning,
path traversal, protocol smuggling, and cloud metadata access.
"""

import ipaddress
import os
import socket
from typing import Optional

from django.conf import settings
from rest_framework.exceptions import ValidationError

from apps.datasources.models import DataSourceEngine

# Prohibited system and infrastructure ports that databases should never use
PROHIBITED_PORTS = {
    20, 21,       # FTP
    22,           # SSH
    23,           # Telnet
    25, 465, 587, # SMTP
    53,           # DNS
    80, 443, 8080,# HTTP / HTTPS
    2375, 2376,   # Docker Daemon API
    6379,         # Redis
    6443, 10250,  # Kubernetes API / Kubelet
    8500,         # HashiCorp Consul
    9200, 9300,   # Elasticsearch
    11211,        # Memcached
    27017,        # MongoDB
}

# Known cloud metadata and instance identity hostnames
METADATA_HOSTNAMES = {
    "169.254.169.254",
    "metadata.google.internal",
    "metadata.azure.com",
    "instance-data",
    "100.100.100.200",  # Alibaba Cloud metadata
    "fd00:ec2::254",     # AWS IPv6 metadata
}

# Sensitive operating system paths that SQLite must never open
PROHIBITED_SYSTEM_PATHS = [
    "/etc",
    "/proc",
    "/sys",
    "/dev",
    "/root",
    "/var/run",
    "/var/log",
    "/bin",
    "/sbin",
    "/usr",
    "/boot",
    "~/.ssh",
    "~/.aws",
    "~/.gnupg",
]


def validate_target_host_and_port(engine_type: str, host: str, port: int) -> None:
    """
    Validate target host and port to strictly prevent SSRF and internal service tampering.
    """
    if engine_type == DataSourceEngine.SQLITE:
        return

    clean_host = (host or "").strip().lower()
    if not clean_host:
        raise ValidationError({"host": "Target database host cannot be empty."})

    # 1. Null-byte or header injection in hostname
    if "\x00" in clean_host or "\r" in clean_host or "\n" in clean_host:
        raise ValidationError({"host": "Target host contains illegal control characters."})

    # 2. Direct metadata hostname matches
    if clean_host in METADATA_HOSTNAMES:
        raise ValidationError({"host": "Access to cloud metadata endpoints is strictly forbidden (SSRF protection)."})

    # 3. Port restrictions
    if port < 1 or port > 65535:
        raise ValidationError({"port": "Port must be an integer between 1 and 65535."})

    if port in PROHIBITED_PORTS:
        raise ValidationError({
            "port": f"Port {port} is restricted to prevent protocol smuggling and unauthorized service access."
        })

    # 4. Resolve host to IP addresses and inspect for link-local / cloud metadata ranges
    try:
        addr_info = socket.getaddrinfo(clean_host, None)
        for entry in addr_info:
            ip_str = entry[4][0]
            ip_obj = ipaddress.ip_address(ip_str)

            # Block link-local addresses (e.g. 169.254.0.0/16 or fe80::/10)
            if ip_obj.is_link_local:
                raise ValidationError({"host": "Link-local addresses (169.254.x.x) are strictly forbidden (SSRF protection)."})

            # Block multicast
            if ip_obj.is_multicast:
                raise ValidationError({"host": "Multicast IP addresses are not permitted as database targets."})

            # Check explicit metadata IP network
            if isinstance(ip_obj, ipaddress.IPv4Address) and ip_obj in ipaddress.ip_network("169.254.0.0/16"):
                raise ValidationError({"host": "Link-local cloud metadata ranges are forbidden (SSRF protection)."})

    except socket.gaierror:
        # If DNS resolution fails, allow saving if it's a hostname that might resolve in Docker/VPC,
        # but the connection test will fail naturally.
        pass


def validate_sqlite_path(database_name: str) -> None:
    """
    Validate that an SQLite database path is safe, does not traverse directories,
    and does not access sensitive system configuration files.
    """
    clean_path = (database_name or "").strip()
    if not clean_path:
        raise ValidationError({"database_name": "SQLite database path cannot be empty."})

    # 1. Null-byte injection
    if "\x00" in clean_path:
        raise ValidationError({"database_name": "Database path contains null bytes."})

    # 2. Directory traversal
    if ".." in clean_path:
        raise ValidationError({"database_name": "Path traversal (..) is strictly prohibited in SQLite database paths."})

    # 3. Prohibited system root paths
    resolved = os.path.abspath(os.path.expanduser(clean_path))
    for prohibited in PROHIBITED_SYSTEM_PATHS:
        prohibited_abs = os.path.abspath(os.path.expanduser(prohibited))
        if resolved.startswith(prohibited_abs):
            raise ValidationError({
                "database_name": f"Access to system directory '{prohibited}' is strictly prohibited."
            })

    # 4. Allowed extensions or locations
    # Permitted if inside project BASE_DIR or has standard sqlite extensions (.db, .sqlite, .sqlite3)
    base_dir_str = str(settings.BASE_DIR)
    is_in_project = resolved.startswith(base_dir_str)
    has_valid_ext = any(resolved.lower().endswith(ext) for ext in (".db", ".sqlite", ".sqlite3"))

    if not is_in_project and not has_valid_ext:
        raise ValidationError({
            "database_name": "SQLite database must either reside within the project directory or have a valid database extension (.sqlite, .sqlite3, .db)."
        })


def validate_datasource_target(
    engine_type: str,
    host: str,
    port: int,
    database_name: str,
    username: Optional[str] = "",
) -> None:
    """
    Comprehensive target safety validation across all engine types.
    """
    if engine_type == DataSourceEngine.SQLITE:
        validate_sqlite_path(database_name)
    else:
        validate_target_host_and_port(engine_type, host, port)

        clean_db = (database_name or "").strip()
        if not clean_db:
            raise ValidationError({"database_name": "Database name cannot be empty."})
        if "\x00" in clean_db or "\r" in clean_db or "\n" in clean_db:
            raise ValidationError({"database_name": "Database name contains illegal control characters."})

        if username and ("\x00" in username or "\r" in username or "\n" in username):
            raise ValidationError({"username": "Username contains illegal control characters."})
