import { useQuery } from "@tanstack/react-query";
import { apiFetch, getStoredToken } from "./client";
import type {
  DashboardResponse,
  ErrorGroup,
  ErrorGroupWithOccurrences,
  ErrorGroupsListResponse,
  ErrorGroupExplainResponse,
  ErrorStatsResponse,
  Finding,
  LogFileListResponse,
  LogSource,
  LogSourceListResponse,
  Site,
  VerifyFindingResponse,
} from "../types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Job } from "../types";

export function useSites() {
  const token = getStoredToken();
  return useQuery({
    queryKey: ["sites"],
    queryFn: () => apiFetch<{ sites: Site[] }>("/api/sites"),
    enabled: Boolean(token),
  });
}

export function useDashboard(siteId?: string, startDate?: string | null, endDate?: string | null) {
  const token = getStoredToken();
  return useQuery({
    queryKey: ["dashboard", siteId, startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      const queryString = params.toString();
      return apiFetch<DashboardResponse>(
        `/api/sites/${siteId}/dashboard${queryString ? `?${queryString}` : ""}`
      );
    },
    enabled: Boolean(siteId && token),
  });
}

export function useFindings(
  siteId?: string,
  startDate?: string | null,
  endDate?: string | null,
  severity?: string | null
) {
  const token = getStoredToken();
  return useQuery({
    queryKey: ["findings", siteId, startDate, endDate, severity],
    queryFn: () => {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (severity) params.append("severity", severity);
      const queryString = params.toString();
      return apiFetch<{ findings: Finding[] }>(
        `/api/sites/${siteId}/findings${queryString ? `?${queryString}` : ""}`
      );
    },
    enabled: Boolean(siteId && token),
  });
}


export function useJob(jobId?: string) {
  const token = getStoredToken();
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: () => apiFetch<Job>(`/api/jobs/${jobId}`),
    enabled: Boolean(jobId && token),
    refetchInterval: (query) => {
      const job = query.state.data;
      if (job && (job.status === "completed" || job.status === "failed")) {
        return false;
      }
      return 2000;
    },
  });
}

type CreateSiteInput = {
  name: string;
  domain?: string;
  log_format: string;
};

export function useCreateSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSiteInput) =>
      apiFetch<Site>("/api/sites", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
    },
  });
}

type UpdateSiteInput = {
  name?: string;
  domain?: string;
  log_format?: string;
  anomaly_baseline_days?: number;
  anomaly_min_baseline_hours?: number;
  anomaly_z_threshold?: number;
  anomaly_new_path_min_count?: number;
  filtered_ips?: string[];
};

export function useUpdateSite(siteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateSiteInput) =>
      apiFetch<Site>(`/api/sites/${siteId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", siteId] });
    },
  });
}

type PublicIPResponse = {
  ip: string;
};

export function useGetPublicIP() {
  return useMutation({
    mutationFn: () => apiFetch<PublicIPResponse>("/api/public-ip"),
  });
}

type UploadUrlResponse = {
  upload_url: string;
  log_file_id: string;
  expires_in?: number;
};

export function useGetUploadUrl() {
  return useMutation({
    mutationFn: ({ siteId, filename }: { siteId: string; filename: string }) =>
      apiFetch<UploadUrlResponse>(`/api/sites/${siteId}/upload-url`, {
        method: "POST",
        body: JSON.stringify({ filename }),
      }),
  });
}

export function useConfirmUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      siteId,
      logFileId,
      sizeBytes,
    }: {
      siteId: string;
      logFileId: string;
      sizeBytes: number;
    }) =>
      apiFetch<Job>(`/api/sites/${siteId}/uploads`, {
        method: "POST",
        body: JSON.stringify({ log_file_id: logFileId, size_bytes: sizeBytes }),
      }),
    onSuccess: (_, variables) =>
      queryClient.invalidateQueries({ queryKey: ["dashboard", variables.siteId] }),
  });
}

function normalizeUploadUrl(url: string): string {
  const publicEndpoint = import.meta.env.VITE_S3_PUBLIC_ENDPOINT_URL as string | undefined;
  if (publicEndpoint) {
    try {
      const target = new URL(publicEndpoint);
      const original = new URL(url);
      original.protocol = target.protocol;
      original.host = target.host;
      return original.toString();
    } catch {
      return url;
    }
  }

  if (
    url.startsWith("http://minio:9000") &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    return url.replace("http://minio:9000", "http://localhost:9000");
  }

  return url;
}

export async function uploadFileToS3(url: string, file: File): Promise<void> {
  const uploadUrl = normalizeUploadUrl(url);
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": "text/plain",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to upload file to storage");
  }
}

type ExplainResponse = {
  response: string;
  context: string;
  log_file_id: string | null;
};

export function useExplain() {
  return useMutation({
    mutationFn: ({
      siteId,
      prompt,
      context,
    }: {
      siteId: string;
      prompt: string;
      context: "findings" | "anomalies" | "overview";
    }) =>
      apiFetch<ExplainResponse>(`/api/sites/${siteId}/explain`, {
        method: "POST",
        body: JSON.stringify({ prompt, context }),
      }),
  });
}



export function useExplainFinding() {
  return useMutation({
    mutationFn: ({ findingId }: { findingId: string }) =>
      apiFetch<{ explanation: string }>(`/api/findings/${findingId}/explain`, {
        method: "POST",
      }),
  });
}

export function useVerifyFinding() {
  return useMutation({
    mutationFn: ({ findingId }: { findingId: string }) =>
      apiFetch<VerifyFindingResponse>(`/api/findings/${findingId}/verify`, {
        method: "POST",
      }),
  });
}

export function useErrorGroups(
  siteId?: string,
  status?: string | null,
  errorType?: string | null,
  limit = 50,
  offset = 0
) {
  const token = getStoredToken();
  return useQuery({
    queryKey: ["error-groups", siteId, status, errorType, limit, offset],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (errorType) params.append("error_type", errorType);
      if (limit) params.append("limit", String(limit));
      if (offset) params.append("offset", String(offset));
      const queryString = params.toString();
      return apiFetch<ErrorGroupsListResponse>(
        `/api/sites/${siteId}/errors/groups${queryString ? `?${queryString}` : ""}`
      );
    },
    enabled: Boolean(siteId && token),
  });
}

export function useErrorGroup(siteId?: string, groupId?: string, limit = 10) {
  const token = getStoredToken();
  return useQuery({
    queryKey: ["error-group", siteId, groupId, limit],
    queryFn: () =>
      apiFetch<ErrorGroupWithOccurrences>(
        `/api/sites/${siteId}/errors/groups/${groupId}?limit=${limit}`
      ),
    enabled: Boolean(siteId && groupId && token),
  });
}

export function useErrorStats(siteId?: string) {
  const token = getStoredToken();
  return useQuery({
    queryKey: ["error-stats", siteId],
    queryFn: () => apiFetch<ErrorStatsResponse>(`/api/sites/${siteId}/errors/stats`),
    enabled: Boolean(siteId && token),
  });
}

export function useUpdateErrorGroup(siteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      status,
      deploymentId,
    }: {
      groupId: string;
      status: string;
      deploymentId?: string | null;
    }) =>
      apiFetch<ErrorGroup>(`/api/sites/${siteId}/errors/groups/${groupId}`, {
        method: "PUT",
        body: JSON.stringify({ status, deployment_id: deploymentId ?? null }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["error-groups", siteId] });
      queryClient.invalidateQueries({ queryKey: ["error-stats", siteId] });
      queryClient.invalidateQueries({
        queryKey: ["error-group", siteId, variables.groupId],
      });
    },
  });
}

export function useExplainErrorGroup(siteId: string) {
  return useMutation({
    mutationFn: ({ groupId }: { groupId: string }) =>
      apiFetch<ErrorGroupExplainResponse>(
        `/api/sites/${siteId}/errors/groups/${groupId}/explain`,
        { method: "POST" }
      ),
  });
}

export function useLogFiles(siteId?: string) {
  const token = getStoredToken();
  return useQuery({
    queryKey: ["log-files", siteId],
    queryFn: () => apiFetch<LogFileListResponse>(`/api/sites/${siteId}/log-files`),
    enabled: Boolean(siteId && token),
  });
}

export function useAnalyzeErrors(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      logFileId,
      logFormat,
    }: {
      logFileId: string;
      logFormat?: string;
    }) =>
      apiFetch<{ success: boolean; message: string; task_id?: string }>(
        `/api/sites/${siteId}/errors/analyze`,
        {
          method: "POST",
          body: JSON.stringify({
            log_file_id: logFileId,
            log_format: logFormat ?? "auto",
          }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["error-groups", siteId] });
      queryClient.invalidateQueries({ queryKey: ["error-stats", siteId] });
    },
  });
}

export function useLogSources(siteId?: string) {
  const token = getStoredToken();
  return useQuery({
    queryKey: ["log-sources", siteId],
    queryFn: () => apiFetch<LogSourceListResponse>(`/api/sites/${siteId}/log-sources`),
    enabled: Boolean(siteId && token),
  });
}

type LogSourceInput = {
  name: string;
  source_type: string;
  connection_config: Record<string, unknown>;
  schedule_type: string;
  schedule_config: Record<string, unknown>;
};

export function useCreateLogSource(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LogSourceInput) =>
      apiFetch<LogSource>(`/api/sites/${siteId}/log-sources`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-sources", siteId] });
    },
  });
}

type LogSourceUpdateInput = Partial<LogSourceInput> & {
  status?: string;
};

export function useUpdateLogSource(siteId: string, logSourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LogSourceUpdateInput) =>
      apiFetch<LogSource>(`/api/sites/${siteId}/log-sources/${logSourceId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-sources", siteId] });
    },
  });
}

export function useDeleteLogSource(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (logSourceId: string) =>
      apiFetch<void>(`/api/sites/${siteId}/log-sources/${logSourceId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-sources", siteId] });
    },
  });
}

export function useFetchNow(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ logSourceId }: { logSourceId: string }) =>
      apiFetch<{ message: string; log_source_id: string; task_id: string }>(
        `/api/sites/${siteId}/log-sources/${logSourceId}/fetch-now`,
        {
          method: "POST",
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-sources", siteId] });
    },
  });
}
