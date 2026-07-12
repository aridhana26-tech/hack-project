import type { AnalysisResults, AutomationFiles } from "./testgen-types";

async function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function downloadTestCasesXlsx(results: AnalysisResults) {
  const XLSX = await import("xlsx");
  const rows = results.testCases.map((tc) => ({
    "Test Case ID": tc.id,
    Title: tc.title,
    Category: tc.category,
    Priority: tc.priority,
    Preconditions: tc.preconditions ?? "",
    Steps: (tc.steps ?? []).map((s, i) => `${i + 1}. ${s}`).join("\n"),
    "Test Data": tc.testData ?? "",
    "Expected Result": tc.expectedResult,
    "Requirement IDs": (tc.requirementIds ?? []).join(", "),
    "UI Elements": (tc.uiElements ?? []).join(", "),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 14 }, { wch: 10 }, { wch: 30 }, { wch: 60 }, { wch: 25 }, { wch: 45 }, { wch: 18 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Test Cases");
  XLSX.writeFile(wb, "TestCases.xlsx");
}

export async function downloadRtmXlsx(results: AnalysisResults) {
  const XLSX = await import("xlsx");
  const rows = results.rtm.map((r) => ({
    "Requirement ID": r.requirementId,
    Requirement: r.requirementSummary,
    "Test Case IDs": (r.testCaseIds ?? []).join(", "),
    "UI Element": r.uiElement,
    Priority: r.priority,
    Risk: r.risk,
    Severity: r.severity,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 15 }, { wch: 50 }, { wch: 25 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "RTM");
  XLSX.writeFile(wb, "RTM.xlsx");
}

export async function downloadLocatorReportXlsx(results: AnalysisResults) {
  const XLSX = await import("xlsx");
  const elements = results.pageElements?.elements ?? [];
  const rows = elements.map((el) => ({
    Kind: el.kind,
    Tag: el.tag,
    ID: el.id ?? "",
    Name: el.name ?? "",
    Type: el.type ?? "",
    "data-testid": el.dataTestId ?? "",
    "aria-label": el.ariaLabel ?? "",
    Text: el.text ?? "",
    "Recommended Locator": el.locator,
    Strategy: el.locatorStrategy,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 45 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Locator Report");
  XLSX.writeFile(wb, "LocatorReport.xlsx");
}

export async function downloadAutomationZip(files: AutomationFiles) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  zip.file(
    "README.txt",
    "AI TestGen Pro — generated Selenium/Java automation project.\n\nThis is generated source code for you to run locally (mvn test). It has NOT been executed or verified by the app.\nRequirements: Java 17+, Maven, Chrome.\n",
  );
  const blob = await zip.generateAsync({ type: "blob" });
  await saveBlob(blob, "automation-project.zip");
}

export async function downloadSummaryMarkdown(results: AnalysisResults, url: string | null) {
  const ra = results.requirementAnalysis;
  const lines: string[] = [
    "# Requirement Summary — AI TestGen Pro",
    "",
    url ? `**Application URL:** ${url}` : "",
    `**Generated:** ${new Date().toLocaleString()}`,
    "",
    "## Executive Summary",
    results.summary || "_No summary available._",
    "",
    "## Functional Requirements",
    ...ra.functionalRequirements.map((r) => `- **${r.id}** (${r.priority ?? "—"}): ${r.description}`),
    "",
    "## Non-Functional Requirements",
    ...ra.nonFunctionalRequirements.map((r) => `- **${r.id}** (${r.priority ?? "—"}): ${r.description}`),
    "",
    "## Business Rules",
    ...ra.businessRules.map((b) => `- ${b}`),
    "",
    "## Validations",
    ...ra.validations.map((v) => `- ${v}`),
    "",
    "## Actors",
    ...ra.actors.map((a) => `- ${a}`),
    "",
    "## Inputs",
    ...ra.inputs.map((i) => `- ${i}`),
    "",
    "## Outputs",
    ...ra.outputs.map((o) => `- ${o}`),
    "",
    "## Error Conditions",
    ...ra.errorConditions.map((e) => `- ${e}`),
    "",
    "## Acceptance Criteria",
    ...ra.acceptanceCriteria.map((c) => `- ${c}`),
    "",
    `## Coverage`,
    `- Test cases generated: ${results.testCases.length}`,
    `- RTM entries: ${results.rtm.length}`,
    `- API test suggestions: ${results.apiTests.length}`,
    `- DB validation suggestions: ${results.dbValidations.length}`,
  ];
  const blob = new Blob([lines.filter((l) => l !== undefined).join("\n")], {
    type: "text/markdown;charset=utf-8",
  });
  await saveBlob(blob, "RequirementSummary.md");
}

export async function downloadJiraXrayCsv(results: AnalysisResults) {
  const headers = ["Test Case ID", "Summary", "Preconditions", "Step Description", "Test Data", "Expected Result", "Priority", "Category", "Requirement IDs"];
  const csvRows: string[] = [headers.join(",")];

  for (const tc of results.testCases) {
    const steps = (tc.steps ?? []).map((s, i) => `${i + 1}. ${s}`).join("\n");
    const values = [
      tc.id,
      tc.title,
      tc.preconditions ?? "",
      steps,
      tc.testData ?? "",
      tc.expectedResult,
      tc.priority,
      tc.category,
      (tc.requirementIds ?? []).join(", "),
    ];

    const escaped = values.map((val) => {
      const stringified = String(val).replace(/"/g, '""');
      if (stringified.includes(",") || stringified.includes("\n") || stringified.includes('"')) {
        return `"${stringified}"`;
      }
      return stringified;
    });

    csvRows.push(escaped.join(","));
  }

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  await saveBlob(blob, "Jira_Xray_TestCases.csv");
}
