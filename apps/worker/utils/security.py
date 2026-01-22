"""Security signal detection rules and helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
import re
from typing import Callable, Iterable

from apps.worker.parsers.base import LogEvent
from packages.shared.enums import Severity


@dataclass(frozen=True)
class Rule:
    """Event-level rule for matching security signals."""

    name: str
    pattern: str | None = None
    predicate: Callable[[LogEvent], bool] | None = None
    severity: str = Severity.LOW
    title: str = ""
    description_template: str = ""
    suggested_action: str | None = None

    def is_match(self, event: LogEvent) -> bool:
        """Return True if event matches the rule."""
        if self.pattern:
            return re.search(self.pattern, event.path or "", re.IGNORECASE) is not None
        if self.predicate:
            return bool(self.predicate(event))
        return False


@dataclass(frozen=True)
class AggregateRule:
    """Aggregate rule based on bursts in events."""

    name: str
    status_predicate: Callable[[LogEvent], bool]
    threshold: int
    window_minutes: int
    severity: str
    title: str
    description_template: str
    suggested_action: str | None = None


@dataclass
class FindingCandidate:
    """Detected security finding."""

    finding_type: str
    severity: str
    title: str
    description: str
    evidence: list[dict]
    suggested_action: str | None
    metadata: dict

    def to_dict(self) -> dict:
        """Return a JSON-serializable dict."""
        return {
            "finding_type": self.finding_type,
            "severity": self.severity,
            "title": self.title,
            "description": self.description,
            "evidence": self.evidence,
            "suggested_action": self.suggested_action,
            "metadata": self.metadata,
        }


DEFAULT_RULES: list[Rule] = [
    # Scanning & Probing
    Rule(
        "path_traversal",
        pattern=r"\.\./|%2e%2e",
        severity=Severity.HIGH,
        title="Path Traversal Attempt Detected",
        description_template="Multiple requests containing ../ patterns detected from IP {ip}",
        suggested_action=(
            "Block IP {ip} at firewall level. Review WAF rules for path traversal protection."
        ),
    ),
    Rule(
        "env_file_access",
        pattern=r"/\.env",
        severity=Severity.CRITICAL,
        title="Environment File Access Attempt Detected",
        description_template="Requests to /.env detected from IP {ip}",
        suggested_action="Block IP {ip} and rotate any exposed secrets if necessary.",
    ),
    Rule(
        "wp_admin_probe",
        pattern=r"/wp-admin|/wp-login",
        severity=Severity.MEDIUM,
        title="WordPress Admin Probe Detected",
        description_template="Requests to WordPress admin paths detected from IP {ip}",
        suggested_action="Block IP {ip} if WordPress is not used. Tighten CMS access controls.",
    ),
    Rule(
        "phpmyadmin_probe",
        pattern=r"/phpmyadmin|/pma",
        severity=Severity.MEDIUM,
        title="phpMyAdmin Probe Detected",
        description_template="Requests to phpMyAdmin paths detected from IP {ip}",
        suggested_action="Block IP {ip} and restrict database admin interfaces.",
    ),
    Rule(
        "cgi_bin_probe",
        pattern=r"/cgi-bin/",
        severity=Severity.MEDIUM,
        title="CGI-BIN Probe Detected",
        description_template="Requests to /cgi-bin/ detected from IP {ip}",
        suggested_action="Block IP {ip} and remove or secure legacy CGI endpoints.",
    ),
    # Abuse Patterns
    Rule(
        "empty_user_agent",
        predicate=lambda e: not e.user_agent,
        severity=Severity.LOW,
        title="Empty User Agent Detected",
        description_template="Requests without a user-agent header detected from IP {ip}",
        suggested_action="Consider blocking automated clients from IP {ip}.",
    ),
    Rule(
        "suspicious_method",
        predicate=lambda e: e.method in {"TRACE", "CONNECT"},
        severity=Severity.MEDIUM,
        title="Suspicious HTTP Method Detected",
        description_template="Requests using TRACE or CONNECT detected from IP {ip}",
        suggested_action="Disable TRACE/CONNECT on the server and block IP {ip} if needed.",
    ),
]

DEFAULT_AGGREGATE_RULES: list[AggregateRule] = [
    AggregateRule(
        name="burst_404",
        status_predicate=lambda e: e.status == 404,
        threshold=10,
        window_minutes=10,
        severity=Severity.MEDIUM,
        title="Burst of 404 Responses",
        description_template="High rate of 404 responses detected from IP {ip}",
        suggested_action="Review the source IP {ip} for scanning or broken links.",
    ),
    AggregateRule(
        name="burst_500",
        status_predicate=lambda e: 500 <= e.status < 600,
        threshold=5,
        window_minutes=10,
        severity=Severity.HIGH,
        title="Burst of 5xx Responses",
        description_template="High rate of 5xx responses detected from IP {ip}",
        suggested_action="Investigate server errors and rate-limit IP {ip} if abusive.",
    ),
]


def _build_evidence(events: list[LogEvent], limit: int = 5) -> list[dict]:
    ordered = sorted(events, key=lambda e: e.timestamp)
    return [
        {"line": e.line_number, "raw": e.raw_line}
        for e in ordered[:limit]
    ]


def _format_description(template: str, ip: str) -> str:
    return template.format(ip=ip)


def _build_metadata(events: list[LogEvent], ip: str) -> dict:
    ordered = sorted(events, key=lambda e: e.timestamp)
    first_seen = ordered[0].timestamp.isoformat()
    last_seen = ordered[-1].timestamp.isoformat()
    return {
        "source_ip": ip,
        "count": len(events),
        "first_seen": first_seen,
        "last_seen": last_seen,
    }


def _detect_event_rules(
    events: Iterable[LogEvent],
    rules: Iterable[Rule],
) -> list[FindingCandidate]:
    matches: dict[tuple[str, str], list[LogEvent]] = {}

    for event in events:
        for rule in rules:
            if rule.is_match(event):
                ip = event.ip or "unknown"
                key = (rule.name, ip)
                if key not in matches:
                    matches[key] = []
                matches[key].append(event)

    findings: list[FindingCandidate] = []
    for (rule_name, ip), matched_events in matches.items():
        rule = next(r for r in rules if r.name == rule_name)
        findings.append(
            FindingCandidate(
                finding_type=rule.name,
                severity=rule.severity,
                title=rule.title,
                description=_format_description(rule.description_template, ip),
                evidence=_build_evidence(matched_events),
                suggested_action=rule.suggested_action.format(ip=ip) if rule.suggested_action else None,
                metadata=_build_metadata(matched_events, ip),
            )
        )
    return findings


def _detect_burst_rule(events: list[LogEvent], rule: AggregateRule) -> list[FindingCandidate]:
    events_by_ip: dict[str, list[LogEvent]] = {}
    for event in events:
        if rule.status_predicate(event):
            ip = event.ip or "unknown"
            events_by_ip.setdefault(ip, []).append(event)

    findings: list[FindingCandidate] = []
    window = timedelta(minutes=rule.window_minutes)

    for ip, ip_events in events_by_ip.items():
        ordered = sorted(ip_events, key=lambda e: e.timestamp)
        start = 0
        best_window: list[LogEvent] = []

        for end in range(len(ordered)):
            while ordered[end].timestamp - ordered[start].timestamp > window:
                start += 1
            current_window = ordered[start : end + 1]
            if len(current_window) >= rule.threshold and len(current_window) > len(best_window):
                best_window = current_window

        if best_window:
            findings.append(
                FindingCandidate(
                    finding_type=rule.name,
                    severity=rule.severity,
                    title=rule.title,
                    description=_format_description(rule.description_template, ip),
                    evidence=_build_evidence(best_window),
                    suggested_action=rule.suggested_action.format(ip=ip)
                    if rule.suggested_action
                    else None,
                    metadata=_build_metadata(best_window, ip),
                )
            )

    return findings


def detect_security_findings(
    events: list[LogEvent],
    rules: list[Rule] | None = None,
    aggregate_rules: list[AggregateRule] | None = None,
) -> list[FindingCandidate]:
    """Detect security findings from parsed log events."""
    rules = rules or DEFAULT_RULES
    aggregate_rules = aggregate_rules or DEFAULT_AGGREGATE_RULES

    findings = _detect_event_rules(events, rules)
    for rule in aggregate_rules:
        findings.extend(_detect_burst_rule(events, rule))

    return findings
