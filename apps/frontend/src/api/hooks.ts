import { useQuery } from "@tanstack/react-query";
import { apiFetch, getStoredToken } from "./client";
import type { DashboardResponse, Finding, Site, VerifyFindingResponse, LogSource, LogSourceCreate, LogSourceUpdate } from "../types";
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

// Log Sources
export function useLogSources(siteId: string) {
  return useQuery({
    queryKey: ["log-sources", siteId],
    queryFn: () =>
      apiFetch<{ log_sources: LogSource[]; total: number }>(
        `/api/sites/${siteId}/log-sources`
      ),
    enabled: !!siteId,
  });
}

export function useCreateLogSource(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LogSourceCreate) =>
      apiFetch<LogSource>(`/api/sites/${siteId}/log-sources`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-sources", siteId] });
    },
  });
}

export function useUpdateLogSource(siteId: string, logSourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LogSourceUpdate) =>
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
      apiFetch(`/api/sites/${siteId}/log-sources/${logSourceId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-sources", siteId] });
    },
  });
}

export function useTestLogSource(siteId: string, logSourceId: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ message: string; task_id: string }>(
        `/api/sites/${siteId}/log-sources/${logSourceId}/test`,
        {
          method: "POST",
        }
      ),
  });
}

export function useFetchNow(siteId: string, logSourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
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
