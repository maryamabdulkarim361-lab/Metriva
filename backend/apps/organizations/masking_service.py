"""Column-Level Data Masking Service for Metriva."""

import re
from typing import Any, List, Optional

from apps.organizations.models import ColumnMaskingPolicy, MaskingType, RoleChoices


def mask_email(email_str: str) -> str:
    """
    Mask an email string preserving first/last character of username and the domain.
    Example: 'john.doe@company.com' -> 'j***e@company.com'
    """
    if not isinstance(email_str, str) or "@" not in email_str:
        return "[REDACTED]"
    parts = email_str.split("@", 1)
    user_part, domain_part = parts[0], parts[1]
    if len(user_part) <= 2:
        masked_user = user_part[0] + "***" if user_part else "***"
    else:
        masked_user = user_part[0] + "***" + user_part[-1]
    return f"{masked_user}@{domain_part}"


def mask_phone(phone_str: str) -> str:
    """
    Mask a phone number preserving only the last 4 digits.
    Example: '+1-555-839-2049' -> '***-***-2049'
    """
    if not isinstance(phone_str, str):
        phone_str = str(phone_str)
    digits = re.sub(r"\D", "", phone_str)
    if len(digits) >= 4:
        last4 = digits[-4:]
        return f"***-***-{last4}"
    return "***-***-****"


def mask_cell_value(value: Any, masking_type: str) -> Any:
    """Apply masking transformation to an individual cell value."""
    if value is None:
        return None

    if masking_type == MaskingType.NULLIFY:
        return None
    elif masking_type == MaskingType.REDACT:
        return "[REDACTED]"
    elif masking_type == MaskingType.EMAIL:
        return mask_email(str(value))
    elif masking_type == MaskingType.PHONE:
        return mask_phone(str(value))
    else:
        return "[REDACTED]"


class DataMaskingService:
    """
    Evaluates and executes column-level data masking for query results,
    CSV exports, and BI dashboards based on organization policies.
    """

    mask_email = staticmethod(mask_email)
    mask_phone = staticmethod(mask_phone)

    @staticmethod
    def get_column_policy_map(organization) -> List[ColumnMaskingPolicy]:
        """Fetch all active masking policies for the organization."""
        if not organization:
            return []
        return list(
            ColumnMaskingPolicy.objects.filter(
                organization=organization,
                is_active=True,
            )
        )

    @classmethod
    def find_matching_policy(
        cls, column_name: str, policies: List[ColumnMaskingPolicy]
    ) -> Optional[ColumnMaskingPolicy]:
        """Determine if a column name matches any active policy."""
        clean_col = column_name.strip().lower()

        # 1. Check exact match
        for policy in policies:
            if policy.match_type == "EXACT":
                if clean_col == policy.match_pattern.strip().lower():
                    return policy

        # 2. Check regex match
        for policy in policies:
            if policy.match_type == "REGEX":
                try:
                    if re.search(policy.match_pattern, clean_col, re.IGNORECASE):
                        return policy
                except re.error:
                    continue

        # 3. Built-in fallback heuristics for common sensitive fields
        if clean_col in ("email", "user_email", "customer_email"):
            return ColumnMaskingPolicy(
                rule_name="Builtin Email",
                masking_type=MaskingType.EMAIL,
            )
        if clean_col in ("phone", "phone_number", "mobile", "tel"):
            return ColumnMaskingPolicy(
                rule_name="Builtin Phone",
                masking_type=MaskingType.PHONE,
            )
        if re.search(r"(password|secret|token|api_key|private_key|auth_hash|salt|ssn)", clean_col):
            return ColumnMaskingPolicy(
                rule_name="Builtin Secret",
                masking_type=MaskingType.REDACT,
            )

        return None

    @classmethod
    def mask_result_set(
        cls,
        columns: List[str],
        rows: List[List[Any]],
        organization,
        user_role: Optional[str] = None,
    ) -> List[List[Any]]:
        """
        Transform rows by applying masking to columns targeted by organization policies.
        Admins are exempt; Analysts and Viewers receive masked data.
        """
        # Administrators see unmasked data
        if user_role == RoleChoices.ADMIN:
            return rows

        if not columns or not rows:
            return rows

        policies = cls.get_column_policy_map(organization)
        named_transforms = {}
        col_transforms = {}

        for idx, col in enumerate(columns):
            policy = cls.find_matching_policy(col, policies)
            if policy:
                col_transforms[idx] = policy.masking_type
                named_transforms[col] = policy.masking_type

        if not col_transforms and not named_transforms:
            return rows

        masked_rows = []
        for r in rows:
            if isinstance(r, dict):
                new_row = dict(r)
                for col_name, mask_type in named_transforms.items():
                    if col_name in new_row:
                        new_row[col_name] = mask_cell_value(new_row[col_name], mask_type)
                masked_rows.append(new_row)
            else:
                new_row = list(r)
                for idx, mask_type in col_transforms.items():
                    if idx < len(new_row):
                        new_row[idx] = mask_cell_value(new_row[idx], mask_type)
                masked_rows.append(new_row)

        return masked_rows
