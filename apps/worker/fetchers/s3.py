"""S3-compatible storage log fetcher."""

import gzip
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from apps.worker.fetchers.base import LogFetcher


class S3LogFetcher(LogFetcher):
    """Fetch logs from S3-compatible storage."""

    def __init__(self, config: dict):
        """Initialize S3 fetcher.

        Config format:
        {
            "bucket": "my-logs",
            "prefix": "nginx/",  # optional
            "access_key_id": "ACCESS_KEY",
            "secret_access_key": "SECRET_KEY",
            "region": "us-east-1",
            "endpoint_url": "https://s3.amazonaws.com",  # optional for S3-compatible
            "hours_ago": 24  # optional, only fetch files from last N hours
        }
        """
        super().__init__(config)
        self.s3_client = None

    def _get_client(self):
        """Get or create S3 client."""
        if self.s3_client:
            return self.s3_client

        client_kwargs = {
            "aws_access_key_id": self.config["access_key_id"],
            "aws_secret_access_key": self.config["secret_access_key"],
            "region_name": self.config.get("region", "us-east-1"),
        }

        if "endpoint_url" in self.config:
            client_kwargs["endpoint_url"] = self.config["endpoint_url"]

        self.s3_client = boto3.client("s3", **client_kwargs)
        return self.s3_client

    async def test_connection(self) -> tuple[bool, str]:
        """Test S3 connection and bucket access."""
        try:
            client = self._get_client()
            bucket = self.config["bucket"]

            # Try to list objects (limit to 1 for speed)
            client.list_objects_v2(Bucket=bucket, MaxKeys=1)

            return True, f"Successfully connected to bucket '{bucket}'"

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            if error_code == "NoSuchBucket":
                return False, f"Bucket '{self.config['bucket']}' does not exist"
            elif error_code == "InvalidAccessKeyId":
                return False, "Invalid access key ID"
            elif error_code == "SignatureDoesNotMatch":
                return False, "Invalid secret access key"
            else:
                return False, f"S3 error: {str(e)}"

        except BotoCoreError as e:
            return False, f"Connection error: {str(e)}"

        except Exception as e:
            return False, f"Unexpected error: {str(e)}"

    async def fetch_logs(self) -> list[tuple[str, BytesIO, int]]:
        """Fetch log files from S3.

        Returns:
            List of (filename, file_content, size_bytes)
        """
        client = self._get_client()
        bucket = self.config["bucket"]
        prefix = self.config.get("prefix", "")
        hours_ago = self.config.get("hours_ago")

        # Calculate cutoff time if hours_ago is specified
        cutoff_time = None
        if hours_ago:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours_ago)

        # List objects with prefix
        paginator = client.get_paginator("list_objects_v2")
        page_iterator = paginator.paginate(Bucket=bucket, Prefix=prefix)

        results = []
        for page in page_iterator:
            if "Contents" not in page:
                continue

            for obj in page["Contents"]:
                key = obj["Key"]
                last_modified = obj["LastModified"]
                size = obj["Size"]

                # Skip if file is too old
                if cutoff_time and last_modified < cutoff_time.replace(tzinfo=last_modified.tzinfo):
                    continue

                # Skip directories (keys ending with /)
                if key.endswith("/"):
                    continue

                try:
                    # Download file
                    response = client.get_object(Bucket=bucket, Key=key)
                    content = response["Body"].read()

                    # Handle gzipped files
                    filename = Path(key).name
                    if filename.endswith(".gz"):
                        try:
                            content = gzip.decompress(content)
                            filename = filename[:-3]  # Remove .gz extension
                        except gzip.BadGzipFile:
                            pass  # Keep original content if not valid gzip

                    file_obj = BytesIO(content)
                    results.append((filename, file_obj, len(content)))

                except ClientError as e:
                    # Skip files that can't be read
                    print(f"Failed to fetch {key}: {e}")
                    continue

        return results

    async def cleanup(self) -> None:
        """Cleanup S3 client resources."""
        if self.s3_client:
            # boto3 clients don't need explicit cleanup
            self.s3_client = None
