/**
 * API client for the FastAPI backend.
 * Replaces all useServerFn/createServerFn calls and Supabase queries.
 */

import type {
  RequirementAnalysis,
  PageElements,
  AnalysisResults,
  AutomationFiles,
  ChatMessage,
} from "./testgen-types";

const API_BASE = "http://localhost:8000/api";

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.detail || message;
    } catch {
      // ignore parse failure
    }
    throw new ApiError(message, res.status);
  }

  return res.json();
}

// ── Step 1: Analyze requirements ──

export async function analyzeRequirements(
  requirementText: string,
): Promise<RequirementAnalysis> {
  return request<RequirementAnalysis>("/analyze-requirements", {
    method: "POST",
    body: JSON.stringify({ requirementText }),
  });
}

// ── Step 2: Fetch URL elements ──

export async function fetchUrlElements(url: string): Promise<PageElements> {
  return request<PageElements>("/fetch-url-elements", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

// ── Step 3: Generate tests ──

export async function generateTests(data: {
  requirementText: string;
  url: string | null;
  requirementAnalysis: RequirementAnalysis;
  pageElements: PageElements | null;
}): Promise<{ analysisId: string; results: AnalysisResults }> {
  return request("/generate-tests", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Step 4: Generate automation project ──

export async function generateAutomation(
  analysisId: string,
  framework: string = "selenium_java",
): Promise<AutomationFiles> {
  return request<AutomationFiles>("/generate-automation", {
    method: "POST",
    body: JSON.stringify({ analysisId, framework }),
  });
}

export async function updateAnalysis(
  analysisId: string,
  title?: string,
  results_json?: AnalysisResults,
): Promise<{ ok: boolean }> {
  return request(`/analyses/${analysisId}`, {
    method: "PUT",
    body: JSON.stringify({ title, results_json }),
  });
}

// ── Step 5: QA Copilot chat ──

export async function chat(data: {
  analysisId: string;
  question: string;
  history: ChatMessage[];
}): Promise<{ reply: string }> {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── History / CRUD ──

export interface AnalysisListItem {
  id: string;
  title: string | null;
  url: string | null;
  created_at: string;
  results_json: AnalysisResults | null;
}

export interface AnalysisDetail {
  id: string;
  title: string | null;
  requirement_text: string;
  url: string | null;
  results_json: AnalysisResults | null;
  automation_json: AutomationFiles | null;
  status: string;
  created_at: string;
}

export async function getRecentAnalyses(
  limit: number = 5,
): Promise<AnalysisListItem[]> {
  return request(`/analyses?limit=${limit}`);
}

export async function getAllAnalyses(): Promise<AnalysisListItem[]> {
  return request("/analyses?limit=100");
}

export async function getAnalysis(id: string): Promise<AnalysisDetail> {
  return request(`/analyses/${id}`);
}

export async function deleteAnalysis(
  id: string,
): Promise<{ ok: boolean }> {
  return request(`/analyses/${id}`, { method: "DELETE" });
}
