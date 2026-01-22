"""Log fetchers for scheduled fetching."""

from apps.worker.fetchers.base import LogFetcher
from apps.worker.fetchers.ssh import SSHLogFetcher
from apps.worker.fetchers.s3 import S3LogFetcher

__all__ = ["LogFetcher", "SSHLogFetcher", "S3LogFetcher"]
