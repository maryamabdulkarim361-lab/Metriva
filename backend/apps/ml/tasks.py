"""
Optional Celery tasks for distributed asynchronous ML training and batch scoring.
Activates automatically when CELERY_BROKER_URL is configured in environment.
"""

import logging

logger = logging.getLogger(__name__)

try:
    from celery import shared_task

    @shared_task(bind=True, max_retries=2, default_retry_delay=30)
    def execute_ml_job_task(self, job_id: int):
        """Celery worker task delegating to the unified ML pipeline."""
        from apps.ml.engine.runner import _execute_job_worker
        try:
            _execute_job_worker(job_id)
        except Exception as exc:
            logger.error(f"Celery ML Job task failed for job #{job_id}: {exc}")
            raise self.retry(exc=exc)

except ImportError:
    # Celery not installed in environment; falls back gracefully to thread runner
    pass
