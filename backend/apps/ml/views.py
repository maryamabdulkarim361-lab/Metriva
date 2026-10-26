"""
Machine Learning & Predictive Analytics REST API Endpoints.

Provides endpoints for on-demand revenue forecasting, customer churn prediction,
metric anomaly scans, AI executive insights, model registry governance,
and asynchronous training job orchestration.
"""

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.views import APIView

from apps.core.responses import api_error, api_response
from apps.ml.engine.anomaly import run_anomaly_detection_scan
from apps.ml.engine.churn import train_and_evaluate_churn_model
from apps.ml.engine.forecasting import train_and_forecast_revenue
from apps.ml.engine.insights import generate_ml_business_insights
from apps.ml.engine.runner import trigger_ml_job
from apps.ml.models import (
    MLAnomalyAlert,
    MLJob,
    MLModel,
    MLPrediction,
)
from apps.ml.serializers import (
    MLAnomalyAlertSerializer,
    MLJobSerializer,
    MLModelSerializer,
    MLPredictionSerializer,
)


class MLModelViewSet(viewsets.ReadOnlyModelViewSet):
    """Model Registry: lists registered machine learning models and versions."""

    queryset = MLModel.objects.prefetch_related("versions").all()
    serializer_class = MLModelSerializer
    permission_classes = [permissions.AllowAny]

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return api_response(data=serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return api_response(data=serializer.data)

    @action(detail=True, methods=["post"], url_path="approve-version")
    def approve_version(self, request, pk=None):
        """Approve and activate a specific model version for production deployment."""
        if not request.user or not request.user.is_authenticated:
            return api_error(
                message="Authentication required to approve model versions.",
                code="UNAUTHORIZED",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        from apps.organizations.models import RoleChoices
        from apps.organizations.service import resolve_tenant_context

        org, role = resolve_tenant_context(request)
        if org and role != RoleChoices.ADMIN and not request.user.is_staff:
            return api_error(
                message="Only organization Administrators can approve and activate production model versions.",
                code="ADMIN_REQUIRED",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        model_obj = self.get_object()
        version_id = request.data.get("version_id")
        if not version_id:
            return api_error(message="version_id is required.", code="MISSING_VERSION_ID")

        target_version = model_obj.versions.filter(id=version_id).first()
        if not target_version:
            return api_error(message="Model version not found.", code="NOT_FOUND", status_code=status.HTTP_404_NOT_FOUND)

        # Deactivate all other versions
        model_obj.versions.all().update(is_active=False)
        target_version.approval_status = "APPROVED"
        target_version.is_active = True
        target_version.save(update_fields=["approval_status", "is_active"])

        return api_response(
            data={"model": model_obj.name, "active_version": target_version.version},
            message=f"Version {target_version.version} approved and set as active in production.",
        )


class MLPredictionViewSet(viewsets.ReadOnlyModelViewSet):
    """Audit log of generated forecasts, risk scores, and predictions."""

    queryset = MLPrediction.objects.select_related("model_version__model").all()
    serializer_class = MLPredictionSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        p_type = self.request.query_params.get("type")
        if p_type:
            qs = qs.filter(prediction_type=p_type.upper())
        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset[:100], many=True)
        return api_response(data=serializer.data)


class MLAnomalyAlertViewSet(viewsets.ModelViewSet):
    """Anomaly alert management, acknowledgment, and historical audit."""

    queryset = MLAnomalyAlert.objects.all()
    serializer_class = MLAnomalyAlertSerializer
    permission_classes = [permissions.AllowAny]

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        unack_only = request.query_params.get("unacknowledged")
        if unack_only and unack_only.lower() in ("true", "1"):
            queryset = queryset.filter(is_acknowledged=False)
        serializer = self.get_serializer(queryset, many=True)
        return api_response(data=serializer.data)

    @action(detail=True, methods=["post"], url_path="acknowledge")
    def acknowledge(self, request, pk=None):
        """Acknowledge an anomaly alert."""
        alert = self.get_object()
        from django.utils import timezone

        alert.is_acknowledged = True
        alert.acknowledged_at = timezone.now()
        alert.acknowledged_by = request.user if request.user.is_authenticated else None
        alert.save(update_fields=["is_acknowledged", "acknowledged_at", "acknowledged_by"])

        return api_response(
            data={"id": alert.id, "is_acknowledged": True},
            message="Alert acknowledged.",
        )


class MLJobViewSet(viewsets.ReadOnlyModelViewSet):
    """Background ML training, backtesting, and batch execution job tracking."""

    queryset = MLJob.objects.all()
    serializer_class = MLJobSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        from django.db import models

        qs = super().get_queryset()
        user = self.request.user
        if user.is_authenticated:
            if not user.is_staff:
                qs = qs.filter(models.Q(user=user) | models.Q(user__isnull=True))
        else:
            qs = qs.filter(user__isnull=True)
        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset[:50], many=True)
        return api_response(data=serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return api_response(data=serializer.data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """Cancel a pending or running ML background job."""
        job = self.get_object()
        if job.user and job.user != request.user and not (request.user and request.user.is_staff):
            return api_error(
                message="You do not have permission to cancel this job.",
                code="FORBIDDEN",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        from apps.ml.engine.runner import cancel_ml_job

        cancelled = cancel_ml_job(job.id, user=request.user)
        return api_response(
            data={"id": cancelled.id, "status": cancelled.status},
            message="Job cancelled.",
        )


class RevenueForecastAPIView(APIView):
    """Instant on-demand time series revenue forecasting with backtesting and intervals."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        agg = request.query_params.get("aggregation", "monthly").lower()
        horizon = int(request.query_params.get("horizon", 3))

        res = train_and_forecast_revenue(aggregation=agg, forecast_horizon=horizon)
        if not res.get("success"):
            return api_error(message=res.get("error", "Forecasting failed."), code="FORECAST_ERROR")

        return api_response(data=res)

    def post(self, request):
        agg = request.data.get("aggregation", "monthly").lower()
        horizon = int(request.data.get("horizon", 3))

        res = train_and_forecast_revenue(aggregation=agg, forecast_horizon=horizon)
        if not res.get("success"):
            return api_error(message=res.get("error", "Forecasting failed."), code="FORECAST_ERROR")

        return api_response(data=res)


class CustomerChurnAPIView(APIView):
    """Instant on-demand customer churn classification, risk scoring, and contributing factors."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        inactivity_days = int(request.query_params.get("inactivity_days", 60))
        res = train_and_evaluate_churn_model(inactivity_days=inactivity_days)
        if not res.get("success"):
            return api_error(message=res.get("error", "Churn analysis failed."), code="CHURN_ERROR")

        return api_response(data=res)

    def post(self, request):
        inactivity_days = int(request.data.get("inactivity_days", 60))
        res = train_and_evaluate_churn_model(inactivity_days=inactivity_days)
        if not res.get("success"):
            return api_error(message=res.get("error", "Churn analysis failed."), code="CHURN_ERROR")

        return api_response(data=res)


class AnomalyScanAPIView(APIView):
    """Instant multi-metric anomaly scan across historical daily business observations."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        z_thresh = float(request.query_params.get("z_threshold", 2.2))
        res = run_anomaly_detection_scan(z_threshold=z_thresh, persist_alerts=True)
        if not res.get("success"):
            return api_error(message=res.get("error", "Anomaly scan failed."), code="SCAN_ERROR")

        return api_response(data=res)

    def post(self, request):
        z_thresh = float(request.data.get("z_threshold", 2.2))
        res = run_anomaly_detection_scan(z_threshold=z_thresh, persist_alerts=True)
        if not res.get("success"):
            return api_error(message=res.get("error", "Anomaly scan failed."), code="SCAN_ERROR")

        return api_response(data=res)


class MLInsightsAPIView(APIView):
    """Evidence-grounded executive business insights synthesizing forecasts, churn, and anomalies."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        topic = request.query_params.get("topic", "comprehensive")
        res = generate_ml_business_insights(topic=topic)
        return api_response(data=res)


class TriggerMLJobAPIView(APIView):
    """Trigger an asynchronous training, backtesting, or batch scoring job."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if request.user and request.user.is_authenticated:
            from apps.organizations.models import RoleChoices
            from apps.organizations.service import resolve_tenant_context

            org, role = resolve_tenant_context(request)
            if org and role == RoleChoices.VIEWER and not request.user.is_staff:
                return api_error(
                    message="Viewers do not have permission to trigger background machine learning jobs.",
                    code="FORBIDDEN",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

        job_type = request.data.get("job_type", "TRAIN_FORECAST")
        parameters = request.data.get("parameters", {})
        run_async = request.data.get("run_async", True)
        if isinstance(run_async, str):
            run_async = run_async.lower() in ("true", "1")

        job = trigger_ml_job(
            job_type=job_type,
            parameters=parameters,
            user=request.user,
            run_async=run_async,
        )

        return api_response(
            data={"job_id": job.id, "job_type": job.job_type, "status": job.status},
            message=f"Background ML job #{job.id} initiated.",
            status_code=status.HTTP_202_ACCEPTED,
        )
