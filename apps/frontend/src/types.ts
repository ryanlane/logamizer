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
