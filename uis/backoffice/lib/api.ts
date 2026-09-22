import type { IncidentAnalysisResult } from "@/types/incidents";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

export async function analyzeIncidentsCsv(file: File): Promise<IncidentAnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(apiUrl("/api/incidents/analyze"), {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    let message = `Analysis failed with HTTP ${response.status}.`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") message = body.detail;
      else if (typeof body?.message === "string") message = body.message;
    } catch {}
    throw new Error(message);
  }

  return response.json() as Promise<IncidentAnalysisResult>;
}

export async function downloadLatestResults(): Promise<void> {
  const response = await fetch(apiUrl("/api/incidents/results/export"));
  if (!response.ok) throw new Error(`Export failed with HTTP ${response.status}.`);

  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = "results.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(downloadUrl);
}
