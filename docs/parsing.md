# Parsing Contract

## Supported formats

Logamizer currently supports:

- Nginx combined ("nginx_combined")
- Apache combined ("apache_combined")

If you need additional formats (JSON, custom, etc.), add a parser in apps/worker/parsers and wire it into the worker.

## Expected fields

Both supported parsers extract the following fields where available:

- timestamp (UTC)
- ip
- method
- path
- status
- bytes_sent
- referer (optional)
- user_agent (optional)
- user (optional)
- protocol (optional)

## Normalized event shape

Example normalized event:

{
  "timestamp": "2026-01-23T17:36:10+00:00",
  "ip": "203.0.113.42",
  "method": "GET",
  "path": "/api/health",
  "status": 200,
  "bytes_sent": 532,
  "referer": "https://example.com/",
  "user_agent": "Mozilla/5.0",
  "user": null,
  "protocol": "HTTP/1.1"
}

## Quality metrics

For each parsed log file the worker reports:

- total_lines: total lines read
- parsed_lines: lines successfully parsed
- failed_lines: lines that did not match the format
- empty_lines: empty or comment lines skipped
- success_rate: parsed_lines / total_lines * 100

## Notes

- Timestamps are converted to UTC.
- Empty lines and comment lines are ignored.
- If the request line is malformed, the raw request string is used as the path.
