"""Serializers for AI query processing and history inspection."""

from rest_framework import serializers

from apps.ai_assistant.models import QueryHistory


class QueryRequestSerializer(serializers.Serializer):
    """Input serializer for natural language questions."""

    question = serializers.CharField(
        max_length=1000,
        required=True,
        help_text="Natural language business question to ask the database.",
    )
    dry_run = serializers.BooleanField(
        default=False,
        required=False,
        help_text="If true, generates and validates SQL without executing against database.",
    )
    data_source_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        default=None,
        help_text="Optional ID of external DataSource to query. Defaults to internal PostgreSQL analytics database.",
    )
    datasource_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        default=None,
    )

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, "copy") else dict(data)
        if "datasource_id" in data and "data_source_id" not in data:
            data["data_source_id"] = data["datasource_id"]
        return super().to_internal_value(data)


class DirectSQLRequestSerializer(serializers.Serializer):
    """Input serializer for executing manual SQL through the security pipeline."""

    sql = serializers.CharField(
        max_length=10000,
        required=True,
        help_text="SQL statement to validate and execute.",
    )
    question = serializers.CharField(
        max_length=500,
        default="Direct SQL execution",
        required=False,
    )
    data_source_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        default=None,
        help_text="Optional ID of external DataSource to query. Defaults to internal PostgreSQL analytics database.",
    )
    datasource_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        default=None,
    )

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, "copy") else dict(data)
        if "datasource_id" in data and "data_source_id" not in data:
            data["data_source_id"] = data["datasource_id"]
        return super().to_internal_value(data)


class QueryHistorySerializer(serializers.ModelSerializer):
    """Serializer for query execution audit history."""

    user_email = serializers.CharField(source="user.email", read_only=True, default=None)

    class Meta:
        model = QueryHistory
        fields = [
            "id",
            "user",
            "user_email",
            "natural_language_question",
            "generated_sql",
            "execution_status",
            "execution_time_ms",
            "row_count",
            "error_message",
            "explanation",
            "created_at",
        ]
        read_only_fields = fields
