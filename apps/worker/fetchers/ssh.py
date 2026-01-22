"""SSH/SFTP log fetcher."""

import asyncio
import fnmatch
import gzip
from io import BytesIO
from pathlib import Path

import asyncssh

from apps.worker.fetchers.base import LogFetcher


class SSHLogFetcher(LogFetcher):
    """Fetch logs via SSH/SFTP."""

    def __init__(self, config: dict):
        """Initialize SSH fetcher.

        Config format:
        {
            "host": "example.com",
            "port": 22,
            "username": "user",
            "password": "password",  # optional
            "private_key": "-----BEGIN RSA PRIVATE KEY-----...",  # optional
            "remote_path": "/var/log/nginx/access.log",
            "pattern": "*.log"  # optional glob pattern
        }
        """
        super().__init__(config)
        self.conn = None

    async def _connect(self) -> asyncssh.SSHClientConnection:
        """Establish SSH connection."""
        if self.conn and not self.conn.is_closed():
            return self.conn

        connect_kwargs = {
            "host": self.config["host"],
            "port": self.config.get("port", 22),
            "username": self.config["username"],
            "known_hosts": None,  # Skip host key verification (use with caution)
        }

        # Use either password or private key authentication
        if "password" in self.config and self.config["password"]:
            connect_kwargs["password"] = self.config["password"]
        elif "private_key" in self.config and self.config["private_key"]:
            connect_kwargs["client_keys"] = [asyncssh.import_private_key(self.config["private_key"])]

        self.conn = await asyncssh.connect(**connect_kwargs)
        return self.conn

    async def test_connection(self) -> tuple[bool, str]:
        """Test SSH connection and check if remote path exists."""
        try:
            conn = await self._connect()

            # Try to access the remote path
            remote_path = self.config["remote_path"]
            async with conn.start_sftp_client() as sftp:
                try:
                    # Check if path exists
                    await sftp.stat(remote_path)
                    return True, f"Successfully connected to {self.config['host']} and found {remote_path}"
                except asyncssh.SFTPNoSuchFile:
                    return False, f"Remote path not found: {remote_path}"

        except asyncssh.Error as e:
            return False, f"SSH connection failed: {str(e)}"
        except Exception as e:
            return False, f"Unexpected error: {str(e)}"

    async def fetch_logs(self) -> list[tuple[str, BytesIO, int]]:
        """Fetch log files via SFTP.

        Returns:
            List of (filename, file_content, size_bytes)
        """
        conn = await self._connect()
        remote_path = self.config["remote_path"]
        pattern = self.config.get("pattern", "*")

        files_to_fetch = []

        async with conn.start_sftp_client() as sftp:
            # Check if remote_path is a directory or file
            stat = await sftp.stat(remote_path)

            if stat.isdir():
                # List files in directory and filter by pattern
                entries = await sftp.listdir(remote_path)
                for entry in entries:
                    if fnmatch.fnmatch(entry, pattern):
                        file_path = f"{remote_path.rstrip('/')}/{entry}"
                        files_to_fetch.append(file_path)
            else:
                # Single file
                files_to_fetch.append(remote_path)

            # Fetch each file
            results = []
            for file_path in files_to_fetch:
                try:
                    file_stat = await sftp.stat(file_path)
                    file_size = file_stat.size

                    # Read file content
                    async with sftp.open(file_path, "rb") as remote_file:
                        content = await remote_file.read()

                    # Handle gzipped files
                    filename = Path(file_path).name
                    if filename.endswith(".gz"):
                        try:
                            content = gzip.decompress(content)
                            filename = filename[:-3]  # Remove .gz extension
                        except gzip.BadGzipFile:
                            pass  # Keep original content if not valid gzip

                    file_obj = BytesIO(content)
                    results.append((filename, file_obj, len(content)))

                except asyncssh.SFTPError as e:
                    # Skip files that can't be read
                    print(f"Failed to fetch {file_path}: {e}")
                    continue

            return results

    async def cleanup(self) -> None:
        """Close SSH connection."""
        if self.conn and not self.conn.is_closed():
            self.conn.close()
            await self.conn.wait_closed()
