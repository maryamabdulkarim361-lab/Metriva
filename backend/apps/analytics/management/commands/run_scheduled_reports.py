"""
Management command to run pending scheduled business intelligence reports.

Prevents overlapping executions, validates queries with SQLValidator,
executes read-only transactions, updates next run times with timezone awareness,
and records execution telemetry.
"""

import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.ai_assistant.executor import SQLExecutor
from apps.ai_assistant.sql_validator import SQLValidator
from apps.analytics.models import (
    ScheduledReport,
    ScheduledReportExecution,
    ScheduledReportFrequency,
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Execute active pending scheduled reports and advance run timers."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate execution without running database queries.",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        now = timezone.now()

        # Fetch active schedules due for execution
        pending_schedules = ScheduledReport.objects.filter(is_active=True).filter(
            models_due_filter(now)
        )

        self.stdout.write(
            self.style.NOTICE(f"Checking scheduled reports at {now.isoformat()}... Found {pending_schedules.count()} pending.")
        )

        executed_count = 0
        failed_count = 0

        for schedule in pending_schedules:
            report = schedule.report
            self.stdout.write(f"Executing schedule #{schedule.id}: '{schedule.name}' for report '{report.name}'...")

            if dry_run:
                self.stdout.write(self.style.WARNING("  [DRY RUN] Skipped actual execution."))
                continue

            validator = SQLValidator()
            validation = validator.validate(report.sql)

            if not validation.is_valid:
                ScheduledReportExecution.objects.create(
                    scheduled_report=schedule,
                    status="FAILED",
                    error_message=f"SQL Validation Error: {validation.error_message}",
                )
                self.stdout.write(self.style.ERROR(f"  BLOCKED: {validation.error_message}"))
                failed_count += 1
                advance_schedule_next_run(schedule, now)
                continue

            executor = SQLExecutor()
            res = executor.execute(
                sql=validation.sanitized_sql,
                question=report.natural_language_question or report.name,
                user=schedule.user,
            )

            status_val = "SUCCESS" if res["success"] else "FAILED"
            ScheduledReportExecution.objects.create(
                scheduled_report=schedule,
                status=status_val,
                row_count=res.get("row_count", 0),
                execution_time_ms=res.get("execution_time_ms", 0.0),
                error_message=res.get("error"),
                summary_payload={
                    "report_name": report.name,
                    "chart_type": report.chart_type,
                },
            )

            if res["success"]:
                self.stdout.write(self.style.SUCCESS(f"  SUCCESS: {res.get('row_count', 0)} rows in {res.get('execution_time_ms', 0):.1f}ms"))
                executed_count += 1
            else:
                self.stdout.write(self.style.ERROR(f"  FAILED: {res.get('error')}"))
                failed_count += 1

            advance_schedule_next_run(schedule, now)

        self.stdout.write(
            self.style.SUCCESS(f"Completed scheduled runs. Executed: {executed_count}, Failed: {failed_count}.")
        )


def models_due_filter(now):
    from django.db.models import Q
    return Q(next_run_at__isnull=True) | Q(next_run_at__lte=now)


def advance_schedule_next_run(schedule: ScheduledReport, current_time):
    """Compute and advance next_run_at based on frequency."""
    schedule.last_run_at = current_time

    if schedule.frequency == ScheduledReportFrequency.DAILY:
        schedule.next_run_at = current_time + timedelta(days=1)
    elif schedule.frequency == ScheduledReportFrequency.WEEKLY:
        schedule.next_run_at = current_time + timedelta(weeks=1)
    elif schedule.frequency == ScheduledReportFrequency.MONTHLY:
        schedule.next_run_at = current_time + timedelta(days=30)
    else:
        schedule.next_run_at = current_time + timedelta(days=1)

    schedule.save(update_fields=["last_run_at", "next_run_at"])
