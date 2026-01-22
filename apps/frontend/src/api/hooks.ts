import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, getStoredToken } from "./client";
import type { DashboardResponse, Finding, Job, Site } from "../types";

export function useSites() {
  const token = getStoredToken();
  return useQuery({
    queryKey: ["sites"],
    queryFn: () => apiFetch<{ sites: Site[] }>("/api/sites"),
    enabled: Boolean(token),
  });
}

export function useDashboard(siteId?: string) {
  const token = getStoredToken();
  return useQuery({
    queryKey: ["dashboard", siteId],
    queryFn: () => apiFetch<DashboardResponse>(`/api/sites/${siteId}/dashboard`),
    enabled: Boolean(siteId && token),
  });
}

export function useFindings(siteId?: string) {
  const token = getStoredToken();
  return useQuery({
    queryKey: ["findings", siteId],
    queryFn: () => apiFetch<{ findings: Finding[] }>(`/api/sites/${siteId}/findings`),
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
  storage_key: string;
  log_file_id: string;
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

type ConfirmUploadResponse = {
  log_file: { id: string; filename: string; status: string };
  job: Job;
};

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
      apiFetch<ConfirmUploadResponse>(`/api/sites/${siteId}/uploads`, {
        method: "POST",
        body: JSON.stringify({ log_file_id: logFileId, size_bytes: sizeBytes }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", variables.siteId] });
      queryClient.invalidateQueries({ queryKey: ["findings", variables.siteId] });
    },
  });
}

export async function uploadFileToS3(url: string, file: File): Promise<void> {
  const response = await fetch(url, {
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
