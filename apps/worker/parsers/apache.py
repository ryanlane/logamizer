"""Apache combined log format parser."""

import re
from datetime import datetime, timezone

from apps.worker.parsers.base import LogEvent, Parser

# Apache combined log format:
# %h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-Agent}i"
#
# Example:
# 127.0.0.1 - frank [10/Oct/2024:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.0" 200 2326 "http://www.example.com/start.html" "Mozilla/4.08"

# Apache format is essentially the same as Nginx combined
APACHE_COMBINED_PATTERN = re.compile(
    r'^'
    r'(?P<ip>\S+)\s+'                          # Remote host
    r'(?P<ident>\S+)\s+'                        # Remote logname (usually -)
    r'(?P<user>\S+)\s+'                         # Remote user
    r'\[(?P<time>[^\]]+)\]\s+'                  # Time in brackets
    r'"(?P<request>[^"]*)"\s+'                  # Request line in quotes
    r'(?P<status>\d+)\s+'                       # Status code
    r'(?P<bytes>\d+|-)\s*'                      # Bytes sent
    r'(?:"(?P<referer>[^"]*)"\s*)?'             # Referer in quotes (optional)
    r'(?:"(?P<user_agent>[^"]*)")?'             # User agent in quotes (optional)
    r'.*$'                                       # Any trailing content
)

# Time format: 10/Oct/2024:13:55:36 -0700
TIME_FORMAT = "%d/%b/%Y:%H:%M:%S %z"

# Request line pattern: METHOD /path HTTP/version
REQUEST_PATTERN = re.compile(r'^(?P<method>\S+)\s+(?P<path>\S+)(?:\s+(?P<protocol>\S+))?$')


class ApacheCombinedParser(Parser):
    """Parser for Apache combined log format."""

    @property
    def name(self) -> str:
        return "apache_combined"

    @property
    def description(self) -> str:
        return "Apache combined log format"

    def parse_line(self, line: str, line_number: int) -> LogEvent | None:
        """Parse a single Apache log line."""
        if not line or line.startswith("#"):
            return None

        match = APACHE_COMBINED_PATTERN.match(line)
        if not match:
            raise ValueError("Line does not match Apache combined format")

        groups = match.groupdict()

        # Parse timestamp
        try:
            timestamp = datetime.strptime(groups["time"], TIME_FORMAT)
            # Convert to UTC
            timestamp = timestamp.astimezone(timezone.utc)
        except ValueError as e:
            raise ValueError(f"Invalid timestamp format: {e}")

        # Parse request line
        request = groups.get("request", "")
        method = "-"
        path = "-"
        protocol = None

        if request and request != "-":
            req_match = REQUEST_PATTERN.match(request)
            if req_match:
                req_groups = req_match.groupdict()
                method = req_groups.get("method", "-")
                path = req_groups.get("path", "-")
                protocol = req_groups.get("protocol")
            else:
                # Malformed request line - use as path
                path = request

        # Parse status code
        try:
            status = int(groups["status"])
        except (ValueError, TypeError):
            raise ValueError(f"Invalid status code: {groups['status']}")

        # Parse bytes sent
        bytes_str = groups.get("bytes", "0")
        try:
            bytes_sent = 0 if bytes_str == "-" else int(bytes_str)
        except ValueError:
            bytes_sent = 0

        # Handle optional fields
        referer = groups.get("referer")
        if referer == "-":
            referer = None

        user_agent = groups.get("user_agent")
        if user_agent == "-":
            user_agent = None

        user = groups.get("user")
        if user == "-":
            user = None

        return LogEvent(
            timestamp=timestamp,
            ip=groups["ip"],
            method=method,
            path=path,
            status=status,
            bytes_sent=bytes_sent,
            referer=referer,
            user_agent=user_agent,
            user=user,
            protocol=protocol,
            raw_line=line,
            line_number=line_number,
        )
