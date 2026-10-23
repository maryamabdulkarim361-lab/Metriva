"""
Background Job Execution Runner for ML Training, Backtesting, and Batch Scoring.

Manages asynchronous/background execution of machine learning workloads,
tracks granular progress, records telemetry logs, prevents duplicate runs,
and handles timeouts and failure recoveries gracefully.
"""

import logging
import threading
import traceback
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from django.conf import settings

from apps.ml.engine.anomaly import run_anomaly_detection_scan
from apps.ml.engine.churn import train_and_evaluate_churn_model
from apps.ml.engine.forecasting import train_and_forecast_revenue
from apps.ml.models import MLJob, MLModel, MLModelType, MLModelVersion, MLPrediction

logger = logging.getLogger(__name__)


def reconcile_stale_jobs(timeout_minutes: int = 15) -> int:
    """
    Reconcile zombie/stale jobs that were left in RUNNING or PENDING state
    due to ungraceful worker termination or server restart.
    """
    stale_threshold = datetime.now(timezone.utc) - timedelta(minutes=timeout_minutes)
    stale_qs = MLJob.objects.filter(
        status__in=["PENDING", "RUNNING"],
        created_at__lt=stale_threshold,
    )
    count = stale_qs.count()
    if count > 0:
        for job in stale_qs:
            job.status = "FAILED"
            job.error_message = f"Job timed out or worker process restarted after {timeout_minutes} minutes without progress."
            job.completed_at = datetime.now(timezone.utc)
            job.logs += f"[{datetime.now(timezone.utc).isoformat()}] RECONCILIATION: Flagged as failed due to worker inactivity/process termination.\n"
            job.save(update_fields=["status", "error_message", "completed_at", "logs"])
        logger.warning(f"Reconciled {count} stale ML background jobs.")
    return count


def cancel_ml_job(job_id: int, user=None) -> MLJob:
    """
    Cancel a queued or active ML job.
    """
    job = MLJob.objects.get(id=job_id)
    if job.status in ("SUCCESS", "FAILED", "CANCELLED"):
        return job

    job.status = "CANCELLED"
    job.completed_at = datetime.now(timezone.utc)
    job.logs += f"[{datetime.now(timezone.utc).isoformat()}] Job cancelled by user.\n"
    job.save(update_fields=["status", "completed_at", "logs"])
    return job


def trigger_ml_job(
    job_type: str,
    parameters: Optional[dict[str, Any]] = None,
    user=None,
    run_async: bool = True,
) -> MLJob:
    """
    Register and initiate a background ML execution job with duplicate suppression.

    Job Types:
    - "TRAIN_FORECAST": Trains revenue forecaster, computes backtesting metrics, and registers new model version.
    - "TRAIN_CHURN": Evaluates customer churn classifier, extracts RFM features, and registers predictions.
    - "ANOMALY_SCAN": Executes multi-metric scan across historical metrics and persists alerts.
    """
    # 1. Clean up any stale zombie jobs first
    reconcile_stale_jobs(timeout_minutes=15)

    # 2. Duplicate Execution Prevention
    # Check if an identical job is already queued or active in the last 10 minutes
    active_duplicate = (
        MLJob.objects.filter(
            job_type=job_type,
            status__in=["PENDING", "RUNNING"],
            created_at__gte=datetime.now(timezone.utc) - timedelta(minutes=10),
        )
        .order_by("-created_at")
        .first()
    )

    if active_duplicate:
        logger.info(
            f"ML Job of type '{job_type}' already running as Job #{active_duplicate.id}. Suppressing duplicate trigger."
        )
        return active_duplicate

    # 3. Create Job Record
    job = MLJob.objects.create(
        job_type=job_type,
        status="PENDING",
        progress_pct=5,
        parameters=parameters or {},
        logs=f"[{datetime.now(timezone.utc).isoformat()}] Job created and queued.\n",
        user=user if user and user.is_authenticated else None,
    )

    # 4. Optional Celery Dispatch if configured
    celery_broker = getattr(settings, "CELERY_BROKER_URL", None) or getattr(settings, "CELERY_ENABLED", False)
    if celery_broker:
        try:
            from apps.ml.tasks import execute_ml_job_task
            execute_ml_job_task.delay(job.id)
            return job
        except Exception as exc:
            logger.warning(f"Celery dispatch failed ({exc}), falling back to internal thread runner.")

    # 5. Local Async Thread Worker
    if run_async:
        thread = threading.Thread(target=_execute_job_worker, args=(job.id,), daemon=True)
        thread.start()
    else:
        _execute_job_worker(job.id)

    return job


def _execute_job_worker(job_id: int):
    """Worker routine running the computational pipeline and updating job state."""
    job = MLJob.objects.get(id=job_id)
    if job.status == "CANCELLED":
        return

    job.status = "RUNNING"
    job.started_at = datetime.now(timezone.utc)
    job.progress_pct = 15
    job.logs += f"[{datetime.now(timezone.utc).isoformat()}] Worker process started.\n"
    job.save(update_fields=["status", "started_at", "progress_pct", "logs"])

    try:
        # Check cancellation
        if MLJob.objects.filter(id=job.id, status="CANCELLED").exists():
            return

        if job.job_type == "TRAIN_FORECAST":
            job.logs += "Extracting historical completed revenue series and building backtest split...\n"
            job.progress_pct = 40
            job.save(update_fields=["progress_pct", "logs"])

            params = job.parameters or {}
            agg = params.get("aggregation", "monthly")
            horizon = int(params.get("forecast_horizon", 3))

            res = train_and_forecast_revenue(aggregation=agg, forecast_horizon=horizon)
            if not res.get("success"):
                raise ValueError(res.get("error", "Revenue forecasting failed."))

            if MLJob.objects.filter(id=job.id, status="CANCELLED").exists():
                return

            job.progress_pct = 80
            job.logs += f"Model training complete. Backtest MAE: ${res['evaluation_metrics']['mae']}. Registering model version...\n"

            # Register in Model Registry
            model_obj, _ = MLModel.objects.get_or_create(
                name="Revenue Time-Series Forecaster",
                defaults={
                    "model_type": MLModelType.REVENUE_FORECAST,
                    "description": "Holt-Winters linear trend exponential smoothing for forward sales projection.",
                },
            )
            v_count = model_obj.versions.count() + 1
            version_str = f"1.0.{v_count}"

            m_version = MLModelVersion.objects.create(
                model=model_obj,
                version=version_str,
                dataset_identifier=f"orders_{agg}",
                feature_names=["period_date", "total_amount", "order_count"],
                hyperparameters=res.get("model_parameters", {}),
                evaluation_metrics=res.get("evaluation_metrics", {}),
                baseline_metrics=res.get("baseline_comparison", {}),
                artifact_payload={"forecast_data": res.get("forecast_data", [])},
                approval_status="APPROVED",
                is_active=True,
            )

            # Persist Forecast Predictions
            for pt in res.get("forecast_data", []):
                MLPrediction.objects.create(
                    model_version=m_version,
                    prediction_type="FORECAST",
                    target_period=pt["date"],
                    predicted_value=pt["forecast"],
                    prediction_interval_lower=pt["prediction_interval_lower"],
                    prediction_interval_upper=pt["prediction_interval_upper"],
                )

            job.result_summary = {
                "model_version": version_str,
                "mae": res["evaluation_metrics"]["mae"],
                "rmse": res["evaluation_metrics"]["rmse"],
                "horizon_points": len(res.get("forecast_data", [])),
            }

        elif job.job_type == "TRAIN_CHURN":
            job.logs += "Extracting non-leaking customer RFM cohort features...\n"
            job.progress_pct = 45
            job.save(update_fields=["progress_pct", "logs"])

            res = train_and_evaluate_churn_model()
            if not res.get("success"):
                raise ValueError(res.get("error", "Churn training failed."))

            if MLJob.objects.filter(id=job.id, status="CANCELLED").exists():
                return

            job.progress_pct = 85
            job.logs += f"Classifier trained. Holdout F1: {res['evaluation_metrics']['f1_score']}. Persisting predictions...\n"

            model_obj, _ = MLModel.objects.get_or_create(
                name="Customer Churn Risk Classifier",
                defaults={
                    "model_type": MLModelType.CHURN_PREDICTION,
                    "description": "Calibrated logistic classification utilizing RFM customer behavior.",
                },
            )
            v_count = model_obj.versions.count() + 1
            version_str = f"1.0.{v_count}"

            m_version = MLModelVersion.objects.create(
                model=model_obj,
                version=version_str,
                dataset_identifier="customers_rfm",
                feature_names=list(res.get("feature_importance", {}).keys()),
                hyperparameters={"inactivity_window_days": res.get("inactivity_definition_days", 60)},
                evaluation_metrics=res.get("evaluation_metrics", {}),
                baseline_metrics=res.get("baseline_comparison", {}),
                approval_status="APPROVED",
                is_active=True,
            )

            # Persist predictions for top at-risk customers
            for cust in res.get("top_at_risk_customers", []):
                MLPrediction.objects.create(
                    model_version=m_version,
                    prediction_type="CHURN",
                    entity_id=str(cust["customer_id"]),
                    risk_score=cust["risk_score"],
                    risk_level=cust["risk_level"],
                    contributing_features=cust.get("primary_drivers", {}),
                )

            job.result_summary = {
                "model_version": version_str,
                "f1_score": res["evaluation_metrics"]["f1_score"],
                "accuracy": res["evaluation_metrics"]["accuracy"],
                "high_risk_customers": res["risk_distribution"]["high_risk_count"],
            }

        elif job.job_type == "ANOMALY_SCAN":
            job.logs += "Scanning daily time series across metrics for statistical outliers...\n"
            job.progress_pct = 50
            job.save(update_fields=["progress_pct", "logs"])

            res = run_anomaly_detection_scan(persist_alerts=True)
            if not res.get("success"):
                raise ValueError(res.get("error", "Anomaly scan failed."))

            job.progress_pct = 90
            job.result_summary = {
                "total_anomalies_detected": res["total_anomalies_detected"],
                "scanned_days": res["scanned_days"],
            }

        else:
            raise ValueError(f"Unknown ML job type: {job.job_type}")

        if MLJob.objects.filter(id=job.id, status="CANCELLED").exists():
            return

        job.status = "SUCCESS"
        job.progress_pct = 100
        job.completed_at = datetime.now(timezone.utc)
        job.logs += f"[{datetime.now(timezone.utc).isoformat()}] Job completed successfully.\n"
        job.save()

    except Exception as exc:
        err_msg = str(exc)
        stack = traceback.format_exc()
        logger.error(f"ML Job #{job.id} failed: {err_msg}\n{stack}")

        job.status = "FAILED"
        job.error_message = err_msg
        job.completed_at = datetime.now(timezone.utc)
        job.logs += f"[{datetime.now(timezone.utc).isoformat()}] ERROR: {err_msg}\n"
        job.save()
