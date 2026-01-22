"""Pytest configuration and fixtures."""

import pytest


@pytest.fixture
def sample_nginx_log_line():
    """Sample Nginx combined log line."""
    return (
        '192.168.1.1 - - [21/Jan/2026:10:30:00 +0000] '
        '"GET /api/users HTTP/1.1" 200 1234 '
        '"https://example.com" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"'
    )


@pytest.fixture
def sample_apache_log_line():
    """Sample Apache combined log line."""
    return (
        '192.168.1.1 - frank [21/Jan/2026:10:30:00 +0000] '
        '"GET /index.html HTTP/1.1" 200 2326 '
        '"http://www.example.com/" "Mozilla/5.0"'
    )
