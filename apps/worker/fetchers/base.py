"""Base log fetcher interface."""

from abc import ABC, abstractmethod
from io import BytesIO


class LogFetcher(ABC):
    """Base class for log fetchers."""

    def __init__(self, config: dict):
        """Initialize fetcher with connection config."""
        self.config = config

    @abstractmethod
    async def test_connection(self) -> tuple[bool, str]:
        """Test connection to the log source.

        Returns:
            Tuple of (success, message)
        """
        pass

    @abstractmethod
    async def fetch_logs(self) -> list[tuple[str, BytesIO, int]]:
        """Fetch log files from the source.

        Returns:
            List of tuples: (filename, file_content, size_bytes)
        """
        pass

    @abstractmethod
    async def cleanup(self) -> None:
        """Cleanup resources (close connections, etc.)."""
        pass
