"""Serializers for Machine Learning and Predictive Analytics models and endpoints."""

from rest_framework import serializers

from apps.ml.models import (
    MLAnomalyAlert,
    MLJob,
    MLModel,
    MLModelVersion,
    MLPrediction,
)


class MLModelVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MLModelVersion
        fields = [
            "id",
            "model",
            "version",
            "dataset_identifier",
            "training_start_date",
            "training_end_date",
            "feature_names",
            "hyperparameters",
            "evaluation_metrics",
            "baseline_metrics",
            "artifact_payload",
            "approval_status",
            "is_active",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class MLModelSerializer(serializers.ModelSerializer):
    versions = MLModelVersionSerializer(many=True, read_only=True)
    active_version = serializers.SerializerMethodField()

    class Meta:
        model = MLModel
        fields = [
            "id",
            "name",
            "model_type",
            "description",
            "created_by",
            "created_at",
            "versions",
            "active_version",
        ]
        read_only_fields = ["id", "created_at"]

    def get_active_version(self, obj):
        active = obj.versions.filter(is_active=True).first()
        if active:
            return MLModelVersionSerializer(active).data
        return None


class MLPredictionSerializer(serializers.ModelSerializer):
    model_name = serializers.CharField(source="model_version.model.name", read_only=True)
    version = serializers.CharField(source="model_version.version", read_only=True)

    class Meta:
        model = MLPrediction
        fields = [
            "id",
            "model_version",
            "model_name",
            "version",
            "prediction_type",
            "entity_id",
            "target_period",
            "predicted_value",
            "prediction_interval_lower",
            "prediction_interval_upper",
            "risk_score",
            "risk_level",
            "contributing_features",
            "created_at",
        ]
        read_only_fields = fields


class MLAnomalyAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = MLAnomalyAlert
        fields = [
            "id",
            "metric_name",
            "alert_timestamp",
            "observed_value",
            "baseline_value",
            "deviation_score",
            "severity",
            "context_summary",
            "is_acknowledged",
            "acknowledged_at",
            "acknowledged_by",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "acknowledged_at", "acknowledged_by"]


class MLJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = MLJob
        fields = [
            "id",
            "job_type",
            "status",
            "progress_pct",
            "parameters",
            "result_summary",
            "error_message",
            "logs",
            "started_at",
            "completed_at",
            "retry_count",
            "user",
            "created_at",
        ]
        read_only_fields = fields
