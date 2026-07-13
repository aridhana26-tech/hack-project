import { parse } from "node-html-parser";
import type {
  AnalysisResults,
  AutomationFiles,
  PageElements,
  RequirementAnalysis,
  UiElement,
} from "./testgen-types";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.5-flash";

export class TestGenError extends Error {
  constructor(
    message: string,
    public code: string = "internal",
  ) {
    super(message);
  }
}

interface GatewayMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callGemini(
  messages: GatewayMessage[],
  opts: { temperature?: number; timeoutMs?: number } = {},
): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    throw new TestGenError("AI gateway is not configured (missing API key).", "config");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120_000);

  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: opts.temperature ?? 0.3,
      }),
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new TestGenError(
        "AI rate limit reached. Please wait a moment and try again.",
        "rate_limit",
      );
    }
    if (response.status === 402) {
      throw new TestGenError(
        "AI usage credits are exhausted. Please add credits in workspace settings.",
        "credits",
      );
    }
    if (!response.ok) {
      const body = await response.text();
      console.error(`AI gateway error [${response.status}]: ${body.slice(0, 500)}`);
      throw new TestGenError(`AI request failed (status ${response.status}).`, "ai_error");
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new TestGenError("AI returned an empty response. Please try again.", "ai_empty");
    }
    return content;
  } catch (err) {
    if (err instanceof TestGenError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new TestGenError("The AI request timed out. Try again with a shorter document.", "timeout");
    }
    console.error("AI gateway call failed:", err);
    throw new TestGenError("Could not reach the AI service. Please try again.", "network");
  } finally {
    clearTimeout(timeout);
  }
}

export function parseModelJson<T>(raw: string): T {
  let text = raw.trim();
  // Strip markdown fences
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    console.error("Model output had no JSON object:", text.slice(0, 300));
    throw new TestGenError("AI returned an unexpected format. Please try again.", "parse");
  }
  const candidate = text.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate) as T;
  } catch (err) {
    console.error("Failed to parse model JSON:", err, candidate.slice(0, 300));
    throw new TestGenError("AI returned malformed JSON. Please try again.", "parse");
  }
}

// ---------------- URL fetching + HTML parsing ----------------

function assertSafeUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new TestGenError("Invalid URL. Include the protocol, e.g. https://example.com", "bad_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TestGenError("Only http and https URLs are supported.", "bad_url");
  }
  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (blocked) {
    throw new TestGenError("This URL points to a private/internal address and cannot be analyzed.", "bad_url");
  }
  return url;
}

function buildLocator(attrs: {
  id?: string;
  name?: string;
  dataTestId?: string;
  ariaLabel?: string;
  tag: string;
  type?: string;
  text?: string;
}): { locator: string; strategy: string } {
  if (attrs.id) return { locator: `#${attrs.id}`, strategy: "id" };
  if (attrs.name) return { locator: `${attrs.tag}[name='${attrs.name}']`, strategy: "name" };
  if (attrs.dataTestId)
    return { locator: `[data-testid='${attrs.dataTestId}']`, strategy: "data-testid" };
  if (attrs.ariaLabel)
    return { locator: `${attrs.tag}[aria-label='${attrs.ariaLabel}']`, strategy: "aria-label" };
  if (attrs.type) return { locator: `${attrs.tag}[type='${attrs.type}']`, strategy: "css" };
  if (attrs.text)
    return {
      locator: `//${attrs.tag}[normalize-space()='${attrs.text.slice(0, 40).replace(/'/g, "")}']`,
      strategy: "xpath",
    };
  return { locator: attrs.tag, strategy: "css" };
}

export async function extractPageElements(rawUrl: string): Promise<PageElements> {
  const url = assertSafeUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let html: string;
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AITestGenPro/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      throw new TestGenError(
        `The URL responded with status ${res.status}. Check that the page is publicly accessible.`,
        "fetch_failed",
      );
    }
    html = await res.text();
  } catch (err) {
    if (err instanceof TestGenError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new TestGenError("Fetching the URL timed out after 15 seconds.", "timeout");
    }
    console.error("URL fetch failed:", err);
    throw new TestGenError(
      "Could not fetch the URL. Check that it is reachable and publicly accessible.",
      "fetch_failed",
    );
  } finally {
    clearTimeout(timeout);
  }

  try {
    const root = parse(html, { blockTextElements: { script: false, style: false } });
    const elements: UiElement[] = [];

    const pushEl = (kind: string, el: ReturnType<typeof parse>["childNodes"][number] & any) => {
      const tag = (el.rawTagName || "").toLowerCase();
      if (!tag) return;
      const id = el.getAttribute("id") || undefined;
      const name = el.getAttribute("name") || undefined;
      const type = el.getAttribute("type") || undefined;
      const placeholder = el.getAttribute("placeholder") || undefined;
      const ariaLabel = el.getAttribute("aria-label") || undefined;
      const dataTestId = el.getAttribute("data-testid") || el.getAttribute("data-test-id") || undefined;
      const href = el.getAttribute("href") || undefined;
      const text = (el.text || "").trim().replace(/\s+/g, " ").slice(0, 80) || undefined;
      const { locator, strategy } = buildLocator({ id, name, dataTestId, ariaLabel, tag, type, text });
      elements.push({
        kind,
        tag,
        id,
        name,
        type,
        text,
        placeholder,
        ariaLabel,
        dataTestId,
        href,
        locator,
        locatorStrategy: strategy,
      });
    };

    for (const el of root.querySelectorAll("input")) {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (type === "checkbox") pushEl("checkbox", el);
      else if (type === "radio") pushEl("radio", el);
      else if (type === "hidden") continue;
      else pushEl("input", el);
    }
    for (const el of root.querySelectorAll("textarea")) pushEl("input", el);
    for (const el of root.querySelectorAll("select")) {
      const tag = el as any;
      const options = el
        .querySelectorAll("option")
        .map((o) => (o.text || "").trim())
        .filter(Boolean)
        .slice(0, 20);
      const id = tag.getAttribute("id") || undefined;
      const name = tag.getAttribute("name") || undefined;
      const { locator, strategy } = buildLocator({ id, name, tag: "select" });
      elements.push({
        kind: "select",
        tag: "select",
        id,
        name,
        options,
        locator,
        locatorStrategy: strategy,
      });
    }
    for (const el of root.querySelectorAll("button, input[type='submit'], input[type='button'], [role='button']"))
      pushEl("button", el);
    for (const el of root.querySelectorAll("a[href]").slice(0, 60)) pushEl("link", el);

    const forms = root.querySelectorAll("form").map((f) => ({
      action: f.getAttribute("action") || undefined,
      method: (f.getAttribute("method") || "GET").toUpperCase(),
      fieldCount: f.querySelectorAll("input, select, textarea").length,
    }));

    const title = root.querySelector("title")?.text?.trim() || url.hostname;

    return {
      url: url.toString(),
      title,
      forms,
      elements: elements.slice(0, 250),
      fetchedAt: new Date().toISOString(),
      note:
        elements.length === 0
          ? "No interactive elements were found in the static HTML. The page may be JavaScript-rendered or behind a login."
          : undefined,
    };
  } catch (err) {
    if (err instanceof TestGenError) throw err;
    console.error("HTML parsing failed:", err);
    throw new TestGenError("Failed to parse the page HTML.", "parse_html");
  }
}

// ---------------- Prompts ----------------

export async function analyzeRequirements(requirementText: string): Promise<RequirementAnalysis> {
  const raw = await callGemini([
    {
      role: "system",
      content: `You are a senior QA business analyst. Extract structured requirement information from the document provided. Respond with ONLY a JSON object (no markdown) with this exact shape:
{
  "functionalRequirements": [{"id": "FR-001", "description": "...", "priority": "High|Medium|Low"}],
  "nonFunctionalRequirements": [{"id": "NFR-001", "description": "...", "priority": "..."}],
  "businessRules": ["..."],
  "validations": ["..."],
  "actors": ["..."],
  "inputs": ["..."],
  "outputs": ["..."],
  "errorConditions": ["..."],
  "acceptanceCriteria": ["..."]
}`,
    },
    { role: "user", content: `Requirement document:\n\n${requirementText.slice(0, 60_000)}` },
  ]);
  const parsed = parseModelJson<RequirementAnalysis>(raw);
  return {
    functionalRequirements: parsed.functionalRequirements ?? [],
    nonFunctionalRequirements: parsed.nonFunctionalRequirements ?? [],
    businessRules: parsed.businessRules ?? [],
    validations: parsed.validations ?? [],
    actors: parsed.actors ?? [],
    inputs: parsed.inputs ?? [],
    outputs: parsed.outputs ?? [],
    errorConditions: parsed.errorConditions ?? [],
    acceptanceCriteria: parsed.acceptanceCriteria ?? [],
  };
}

export async function generateTestArtifacts(
  analysis: RequirementAnalysis,
  page: PageElements | null,
): Promise<Omit<AnalysisResults, "requirementAnalysis" | "pageElements">> {
  const raw = await callGemini(
    [
      {
        role: "system",
        content: `You are a principal QA architect. Given a requirement analysis and extracted UI elements, map requirements to UI elements and produce a complete test design. Respond with ONLY a JSON object (no markdown) with this exact shape:
{
  "summary": "2-4 paragraph executive summary of the requirement coverage and testing approach",
  "testCases": [{"id": "TC-001", "title": "...", "category": "functional|positive|negative|boundary|edge|security|accessibility", "priority": "High|Medium|Low", "preconditions": "...", "steps": ["step 1", "step 2"], "testData": "...", "expectedResult": "...", "requirementIds": ["FR-001"], "uiElements": ["#loginBtn"]}],
  "rtm": [{"requirementId": "FR-001", "requirementSummary": "...", "testCaseIds": ["TC-001"], "uiElement": "#loginBtn", "priority": "High", "risk": "High|Medium|Low", "severity": "Critical|Major|Minor"}],
  "apiTests": ["..."],
  "dbValidations": ["..."],
  "performanceIdeas": ["..."]
}
Generate thorough coverage: functional, positive, negative, boundary, edge-case, security and accessibility test cases. Use the real locators from the UI elements when referencing uiElements. Keep total test cases between 15 and 40.`,
      },
      {
        role: "user",
        content: `REQUIREMENT ANALYSIS:\n${JSON.stringify(analysis)}\n\nEXTRACTED UI ELEMENTS:\n${
          page ? JSON.stringify({ title: page.title, url: page.url, forms: page.forms, elements: page.elements.slice(0, 120) }) : "No URL was provided or no elements were extracted."
        }`,
      },
    ],
    { timeoutMs: 150_000 },
  );
  const parsed = parseModelJson<Omit<AnalysisResults, "requirementAnalysis" | "pageElements">>(raw);
  return {
    summary: parsed.summary ?? "",
    testCases: parsed.testCases ?? [],
    rtm: parsed.rtm ?? [],
    apiTests: parsed.apiTests ?? [],
    dbValidations: parsed.dbValidations ?? [],
    performanceIdeas: parsed.performanceIdeas ?? [],
  };
}

export async function generateAutomationProject(
  results: AnalysisResults,
  url: string | null,
): Promise<AutomationFiles> {
  const locators = results.pageElements?.elements?.slice(0, 80) ?? [];
  const raw = await callGemini(
    [
      {
        role: "system",
        content: `You are a senior SDET. Generate a complete Selenium + Java + TestNG + Maven automation project as SOURCE CODE TEXT. Use the Page Object Model. Use the REAL locators provided (priority: id > name > data-testid > aria-label > css > xpath). Include:
- pom.xml (Selenium 4, TestNG, WebDriverManager)
- testng.xml suite file
- src/test/java/base/BaseTest.java
- src/test/java/base/DriverFactory.java
- src/test/java/pages/BasePage.java
- One or more Page Object classes built from the provided locators
- TestNG test classes implementing the highest-priority test cases

Respond with ONLY a JSON object (no markdown) mapping file paths to complete file contents, e.g.:
{"pom.xml": "<?xml ...", "src/test/java/base/BaseTest.java": "package base; ..."}
Escape all content correctly as JSON strings.`,
      },
      {
        role: "user",
        content: `Application URL: ${url ?? "not provided"}\n\nUI ELEMENT LOCATORS:\n${JSON.stringify(locators)}\n\nTOP TEST CASES:\n${JSON.stringify(results.testCases.slice(0, 15))}`,
      },
    ],
    { timeoutMs: 150_000, temperature: 0.2 },
  );
  const files = parseModelJson<AutomationFiles>(raw);
  const entries = Object.entries(files).filter(
    ([k, v]) => typeof k === "string" && typeof v === "string" && v.length > 0,
  );
  if (entries.length === 0) {
    throw new TestGenError("AI did not return any project files. Please try again.", "ai_empty");
  }
  return Object.fromEntries(entries);
}

export async function answerChat(
  question: string,
  history: { role: "user" | "assistant"; content: string }[],
  results: AnalysisResults,
  requirementText: string,
): Promise<string> {
  const context = JSON.stringify({
    summary: results.summary,
    testCases: results.testCases,
    rtm: results.rtm,
    apiTests: results.apiTests,
    dbValidations: results.dbValidations,
    pageTitle: results.pageElements?.title,
    uiElements: results.pageElements?.elements?.slice(0, 60),
  }).slice(0, 50_000);

  return callGemini([
    {
      role: "system",
      content: `You are the AI TestGen Pro assistant, a senior QA expert. You help the user with follow-up questions about their analysis: generating additional test cases, explaining test cases by ID, spotting missing edge cases, SQL validations, etc. Answer in markdown. Be concise and practical.

CURRENT ANALYSIS CONTEXT:
${context}

ORIGINAL REQUIREMENT (truncated):
${requirementText.slice(0, 10_000)}`,
    },
    ...history.slice(-10),
    { role: "user", content: question },
  ]);
}
