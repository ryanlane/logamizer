"""Storage service for S3/MinIO operations."""

from functools import lru_cache

import boto3
from botocore.config import Config

from apps.api.config import get_settings
from packages.shared.constants import PRESIGNED_URL_EXPIRY

settings = get_settings()


@lru_cache
def get_s3_client():
    """Get cached S3 client."""
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4"),
    )


@lru_cache
def get_presign_client():
    """Get cached S3 client for presigned URLs (public endpoint)."""
    endpoint = settings.s3_public_endpoint_url or settings.s3_endpoint_url
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4"),
    )


class StorageService:
    """Service for S3/MinIO storage operations."""

    def __init__(self):
        self.client = get_s3_client()
        self.presign_client = get_presign_client()
        self.bucket = settings.s3_bucket_name

    def ensure_bucket_exists(self) -> None:
        """Create the bucket if it doesn't exist."""
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except self.client.exceptions.ClientError:
            self.client.create_bucket(Bucket=self.bucket)

    def generate_presigned_upload_url(
        self,
        key: str,
        content_type: str = "text/plain",
        expires_in: int = PRESIGNED_URL_EXPIRY,
    ) -> str:
        """Generate a presigned URL for uploading a file."""
        return self.presign_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )

    def generate_presigned_download_url(
        self,
        key: str,
        expires_in: int = PRESIGNED_URL_EXPIRY,
    ) -> str:
        """Generate a presigned URL for downloading a file."""
        return self.presign_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
            },
            ExpiresIn=expires_in,
        )

    def get_object(self, key: str) -> bytes:
        """Get an object's contents."""
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"].read()

    def get_object_stream(self, key: str):
        """Get a streaming body for an object."""
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"]

    def delete_object(self, key: str) -> None:
        """Delete an object."""
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def object_exists(self, key: str) -> bool:
        """Check if an object exists."""
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except self.client.exceptions.ClientError:
            return False

    def get_object_size(self, key: str) -> int | None:
        """Get the size of an object in bytes."""
        try:
            response = self.client.head_object(Bucket=self.bucket, Key=key)
            return response.get("ContentLength")
        except self.client.exceptions.ClientError:
            return None
