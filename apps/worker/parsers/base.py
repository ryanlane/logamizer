"""Base parser interface and data structures."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterator


@dataclass
class LogEvent:
    """Normalized log event structure."""

    timestamp: datetime
    ip: str
    method: str
    path: str
    status: int
    bytes_sent: int
    referer: str | None
    user_agent: str | None
    user: str | None = None
    protocol: str | None = None
    raw_line: str = ""
    line_number: int = 0

    @property
    def status_class(self) -> str:
        """Get status code class (2xx, 3xx, 4xx, 5xx)."""
        if 200 <= self.status < 300:
            return "2xx"
        elif 300 <= self.status < 400:
            return "3xx"
        elif 400 <= self.status < 500:
            return "4xx"
        elif 500 <= self.status < 600:
            return "5xx"
        return "other"


@dataclass
class ParseError:
    """Record of a parsing failure."""

    line_number: int
    raw_line: str
    error: str


@dataclass
class ParseResult:
    """Result of parsing a log file."""

    total_lines: int = 0
    parsed_lines: int = 0
    failed_lines: int = 0
    empty_lines: int = 0
    events: list[LogEvent] = field(default_factory=list)
    errors: list[ParseError] = field(default_factory=list)
    first_timestamp: datetime | None = None
    last_timestamp: datetime | None = None

    @property
    def success_rate(self) -> float:
        """Calculate parse success rate."""
        parseable = self.total_lines - self.empty_lines
        if parseable == 0:
            return 0.0
        return self.parsed_lines / parseable

    def add_event(self, event: LogEvent) -> None:
        """Add a successfully parsed event."""
        self.events.append(event)
        self.parsed_lines += 1

        if self.first_timestamp is None or event.timestamp < self.first_timestamp:
            self.first_timestamp = event.timestamp
        if self.last_timestamp is None or event.timestamp > self.last_timestamp:
            self.last_timestamp = event.timestamp

    def add_error(self, error: ParseError) -> None:
        """Add a parse error (keeps only first 10)."""
        self.failed_lines += 1
        if len(self.errors) < 10:
            self.errors.append(error)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "total_lines": self.total_lines,
            "parsed_lines": self.parsed_lines,
            "failed_lines": self.failed_lines,
            "empty_lines": self.empty_lines,
            "success_rate": round(self.success_rate * 100, 2),
            "first_timestamp": self.first_timestamp.isoformat() if self.first_timestamp else None,
            "last_timestamp": self.last_timestamp.isoformat() if self.last_timestamp else None,
            "sample_errors": [
                {"line": e.line_number, "error": e.error, "raw": e.raw_line[:200]}
                for e in self.errors
            ],
        }


class Parser(ABC):
    """Abstract base class for log parsers."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Parser name."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Parser description."""
        pass

    @abstractmethod
    def parse_line(self, line: str, line_number: int) -> LogEvent | None:
        """
        Parse a single log line.

        Args:
            line: The raw log line
            line_number: Line number in the file (1-indexed)

        Returns:
            LogEvent if parsing succeeded, None if line is empty/comment

        Raises:
            ValueError: If line cannot be parsed
        """
        pass

    def parse_stream(self, stream: Iterator[str]) -> ParseResult:
        """
        Parse a stream of log lines.

        Args:
            stream: Iterator yielding log lines

        Returns:
            ParseResult with all events and statistics
        """
        result = ParseResult()

        for line_number, line in enumerate(stream, start=1):
            result.total_lines += 1
            line = line.strip()

            if not line or line.startswith("#"):
                result.empty_lines += 1
                continue

            try:
                event = self.parse_line(line, line_number)
                if event is not None:
                    result.add_event(event)
                else:
                    result.empty_lines += 1
            except ValueError as e:
                result.add_error(ParseError(
                    line_number=line_number,
                    raw_line=line,
                    error=str(e),
                ))

        return result

    def parse_file(self, file_path: str) -> ParseResult:
        """
        Parse a log file.

        Args:
            file_path: Path to the log file

        Returns:
            ParseResult with all events and statistics
        """
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return self.parse_stream(f)

    def parse_bytes(self, data: bytes) -> ParseResult:
        """
        Parse log data from bytes.

        Args:
            data: Raw bytes of log file

        Returns:
            ParseResult with all events and statistics
        """
        text = data.decode("utf-8", errors="replace")
        return self.parse_stream(iter(text.splitlines()))
