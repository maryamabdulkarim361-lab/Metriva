"""Serializers for external database connections, testing, and schema allowlists."""

from rest_framework import serializers

from apps.datasources.models import DataSource, DataSourceEngine, SSLMode
from apps.datasources.target_validator import validate_datasource_target


class DataSourceSerializer(serializers.ModelSerializer):
    """
    Serializer for registering, updating, and viewing external data sources.
    Strictly masks sensitive credentials and supports write-only password updates.
    """

    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        style={"input_type": "password"},
        help_text="Database password (encrypted upon storage, never returned in API responses).",
    )
    engine_display = serializers.CharField(source="get_engine_display", read_only=True)
    table_count = serializers.SerializerMethodField()

    class Meta:
        model = DataSource
        fields = [
            "id",
            "name",
            "description",
            "engine",
            "engine_display",
            "host",
            "port",
            "database_name",
            "username",
            "password",
            "ssl_mode",
            "is_active",
            "allowed_schemas",
            "allowed_tables",
            "cached_schema",
            "schema_last_synced_at",
            "table_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "cached_schema",
            "schema_last_synced_at",
            "table_count",
            "created_at",
            "updated_at",
        ]

    def get_table_count(self, obj: DataSource) -> int:
        tables = obj.cached_schema.get("tables", [])
        return len(tables)

    def validate_port(self, value):
        if value < 1 or value > 65535:
            raise serializers.ValidationError("Port must be between 1 and 65535.")
        return value

    def validate(self, attrs):
        engine = attrs.get("engine", getattr(self.instance, "engine", DataSourceEngine.POSTGRESQL))
        host = attrs.get("host", getattr(self.instance, "host", "localhost"))
        port = attrs.get("port", getattr(self.instance, "port", 5432))
        database_name = attrs.get("database_name", getattr(self.instance, "database_name", ""))
        username = attrs.get("username", getattr(self.instance, "username", ""))

        validate_datasource_target(
            engine_type=engine,
            host=host,
            port=port,
            database_name=database_name,
            username=username,
        )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", "")
        # Associate with requesting user if authenticated
        request = self.context.get("request")
        user = request.user if request and request.user.is_authenticated else None

        instance = DataSource.objects.create(user=user, **validated_data)
        if password:
            instance.set_password(password)
            instance.save(update_fields=["encrypted_password"])
        return instance

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password is not None and password != "":
            instance.set_password(password)

        instance.save()
        return instance


class TestConnectionRequestSerializer(serializers.Serializer):
    """Input serializer for testing raw connection parameters before saving."""

    engine = serializers.ChoiceField(choices=DataSourceEngine.choices, default=DataSourceEngine.POSTGRESQL)
    host = serializers.CharField(max_length=255, default="localhost", allow_blank=True)
    port = serializers.IntegerField(default=5432)
    database_name = serializers.CharField(max_length=255)
    username = serializers.CharField(max_length=255, allow_blank=True, default="")
    password = serializers.CharField(max_length=255, allow_blank=True, default="", write_only=True)
    ssl_mode = serializers.ChoiceField(choices=SSLMode.choices, default=SSLMode.PREFER)

    def validate(self, attrs):
        validate_datasource_target(
            engine_type=attrs.get("engine", DataSourceEngine.POSTGRESQL),
            host=attrs.get("host", "localhost"),
            port=attrs.get("port", 5432),
            database_name=attrs.get("database_name", ""),
            username=attrs.get("username", ""),
        )
        return attrs


class UpdateAllowedTablesSerializer(serializers.Serializer):
    """Input serializer for configuring which schemas and tables the AI is permitted to query."""

    allowed_tables = serializers.ListField(
        child=serializers.CharField(max_length=120),
        required=True,
        help_text="List of permitted table names.",
    )
    allowed_schemas = serializers.ListField(
        child=serializers.CharField(max_length=120),
        required=False,
        default=list,
        help_text="Optional list of permitted schemas.",
    )
