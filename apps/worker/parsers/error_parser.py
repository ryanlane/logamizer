"""Error log parser for extracting error information and stack traces."""

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass
class ParsedError:
    """Parsed error information."""

    error_type: str
    error_message: str
    timestamp: datetime
    stack_trace: str | None = None
    file_path: str | None = None
    line_number: int | None = None
    function_name: str | None = None
    request_url: str | None = None
    request_method: str | None = None
    user_id: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    context: dict[str, Any] | None = None

    def get_fingerprint(self) -> str:
        """Generate a unique fingerprint for grouping similar errors."""
        # Normalize error message (remove variable values)
        normalized_message = self._normalize_message(self.error_message)

        # Include error type and first frame of stack trace
        fingerprint_parts = [self.error_type, normalized_message]

        # Add first stack frame for more specific grouping
        if self.file_path and self.line_number:
            fingerprint_parts.append(f"{self.file_path}:{self.line_number}")
        elif self.stack_trace:
            first_frame = self._extract_first_frame(self.stack_trace)
            if first_frame:
                fingerprint_parts.append(first_frame)

        # Generate SHA256 hash
        fingerprint_string = "|".join(fingerprint_parts)
        return hashlib.sha256(fingerprint_string.encode()).hexdigest()

    def _normalize_message(self, message: str) -> str:
        """Normalize error message by removing variable values."""
        # Remove numbers
        message = re.sub(r"\b\d+\b", "N", message)
        # Remove hex values
        message = re.sub(r"0x[0-9a-fA-F]+", "0xHEX", message)
        # Remove quoted strings
        message = re.sub(r'"[^"]*"', '"STR"', message)
        message = re.sub(r"'[^']*'", "'STR'", message)
        # Remove file paths
        message = re.sub(r"/[\w/.-]+", "/PATH", message)
        # Remove URLs
        message = re.sub(r"https?://\S+", "URL", message)
        return message

    def _extract_first_frame(self, stack_trace: str) -> str | None:
        """Extract the first meaningful frame from stack trace."""
        # Try Python traceback format
        match = re.search(r'File "([^"]+)", line (\d+), in (\w+)', stack_trace)
        if match:
            return f"{match.group(1)}:{match.group(2)}:{match.group(3)}"

        # Try Java/JavaScript format
        match = re.search(r"at ([\w.]+)\(([\w.]+):(\d+)", stack_trace)
        if match:
            return f"{match.group(2)}:{match.group(3)}:{match.group(1)}"

        return None


class ErrorLogParser:
    """Parser for application error logs in various formats."""

    # Common error patterns
    PYTHON_ERROR_PATTERN = re.compile(
        r"(?P<timestamp>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)"
        r".*?"
        r"(?P<error_type>\w+(?:Error|Exception)): (?P<message>.*?)(?:\n|$)",
        re.MULTILINE,
    )

    PYTHON_TRACEBACK_PATTERN = re.compile(
        r"Traceback \(most recent call last\):(.*?)(?=\n\w+(?:Error|Exception):|\Z)",
        re.DOTALL,
    )

    PYTHON_FILE_LINE_PATTERN = re.compile(
        r'File "(?P<file>[^"]+)", line (?P<line>\d+), in (?P<function>\w+)'
    )

    JAVASCRIPT_ERROR_PATTERN = re.compile(
        r"(?P<timestamp>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)"
        r".*?"
        r"(?P<error_type>\w+Error): (?P<message>.*?)(?:\n|$)",
        re.MULTILINE,
    )

    JAVA_ERROR_PATTERN = re.compile(
        r"(?P<timestamp>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)"
        r".*?"
        r"(?P<error_type>[\w.]+Exception): (?P<message>.*?)(?:\n|$)",
        re.MULTILINE,
    )

    # HTTP error patterns from web logs
    HTTP_500_PATTERN = re.compile(
        r"(?P<ip>[\d.]+) - (?P<user>\S+) \[(?P<timestamp>[^\]]+)\] "
        r'"(?P<method>\w+) (?P<url>\S+) HTTP/\d\.\d" 5\d{2}'
    )

    APACHE_ERROR_PATTERN = re.compile(
        r"^\[(?P<timestamp>[A-Za-z]{3} [A-Za-z]{3} \d{2} \d{2}:\d{2}:\d{2} \d{4})\]"
        r"\s+\[(?P<module>[^\]]+)\]"
        r"(?:\s+\[[^\]]+\])*"
        r"\s+(?:\[client (?P<ip>[^\]]+)\]\s+)?"
        r"(?P<message>.*)$",
        re.MULTILINE,
    )

    def parse_log_content(self, content: str, log_format: str = "auto") -> list[ParsedError]:
        """Parse log content and extract error information."""
        errors = []

        if log_format == "auto":
            # Try different formats
            errors.extend(self._parse_python_errors(content))
            errors.extend(self._parse_javascript_errors(content))
            errors.extend(self._parse_java_errors(content))
            errors.extend(self._parse_http_errors(content))
            errors.extend(self._parse_apache_errors(content))
        elif log_format == "python":
            errors.extend(self._parse_python_errors(content))
        elif log_format == "javascript":
            errors.extend(self._parse_javascript_errors(content))
        elif log_format == "java":
            errors.extend(self._parse_java_errors(content))
        elif log_format == "http":
            errors.extend(self._parse_http_errors(content))
        elif log_format in {"apache", "apache_error", "modsecurity"}:
            errors.extend(self._parse_apache_errors(content))

        return errors

    def _parse_python_errors(self, content: str) -> list[ParsedError]:
        """Parse Python errors and exceptions."""
        errors = []

        for match in self.PYTHON_ERROR_PATTERN.finditer(content):
            timestamp_str = match.group("timestamp")
            error_type = match.group("error_type")
            message = match.group("message").strip()

            # Parse timestamp
            timestamp = self._parse_timestamp(timestamp_str)

            # Look for traceback before this error
            error_pos = match.start()
            preceding_content = content[max(0, error_pos - 5000) : error_pos]
            traceback_match = list(self.PYTHON_TRACEBACK_PATTERN.finditer(preceding_content))

            stack_trace = None
            file_path = None
            line_number = None
            function_name = None

            if traceback_match:
                # Get the last (closest) traceback
                stack_trace = traceback_match[-1].group(0)

                # Extract file, line, function from last frame
                frame_matches = list(self.PYTHON_FILE_LINE_PATTERN.finditer(stack_trace))
                if frame_matches:
                    last_frame = frame_matches[-1]
                    file_path = last_frame.group("file")
                    line_number = int(last_frame.group("line"))
                    function_name = last_frame.group("function")

            errors.append(
                ParsedError(
                    error_type=error_type,
                    error_message=message,
                    timestamp=timestamp,
                    stack_trace=stack_trace,
                    file_path=file_path,
                    line_number=line_number,
                    function_name=function_name,
                )
            )

        return errors

    def _parse_javascript_errors(self, content: str) -> list[ParsedError]:
        """Parse JavaScript errors."""
        errors = []

        for match in self.JAVASCRIPT_ERROR_PATTERN.finditer(content):
            timestamp_str = match.group("timestamp")
            error_type = match.group("error_type")
            message = match.group("message").strip()

            timestamp = self._parse_timestamp(timestamp_str)

            # Look for stack trace after error
            error_pos = match.end()
            following_content = content[error_pos : error_pos + 2000]
            stack_lines = []

            for line in following_content.split("\n"):
                if line.strip().startswith("at "):
                    stack_lines.append(line.strip())
                elif stack_lines:
                    break

            stack_trace = "\n".join(stack_lines) if stack_lines else None

            # Extract first frame
            file_path = None
            line_number = None
            function_name = None
            if stack_trace:
                frame_match = re.search(r"at ([\w.]+) \(([\w./]+):(\d+):\d+\)", stack_trace)
                if frame_match:
                    function_name = frame_match.group(1)
                    file_path = frame_match.group(2)
                    line_number = int(frame_match.group(3))

            errors.append(
                ParsedError(
                    error_type=error_type,
                    error_message=message,
                    timestamp=timestamp,
                    stack_trace=stack_trace,
                    file_path=file_path,
                    line_number=line_number,
                    function_name=function_name,
                )
            )

        return errors

    def _parse_java_errors(self, content: str) -> list[ParsedError]:
        """Parse Java exceptions."""
        errors = []

        for match in self.JAVA_ERROR_PATTERN.finditer(content):
            timestamp_str = match.group("timestamp")
            error_type = match.group("error_type")
            message = match.group("message").strip()

            timestamp = self._parse_timestamp(timestamp_str)

            # Look for stack trace after exception
            error_pos = match.end()
            following_content = content[error_pos : error_pos + 3000]
            stack_lines = []

            for line in following_content.split("\n"):
                stripped = line.strip()
                if stripped.startswith("at ") or stripped.startswith("..."):
                    stack_lines.append(stripped)
                elif stripped.startswith("Caused by:"):
                    stack_lines.append(stripped)
                elif stack_lines and not stripped:
                    break

            stack_trace = "\n".join(stack_lines) if stack_lines else None

            # Extract first frame
            file_path = None
            line_number = None
            function_name = None
            if stack_trace:
                frame_match = re.search(r"at ([\w.]+)\(([\w.]+):(\d+)\)", stack_trace)
                if frame_match:
                    function_name = frame_match.group(1)
                    file_path = frame_match.group(2)
                    line_number = int(frame_match.group(3))

            errors.append(
                ParsedError(
                    error_type=error_type,
                    error_message=message,
                    timestamp=timestamp,
                    stack_trace=stack_trace,
                    file_path=file_path,
                    line_number=line_number,
                    function_name=function_name,
                )
            )

        return errors

    def _parse_http_errors(self, content: str) -> list[ParsedError]:
        """Parse HTTP 500 errors from web server logs."""
        errors = []

        for match in self.HTTP_500_PATTERN.finditer(content):
            ip = match.group("ip")
            timestamp_str = match.group("timestamp")
            method = match.group("method")
            url = match.group("url")

            # Parse Apache/Nginx timestamp format
            timestamp = self._parse_http_timestamp(timestamp_str)

            errors.append(
                ParsedError(
                    error_type="HTTP500Error",
                    error_message=f"Internal Server Error on {method} {url}",
                    timestamp=timestamp,
                    request_url=url,
                    request_method=method,
                    ip_address=ip,
                )
            )

        return errors

    def _parse_apache_errors(self, content: str) -> list[ParsedError]:
        """Parse Apache error logs (including ModSecurity entries)."""
        errors: list[ParsedError] = []

        for match in self.APACHE_ERROR_PATTERN.finditer(content):
            timestamp_str = match.group("timestamp")
            ip = match.group("ip")
            message = match.group("message")

            timestamp = self._parse_apache_timestamp(timestamp_str)

            if "ModSecurity:" in message:
                msg_match = re.search(r'\[msg "([^"]+)"\]', message)
                uri_match = re.search(r'\[uri "([^"]+)"\]', message)
                rule_id_match = re.search(r'\[id "([^"]+)"\]', message)
                severity_match = re.search(r'\[severity "([^"]+)"\]', message)

                error_message = msg_match.group(1) if msg_match else message
                request_url = uri_match.group(1) if uri_match else None

                errors.append(
                    ParsedError(
                        error_type="ModSecurity",
                        error_message=error_message,
                        timestamp=timestamp,
                        request_url=request_url,
                        ip_address=ip,
                        context={
                            "rule_id": rule_id_match.group(1) if rule_id_match else None,
                            "severity": severity_match.group(1) if severity_match else None,
                        },
                    )
                )
                continue

            denied_match = re.search(r"client denied by server configuration: (.*)$", message)
            error_message = denied_match.group(1) if denied_match else message

            errors.append(
                ParsedError(
                    error_type="ApacheError",
                    error_message=error_message,
                    timestamp=timestamp,
                    ip_address=ip,
                )
            )

        return errors

    def _parse_timestamp(self, timestamp_str: str) -> datetime:
        """Parse ISO-format timestamp."""
        # Remove timezone for simplicity, assume UTC
        timestamp_str = re.sub(r"[+-]\d{2}:\d{2}$", "", timestamp_str)
        timestamp_str = timestamp_str.replace("Z", "")

        # Try different formats
        formats = [
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(timestamp_str, fmt)
            except ValueError:
                continue

        # Default to now if parsing fails
        return datetime.utcnow()

    def _parse_http_timestamp(self, timestamp_str: str) -> datetime:
        """Parse HTTP log timestamp format (e.g., 22/Jan/2026:10:30:45 +0000)."""
        # Remove timezone
        timestamp_str = re.sub(r" [+-]\d{4}$", "", timestamp_str)

        try:
            return datetime.strptime(timestamp_str, "%d/%b/%Y:%H:%M:%S")
        except ValueError:
            return datetime.utcnow()

    def _parse_apache_timestamp(self, timestamp_str: str) -> datetime:
        """Parse Apache error log timestamp format (e.g., Mon Jan 19 01:07:36 2026)."""
        try:
            return datetime.strptime(timestamp_str, "%a %b %d %H:%M:%S %Y")
        except ValueError:
            return datetime.utcnow()
