"""Anomaly detection utilities."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from statistics import mean, pstdev
from typing import Iterable

from apps.worker.utils.security import FindingCandidate
from packages.shared.enums import Severity


@dataclass(frozen=True)
class AggregateSnapshot:
    """Minimal aggregate snapshot for anomaly detection."""

    hour_bucket: datetime
    requests_count: int
    status_5xx: int
    unique_ips: int
    top_paths: list[dict] | None


def _safe_error_rate(status_5xx: int, requests: int) -> float:
    if requests <= 0:
        return 0.0
    return status_5xx / requests


def _zscore(value: float, baseline_values: list[float]) -> float | None:
    if len(baseline_values) < 2:
        return None
    baseline_mean = mean(baseline_values)
    baseline_std = pstdev(baseline_values)
    if baseline_std == 0:
        return None
    return (value - baseline_mean) / baseline_std


def detect_anomalies(
    site_aggregates: Iterable[AggregateSnapshot],
    target_aggregates: Iterable[AggregateSnapshot],
    baseline_days: int = 7,
    min_baseline_hours: int = 24,
    z_threshold: float = 3.0,
    new_path_min_count: int = 20,
) -> list[FindingCandidate]:
    """Detect anomalies from hourly aggregates."""
    site_aggregates = list(site_aggregates)
    target_aggregates = list(target_aggregates)

    findings: list[FindingCandidate] = []
    baseline_window = timedelta(days=baseline_days)

    for current in target_aggregates:
        baseline = [
            agg
            for agg in site_aggregates
            if current.hour_bucket - baseline_window <= agg.hour_bucket < current.hour_bucket
        ]
        if len(baseline) < min_baseline_hours:
            continue

        baseline_requests = [float(a.requests_count) for a in baseline]
        baseline_error_rates = [
            _safe_error_rate(a.status_5xx, a.requests_count) for a in baseline
        ]
        baseline_unique_ips = [float(a.unique_ips) for a in baseline]

        current_error_rate = _safe_error_rate(current.status_5xx, current.requests_count)

        request_z = _zscore(float(current.requests_count), baseline_requests)
        error_z = _zscore(current_error_rate, baseline_error_rates)
        ips_z = _zscore(float(current.unique_ips), baseline_unique_ips)

        if request_z is not None and request_z >= z_threshold:
            findings.append(
                FindingCandidate(
                    finding_type="traffic_spike",
                    severity=Severity.MEDIUM,
                    title="Traffic Spike Detected",
                    description=(
                        "Hourly request volume exceeded baseline by more than "
                        f"{z_threshold} standard deviations."
                    ),
                    evidence=[
                        {
                            "hour_bucket": current.hour_bucket.isoformat(),
                            "requests_count": current.requests_count,
                        }
                    ],
                    suggested_action="Investigate traffic source and rate-limit if abusive.",
                    metadata={
                        "hour_bucket": current.hour_bucket.isoformat(),
                        "requests_count": current.requests_count,
                        "z_score": request_z,
                        "unique_ips": current.unique_ips,
                        "unique_ips_z_score": ips_z,
                    },
                )
            )

        if error_z is not None and error_z >= z_threshold:
            findings.append(
                FindingCandidate(
                    finding_type="error_spike",
                    severity=Severity.HIGH,
                    title="Error Rate Spike Detected",
                    description=(
                        "Hourly 5xx error rate exceeded baseline by more than "
                        f"{z_threshold} standard deviations."
                    ),
                    evidence=[
                        {
                            "hour_bucket": current.hour_bucket.isoformat(),
                            "error_rate": round(current_error_rate, 4),
                            "status_5xx": current.status_5xx,
                        }
                    ],
                    suggested_action="Check application logs and recent deployments.",
                    metadata={
                        "hour_bucket": current.hour_bucket.isoformat(),
                        "error_rate": current_error_rate,
                        "z_score": error_z,
                    },
                )
            )

        baseline_paths = set()
        for agg in baseline:
            if agg.top_paths:
                for item in agg.top_paths:
                    path = item.get("path")
                    if path:
                        baseline_paths.add(path)

        if current.top_paths:
            for item in current.top_paths:
                path = item.get("path")
                count = int(item.get("count", 0))
                if not path:
                    continue
                if path in baseline_paths:
                    continue
                if count < new_path_min_count:
                    continue

                findings.append(
                    FindingCandidate(
                        finding_type="new_endpoint_burst",
                        severity=Severity.MEDIUM,
                        title="New Endpoint Burst Detected",
                        description=(
                            "High-traffic requests detected for a previously unseen path."
                        ),
                        evidence=[
                            {
                                "hour_bucket": current.hour_bucket.isoformat(),
                                "path": path,
                                "count": count,
                            }
                        ],
                        suggested_action="Verify the endpoint and check for unauthorized exposure.",
                        metadata={
                            "hour_bucket": current.hour_bucket.isoformat(),
                            "path": path,
                            "count": count,
                        },
                    )
                )

    return findings
