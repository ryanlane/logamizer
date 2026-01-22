"""Log event aggregation utilities."""

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class HourlyBucket:
    """Aggregated metrics for one hour."""

    hour: datetime
    requests_count: int = 0
    status_2xx: int = 0
    status_3xx: int = 0
    status_4xx: int = 0
    status_5xx: int = 0
    total_bytes: int = 0
    ips: set = field(default_factory=set)
    paths: Counter = field(default_factory=Counter)
    user_agents: Counter = field(default_factory=Counter)
    status_codes: Counter = field(default_factory=Counter)

    def to_dict(self, top_n: int = 10) -> dict:
        """Convert to dictionary for storage."""
        return {
            "hour_bucket": self.hour.isoformat(),
            "requests_count": self.requests_count,
            "status_2xx": self.status_2xx,
            "status_3xx": self.status_3xx,
            "status_4xx": self.status_4xx,
            "status_5xx": self.status_5xx,
            "total_bytes": self.total_bytes,
            "unique_ips": len(self.ips),
            "unique_paths": len(self.paths),
            "top_paths": [
                {"path": path, "count": count}
                for path, count in self.paths.most_common(top_n)
            ],
            "top_ips": [
                {"ip": ip, "count": count}
                for ip, count in Counter(self.ips).most_common(top_n)
            ],
            "top_user_agents": [
                {"user_agent": ua, "count": count}
                for ua, count in self.user_agents.most_common(top_n)
            ],
            "top_status_codes": [
                {"status": status, "count": count}
                for status, count in self.status_codes.most_common(top_n)
            ],
        }


@dataclass
class AggregationResult:
    """Complete aggregation result."""

    hourly_buckets: list[HourlyBucket] = field(default_factory=list)
    total_requests: int = 0
    total_bytes: int = 0
    unique_ips: set = field(default_factory=set)
    unique_paths: set = field(default_factory=set)
    status_breakdown: Counter = field(default_factory=Counter)
    top_paths: Counter = field(default_factory=Counter)
    top_ips: Counter = field(default_factory=Counter)
    top_user_agents: Counter = field(default_factory=Counter)
    top_referers: Counter = field(default_factory=Counter)
    methods: Counter = field(default_factory=Counter)
    first_timestamp: datetime | None = None
    last_timestamp: datetime | None = None

    def to_dict(self, top_n: int = 10) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "summary": {
                "total_requests": self.total_requests,
                "total_bytes": self.total_bytes,
                "unique_ips": len(self.unique_ips),
                "unique_paths": len(self.unique_paths),
                "first_timestamp": self.first_timestamp.isoformat() if self.first_timestamp else None,
                "last_timestamp": self.last_timestamp.isoformat() if self.last_timestamp else None,
            },
            "status_breakdown": {
                "2xx": self.status_breakdown.get("2xx", 0),
                "3xx": self.status_breakdown.get("3xx", 0),
                "4xx": self.status_breakdown.get("4xx", 0),
                "5xx": self.status_breakdown.get("5xx", 0),
            },
            "methods": dict(self.methods.most_common(top_n)),
            "top_paths": [
                {"path": path, "count": count}
                for path, count in self.top_paths.most_common(top_n)
            ],
            "top_ips": [
                {"ip": ip, "count": count}
                for ip, count in self.top_ips.most_common(top_n)
            ],
            "top_user_agents": [
                {"user_agent": ua[:100] if ua else None, "count": count}
                for ua, count in self.top_user_agents.most_common(top_n)
            ],
            "top_referers": [
                {"referer": ref[:200] if ref else None, "count": count}
                for ref, count in self.top_referers.most_common(top_n)
            ],
            "hourly_data": [bucket.to_dict(top_n) for bucket in self.hourly_buckets],
        }


class Aggregator:
    """Aggregates log events into hourly buckets and overall statistics."""

    def __init__(self):
        self._hourly: dict[datetime, HourlyBucket] = defaultdict(
            lambda: HourlyBucket(hour=datetime.now(timezone.utc))
        )
        self._result = AggregationResult()

    def _get_hour_key(self, timestamp: datetime) -> datetime:
        """Get the hour bucket key for a timestamp."""
        return timestamp.replace(minute=0, second=0, microsecond=0)

    def add_event(self, event) -> None:
        """Add a log event to the aggregation."""
        # Get or create hourly bucket
        hour_key = self._get_hour_key(event.timestamp)
        if hour_key not in self._hourly:
            self._hourly[hour_key] = HourlyBucket(hour=hour_key)
        bucket = self._hourly[hour_key]

        # Update hourly bucket
        bucket.requests_count += 1
        bucket.total_bytes += event.bytes_sent
        bucket.ips.add(event.ip)
        bucket.paths[event.path] += 1
        bucket.status_codes[event.status] += 1

        if event.user_agent:
            bucket.user_agents[event.user_agent] += 1

        # Update status class counts
        status_class = event.status_class
        if status_class == "2xx":
            bucket.status_2xx += 1
        elif status_class == "3xx":
            bucket.status_3xx += 1
        elif status_class == "4xx":
            bucket.status_4xx += 1
        elif status_class == "5xx":
            bucket.status_5xx += 1

        # Update overall stats
        self._result.total_requests += 1
        self._result.total_bytes += event.bytes_sent
        self._result.unique_ips.add(event.ip)
        self._result.unique_paths.add(event.path)
        self._result.status_breakdown[status_class] += 1
        self._result.top_paths[event.path] += 1
        self._result.top_ips[event.ip] += 1
        self._result.methods[event.method] += 1

        if event.user_agent:
            self._result.top_user_agents[event.user_agent] += 1
        if event.referer:
            self._result.top_referers[event.referer] += 1

        # Track time range
        if self._result.first_timestamp is None or event.timestamp < self._result.first_timestamp:
            self._result.first_timestamp = event.timestamp
        if self._result.last_timestamp is None or event.timestamp > self._result.last_timestamp:
            self._result.last_timestamp = event.timestamp

    def get_result(self) -> AggregationResult:
        """Get the aggregation result."""
        # Sort hourly buckets by time
        self._result.hourly_buckets = sorted(
            self._hourly.values(),
            key=lambda b: b.hour,
        )
        return self._result

    def aggregate_events(self, events) -> AggregationResult:
        """Aggregate a list of events."""
        for event in events:
            self.add_event(event)
        return self.get_result()
