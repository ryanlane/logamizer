export type Site = {
  id: string;
  name: string;
  domain: string | null;
  log_format: string;
};

export type Aggregate = {
  id: string;
  hour_bucket: string;
  requests_count: number;
  status_5xx: number;
  status_4xx: number;
  status_3xx: number;
  status_2xx: number;
  unique_ips: number;
  total_bytes: number;
  top_paths: { path: string; count: number }[] | null;
  top_ips?: { ip: string; count: number }[] | null;
  top_user_agents?: { user_agent?: string | null; count: number }[] | null;
  top_status_codes?: { status?: number | null; count: number }[] | null;
};

export type DashboardResponse = {
  summary: {
    total_requests: number;
    total_bytes: number;
    unique_ips: number;
    unique_paths: number;
    status_2xx: number;
    status_3xx: number;
    status_4xx: number;
    status_5xx: number;
    first_seen: string | null;
    last_seen: string | null;
    top_paths: { path: string; count: number }[];
    top_ips: { ip: string; count: number }[];
  };
  hourly_data: Aggregate[];
  recent_uploads: { id: string; filename: string; status: string; created_at: string | null }[];
};

export type LogFile = {
  id: string;
  site_id: string;
  filename: string;
  size_bytes: number | null;
  hash_sha256: string | null;
  storage_key: string;
  status: string;
  created_at: string;
  uploaded_at: string | null;
};

export type LogFileListResponse = {
  log_files: LogFile[];
  total: number;
};

export type LogSource = {
  id: string;
  site_id: string;
  name: string;
  source_type: string;
  status: string;
  connection_config: Record<string, unknown>;
  schedule_type: string;
  schedule_config: Record<string, unknown>;
  last_fetch_at: string | null;
  last_fetch_status: string | null;
  last_fetch_error: string | null;
  last_fetched_bytes: number | null;
  created_at: string;
  updated_at: string;
};

export type LogSourceListResponse = {
  log_sources: LogSource[];
  total: number;
};

export type Finding = {
  id: string;
  finding_type: string;
  severity: string;
  title: string;
  description: string;
  evidence: { line?: number; raw?: string }[] | null;
  created_at: string;
};

export type VerificationProbe = {
  url: string;
  status_code?: number | null;
  headers?: Record<string, string>;
  error?: string;
};

export type VerifyFindingResponse = {
  verified: boolean;
  details: string;
  probes?: VerificationProbe[];
};

export type Job = {
  id: string;
  log_file_id: string;
  job_type: string;
  status: string;
  progress: number;
  result_summary: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type ErrorOccurrence = {
  id: string;
  error_group_id: string;
  log_file_id: string | null;
  timestamp: string;
  error_type: string;
  error_message: string;
  stack_trace: string | null;
  file_path: string | null;
  line_number: number | null;
  function_name: string | null;
  request_url: string | null;
  request_method: string | null;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
};

export type ErrorGroup = {
  id: string;
  site_id: string;
  fingerprint: string;
  error_type: string;
  error_message: string;
  first_seen: string;
  last_seen: string;
  occurrence_count: number;
  status: string;
  resolved_at: string | null;
  deployment_id: string | null;
  metadata_json: Record<string, unknown> | null;
  sample_request_url?: string | null;
  sample_ip_address?: string | null;
  sample_request_urls?: string[] | null;
};

export type ErrorGroupWithOccurrences = ErrorGroup & {
  recent_occurrences: ErrorOccurrence[];
};

export type ErrorGroupsListResponse = {
  error_groups: ErrorGroup[];
  total: number;
  unresolved: number;
  resolved: number;
  ignored: number;
};

export type ErrorStatsResponse = {
  total_errors: number;
  total_groups: number;
  errors_24h: number;
  errors_7d: number;
  top_error_types: { error_type: string; count: number }[];
  error_trend: { hour: string; count: number }[];
};

export type ErrorGroupExplainResponse = {
  explanation: string;
};
