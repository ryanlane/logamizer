"""Celery tasks."""

from apps.worker.tasks.error_analysis import analyze_errors_in_log_file, update_error_rates
from apps.worker.tasks.fetch import fetch_logs_from_source, test_log_source_connection
from apps.worker.tasks.parse import parse_log_file
from apps.worker.tasks.scheduler import schedule_log_fetches

__all__ = [
    "parse_log_file",
    "fetch_logs_from_source",
    "test_log_source_connection",
    "schedule_log_fetches",
    "analyze_errors_in_log_file",
    "update_error_rates",
]
