import { AuthSessionError, authenticatedFetch } from "@/lib/auth";
import type { IncidentAnalysisResult } from "@/types/incidents";

export class AnalysisApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AnalysisApiError";
    this.status = status;
  }
}

const analysisErrorMessage = (status: number): string => {
  if (status === 400) return "The CSV could not be analyzed. Check the file format and try again.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to analyze this file.";
  if (status >= 500) return "The analysis service is temporarily unavailable. Please try again.";
  return "The CSV could not be analyzed. Please try again.";
};

const exportErrorMessage = (status: number): string => {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to export this analysis.";
  if (status === 404) return "No analysis is available yet. Analyze a CSV file first.";
  if (status >= 500) return "The export service is temporarily unavailable. Please try again.";
  return "The latest analysis could not be exported. Please try again.";
};

const safeFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  try {
    return await authenticatedFetch(path, init);
  } catch (error) {
    if (error instanceof AuthSessionError) {
      throw new AnalysisApiError(
        "Your session has expired. Please sign in again.",
        error.status,
      );
    }

    throw new AnalysisApiError(
      "We could not reach the incident service. Check your connection and try again.",
      0,
    );
  }
};

export async function analyzeIncidentsCsv(file: File): Promise<IncidentAnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await safeFetch("/api/incidents/analyze", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new AnalysisApiError(
      analysisErrorMessage(response.status),
      response.status,
    );
  }

  try {
    return (await response.json()) as IncidentAnalysisResult;
  } catch {
    throw new AnalysisApiError(
      "The analysis service returned an invalid response. Please try again.",
      response.status,
    );
  }
}

export async function downloadLatestResults(): Promise<void> {
  const response = await safeFetch("/api/incidents/results/export");

  if (!response.ok) {
    throw new AnalysisApiError(
      exportErrorMessage(response.status),
      response.status,
    );
  }

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch {
    throw new AnalysisApiError(
      "The exported file could not be read. Please try again.",
      response.status,
    );
  }

  const downloadUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "results.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(downloadUrl);
  }
}
