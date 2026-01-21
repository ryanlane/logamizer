"""Constants for Logamizer."""

from packages.shared.enums import LogFormat

# Log format regex patterns
LOG_FORMATS = {
    LogFormat.NGINX_COMBINED: {
        "name": "Nginx Combined",
        "description": "Standard Nginx combined log format",
        "pattern": (
            r'^(?P<ip>\S+)\s+'           # Remote address
            r'\S+\s+'                     # Remote ident (usually -)
            r'(?P<user>\S+)\s+'           # Remote user
            r'\[(?P<time>[^\]]+)\]\s+'    # Time
            r'"(?P<method>\S+)\s+'        # Request method
            r'(?P<path>\S+)\s+'           # Request path
            r'\S+"\s+'                    # Protocol
            r'(?P<status>\d+)\s+'         # Status code
            r'(?P<bytes>\d+|-)\s+'        # Bytes sent
            r'"(?P<referer>[^"]*)"\s+'    # Referer
            r'"(?P<ua>[^"]*)"'            # User agent
        ),
        "time_format": "%d/%b/%Y:%H:%M:%S %z",
    },
    LogFormat.APACHE_COMBINED: {
        "name": "Apache Combined",
        "description": "Standard Apache combined log format",
        "pattern": (
            r'^(?P<ip>\S+)\s+'           # Remote host
            r'\S+\s+'                     # Remote logname (usually -)
            r'(?P<user>\S+)\s+'           # Remote user
            r'\[(?P<time>[^\]]+)\]\s+'    # Time
            r'"(?P<method>\S+)\s+'        # Request method
            r'(?P<path>\S+)\s+'           # Request path
            r'\S+"\s+'                    # Protocol
            r'(?P<status>\d+)\s+'         # Status code
            r'(?P<bytes>\d+|-)\s*'        # Bytes sent
            r'(?:"(?P<referer>[^"]*)"\s*)?'  # Referer (optional)
            r'(?:"(?P<ua>[^"]*)")?'       # User agent (optional)
        ),
        "time_format": "%d/%b/%Y:%H:%M:%S %z",
    },
}

# Presigned URL expiration (seconds)
PRESIGNED_URL_EXPIRY = 3600  # 1 hour

# Maximum file size for uploads (bytes)
MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500 MB

# Parse quality thresholds
MIN_PARSE_SUCCESS_RATE = 0.8  # 80% minimum success rate for valid file

# Aggregation settings
AGGREGATE_BUCKET_HOURS = 1
TOP_N_ITEMS = 10  # Top paths, IPs, etc.

# Evidence sampling
MAX_EVIDENCE_SAMPLES = 10
MAX_FAILED_LINE_SAMPLES = 10
