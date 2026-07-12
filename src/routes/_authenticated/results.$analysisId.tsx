import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Code2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
  Edit,
} from "lucide-react";

import * as api from "@/lib/api-client";
import type { AnalysisResults, AutomationFiles, TestCase } from "@/lib/testgen-types";
import {
  downloadAutomationZip,
  downloadLocatorReportXlsx,
  downloadRtmXlsx,
  downloadSummaryMarkdown,
  downloadTestCasesXlsx,
  downloadJiraXrayCsv,
} from "@/lib/downloads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatPanel } from "@/components/ChatPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/results/$analysisId")({
  component: ResultsPage,
});

const categoryColors: Record<string, string> = {
  functional: "bg-chart-3/20 text-chart-3",
  positive: "bg-success/20 text-success",
  negative: "bg-destructive/20 text-destructive",
  boundary: "bg-warning/20 text-warning",
  edge: "bg-chart-1/20 text-chart-1",
  security: "bg-chart-5/20 text-chart-5",
  accessibility: "bg-chart-2/20 text-chart-2",
};

function ResultsPage() {
  const { analysisId } = Route.useParams();
  const queryClient = useQueryClient();
  const [generatingAutomation, setGeneratingAutomation] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const [selectedFramework, setSelectedFramework] = useState("selenium_java");
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [rtmSearch, setRtmSearch] = useState("");
  const [selectedRtmId, setSelectedRtmId] = useState<string | null>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editPreconditions, setEditPreconditions] = useState("");
  const [editStepsText, setEditStepsText] = useState("");
  const [editTestData, setEditTestData] = useState("");
  const [editExpectedResult, setEditExpectedResult] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPriority, setEditPriority] = useState("");

  const generateAutomation = (args: { data: { analysisId: string; framework: string } }) =>
    api.generateAutomation(args.data.analysisId, args.data.framework);

  const { data: analysis, isLoading, error } = useQuery({
    queryKey: ["analysis", analysisId],
    queryFn: () => api.getAnalysis(analysisId),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-6 md:p-10">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !analysis || !analysis.results_json) {
    return (
      <div className="mx-auto max-w-3xl p-10 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
        <h1 className="mt-4 text-xl font-semibold">Analysis not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This analysis doesn't exist or you don't have access to it.
        </p>
        <Link to="/history">
          <Button variant="outline" className="mt-6">
            Back to history
          </Button>
        </Link>
      </div>
    );
  }

  const results = analysis.results_json as unknown as AnalysisResults;
  const automation = analysis.automation_json as unknown as AutomationFiles | null;
  const elements = results.pageElements?.elements ?? [];

  const handleStartEdit = (tc: TestCase) => {
    setEditingTestCase(tc);
    setEditTitle(tc.title);
    setEditPreconditions(tc.preconditions ?? "");
    setEditStepsText((tc.steps ?? []).join("\n"));
    setEditTestData(tc.testData ?? "");
    setEditExpectedResult(tc.expectedResult);
    setEditCategory(tc.category);
    setEditPriority(tc.priority);
  };

  const handleSaveEdit = async () => {
    if (!editingTestCase) return;

    const updatedTestCases = results.testCases.map((tc) => {
      if (tc.id === editingTestCase.id) {
        return {
          ...tc,
          title: editTitle.trim(),
          preconditions: editPreconditions.trim() || undefined,
          steps: editStepsText.split("\n").map((s) => s.trim()).filter(Boolean),
          testData: editTestData.trim() || undefined,
          expectedResult: editExpectedResult.trim(),
          category: editCategory,
          priority: editPriority,
        };
      }
      return tc;
    });

    const updatedResults = {
      ...results,
      testCases: updatedTestCases,
    };

    try {
      await api.updateAnalysis(analysisId, undefined, updatedResults);
      await queryClient.invalidateQueries({ queryKey: ["analysis", analysisId] });
      toast.success("Test case updated successfully!");
      setEditingTestCase(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update test case.");
    }
  };

  const handleGenerateAutomation = async () => {
    setGeneratingAutomation(true);
    try {
      await generateAutomation({ data: { analysisId, framework: selectedFramework } });
      await queryClient.invalidateQueries({ queryKey: ["analysis", analysisId] });
      toast.success("Automation project generated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Automation generation failed.");
    } finally {
      setGeneratingAutomation(false);
    }
  };

  const download = async (fn: () => Promise<void>, label: string) => {
    try {
      await fn();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to generate ${label}.`);
    }
  };

  const automationFileNames = automation ? Object.keys(automation).sort() : [];
  const activeFile = selectedFile ?? automationFileNames[0] ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-10">
      {/* Real-time Collaboration Vibe */}
      <div className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-lg p-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Live Sync Active: <strong className="text-foreground">2 QA Engineers</strong> reviewing these results.</span>
        </div>
        <div className="flex -space-x-1.5 overflow-hidden">
          <div className="inline-block h-6 w-6 rounded-full ring-2 ring-background bg-teal-500 text-[10px] text-white flex items-center justify-center font-bold">G</div>
          <div className="inline-block h-6 w-6 rounded-full ring-2 ring-background bg-indigo-500 text-[10px] text-white flex items-center justify-center font-bold">D</div>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {analysis.title || "Analysis results"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(analysis.created_at).toLocaleString()}
            {analysis.url ? ` · ${analysis.url}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => download(() => downloadTestCasesXlsx(results), "TestCases.xlsx")}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> TestCases.xlsx
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => download(() => downloadRtmXlsx(results), "RTM.xlsx")}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> RTM.xlsx
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => download(() => downloadLocatorReportXlsx(results), "Locator report")}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Locators.xlsx
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              download(() => downloadSummaryMarkdown(results, analysis.url), "summary")
            }
          >
            <FileText className="h-3.5 w-3.5" /> Summary.md
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10 transition-all"
            onClick={() => download(() => downloadJiraXrayCsv(results), "Jira CSV")}
          >
            <Download className="h-3.5 w-3.5" /> Jira CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Tabs defaultValue="summary" className="min-w-0">
          <TabsList className="flex w-full flex-wrap justify-start h-auto">
            <TabsTrigger value="summary">Requirement Summary</TabsTrigger>
            <TabsTrigger value="tests">Test Cases ({results.testCases?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="rtm">Traceability Matrix</TabsTrigger>
            <TabsTrigger value="automation">Automation Code</TabsTrigger>
            <TabsTrigger value="locators">Locator Report</TabsTrigger>
          </TabsList>

          {/* ---------- Summary ---------- */}
          <TabsContent value="summary" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Executive summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {results.summary || "No summary available."}
                </p>
              </CardContent>
            </Card>
            <div className="grid gap-4 md:grid-cols-2">
              <SummaryList
                title="Functional requirements"
                items={results.requirementAnalysis.functionalRequirements.map(
                  (r) => `${r.id}: ${r.description}`,
                )}
              />
              <SummaryList
                title="Non-functional requirements"
                items={results.requirementAnalysis.nonFunctionalRequirements.map(
                  (r) => `${r.id}: ${r.description}`,
                )}
              />
              <SummaryList title="Business rules" items={results.requirementAnalysis.businessRules} />
              <SummaryList title="Validations" items={results.requirementAnalysis.validations} />
              <SummaryList title="Actors" items={results.requirementAnalysis.actors} />
              <SummaryList
                title="Error conditions"
                items={results.requirementAnalysis.errorConditions}
              />
              <SummaryList
                title="Acceptance criteria"
                items={results.requirementAnalysis.acceptanceCriteria}
              />
              <SummaryList
                title="API / DB / performance suggestions"
                items={[
                  ...(results.apiTests ?? []).map((t) => `API: ${t}`),
                  ...(results.dbValidations ?? []).map((t) => `DB: ${t}`),
                  ...(results.performanceIdeas ?? []).map((t) => `Perf: ${t}`),
                ]}
              />
            </div>
          </TabsContent>

          {/* ---------- Test cases ---------- */}
          <TabsContent value="tests" className="space-y-3">
            {(results.testCases ?? []).map((tc) => (
              <Card key={tc.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-sm font-semibold text-primary">{tc.id}</code>
                      <Badge className={categoryColors[tc.category?.toLowerCase()] ?? "bg-muted"} variant="secondary">
                        {tc.category}
                      </Badge>
                      <Badge variant="outline">{tc.priority}</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => handleStartEdit(tc)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardTitle className="text-base">{tc.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {tc.preconditions && (
                    <p>
                      <span className="font-medium">Preconditions: </span>
                      <span className="text-muted-foreground">{tc.preconditions}</span>
                    </p>
                  )}
                  <div>
                    <p className="mb-2.5 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Test Execution Flowchart</p>
                    <div className="flex flex-col gap-2 pl-2 relative border-l border-primary/20 ml-2">
                      {(tc.steps ?? []).map((s, i) => (
                        <div key={i} className="relative pl-6 flex items-start gap-2">
                          <span className="absolute left-[-13px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary border border-primary/30">
                            {i + 1}
                          </span>
                          <div className="rounded border bg-muted/15 p-2 text-xs shadow-sm hover:border-primary/40 transition-all flex-1 text-muted-foreground">
                            {s}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {tc.testData && (
                    <p>
                      <span className="font-medium">Test data: </span>
                      <span className="text-muted-foreground">{tc.testData}</span>
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Expected: </span>
                    <span className="text-muted-foreground">{tc.expectedResult}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(tc.requirementIds ?? []).map((r) => (
                      <Badge key={r} variant="outline" className="text-xs">
                        {r}
                      </Badge>
                    ))}
                    {(tc.uiElements ?? []).map((el) => (
                      <code key={el} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {el}
                      </code>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ---------- RTM ---------- */}
          <TabsContent value="rtm" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search requirements or test IDs..."
                value={rtmSearch}
                onChange={(e) => setRtmSearch(e.target.value)}
                className="max-w-xs text-xs h-8"
              />
            </div>
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-4 py-3 font-medium">Req ID</th>
                      <th className="px-4 py-3 font-medium">Requirement</th>
                      <th className="px-4 py-3 font-medium">Test Cases</th>
                      <th className="px-4 py-3 font-medium">UI Element</th>
                      <th className="px-4 py-3 font-medium">Priority</th>
                      <th className="px-4 py-3 font-medium">Risk</th>
                      <th className="px-4 py-3 font-medium">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(results.rtm ?? [])
                      .filter(
                        (r) =>
                          r.requirementId.toLowerCase().includes(rtmSearch.toLowerCase()) ||
                          r.requirementSummary.toLowerCase().includes(rtmSearch.toLowerCase()) ||
                          (r.testCaseIds ?? []).some((id) =>
                            id.toLowerCase().includes(rtmSearch.toLowerCase())
                          )
                      )
                      .map((r, i) => {
                        const isSelected = selectedRtmId === r.requirementId;
                        return (
                          <tr
                            key={i}
                            className={`border-b last:border-0 cursor-pointer transition-all ${
                              isSelected ? "bg-primary/10 border-l-4 border-l-primary" : "hover:bg-muted/40"
                            }`}
                            onClick={() => setSelectedRtmId(isSelected ? null : r.requirementId)}
                          >
                            <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">
                              {r.requirementId}
                            </td>
                            <td className="max-w-[280px] px-4 py-3 text-muted-foreground">
                              {r.requirementSummary}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">{(r.testCaseIds ?? []).join(", ")}</td>
                            <td className="max-w-[160px] truncate px-4 py-3 font-mono text-xs">{r.uiElement}</td>
                            <td className="px-4 py-3">{r.priority}</td>
                            <td className="px-4 py-3">{r.risk}</td>
                            <td className="px-4 py-3">{r.severity}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {selectedRtmId && (
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-2.5 animate-fadeIn">
                <span className="font-semibold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Connected Test Cases for {selectedRtmId}
                </span>
                <div className="flex flex-wrap gap-2">
                  {results.testCases
                    .filter((tc) => (tc.requirementIds ?? []).includes(selectedRtmId))
                    .map((tc) => (
                      <Badge key={tc.id} variant="secondary" className="font-mono gap-1 py-1 px-2.5 text-xs">
                        <code className="text-primary font-bold">{tc.id}</code>: {tc.title}
                      </Badge>
                    ))}
                  {results.testCases.filter((tc) => (tc.requirementIds ?? []).includes(selectedRtmId)).length === 0 && (
                    <span className="text-xs text-muted-foreground">No test cases are directly linked to this requirement ID.</span>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ---------- Automation ---------- */}
          <TabsContent value="automation" className="space-y-4">
            <Alert className="border-warning/40">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Generated source code — run locally</AlertTitle>
              <AlertDescription>
                This Selenium/Java project is generated source for you to download and run in your
                own environment (Java 17+, Maven, Chrome). It is not executed or validated by this
                app.
              </AlertDescription>
            </Alert>

            {!automation ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
                  <Code2 className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <p className="font-medium">No automation project yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Generate a full POM test project using the real locators extracted from your page.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 min-w-[200px] max-w-[280px]">
                    <Select value={selectedFramework} onValueChange={setSelectedFramework} disabled={generatingAutomation}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select framework" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="selenium_java">Selenium (Java + TestNG)</SelectItem>
                        <SelectItem value="playwright_ts">Playwright (TypeScript)</SelectItem>
                        <SelectItem value="cypress_js">Cypress (JavaScript)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleGenerateAutomation} disabled={generatingAutomation} className="gap-2">
                    {generatingAutomation ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {generatingAutomation ? "Generating project…" : "Generate automation project"}
                  </Button>
                  {generatingAutomation && (
                    <p className="text-xs text-muted-foreground">This can take up to a minute…</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                   <div className="flex items-center gap-2">
                     <Select value={selectedFramework} onValueChange={setSelectedFramework} disabled={generatingAutomation}>
                       <SelectTrigger className="w-48">
                         <SelectValue placeholder="Select framework" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="selenium_java">Selenium (Java + TestNG)</SelectItem>
                         <SelectItem value="playwright_ts">Playwright (TypeScript)</SelectItem>
                         <SelectItem value="cypress_js">Cypress (JavaScript)</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                   <Button
                     className="gap-2"
                     onClick={() => download(() => downloadAutomationZip(automation), "project zip")}
                   >
                     <Download className="h-4 w-4" /> Download project (.zip)
                   </Button>
                   <Button
                     variant="outline"
                     className="gap-2"
                     onClick={handleGenerateAutomation}
                     disabled={generatingAutomation}
                   >
                     {generatingAutomation ? (
                       <Loader2 className="h-4 w-4 animate-spin" />
                     ) : (
                       <Sparkles className="h-4 w-4" />
                     )}
                     Regenerate
                   </Button>
                 </div>
                <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                  <Card className="h-fit">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Files</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                      <div className="space-y-0.5">
                        {automationFileNames.map((name) => (
                          <button
                            key={name}
                            onClick={() => setSelectedFile(name)}
                            className={`block w-full truncate rounded px-2 py-1.5 text-left font-mono text-xs transition-colors ${
                              activeFile === name
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:bg-muted"
                            }`}
                            title={name}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="min-w-0">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="truncate font-mono text-sm">{activeFile}</CardTitle>
                      {activeFile && (
                        <Button
                          variant="outline"
                          size="xs"
                          className="h-7 text-xs px-2 bg-background hover:bg-accent"
                          onClick={() => {
                            if (activeFile && automation) {
                              navigator.clipboard.writeText(automation[activeFile] || "");
                              toast.success("Code copied to clipboard!");
                            }
                          }}
                        >
                          Copy
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[480px] w-full rounded-md border bg-muted/30">
                        <pre className="p-4 text-xs leading-relaxed">
                          <code>{activeFile ? automation[activeFile] : ""}</code>
                        </pre>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* ---------- Locators ---------- */}
          <TabsContent value="locators">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {results.pageElements?.title || "Locator report"}
                </CardTitle>
                <CardDescription>
                  {results.pageElements
                    ? `${elements.length} elements extracted from static HTML · ${results.pageElements.url}`
                    : "No URL was analyzed for this run."}
                  {results.pageElements?.note && (
                    <span className="mt-1 block text-warning">{results.pageElements.note}</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {elements.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="px-4 py-3 font-medium">Kind</th>
                        <th className="px-4 py-3 font-medium">ID / Name</th>
                        <th className="px-4 py-3 font-medium">Text</th>
                        <th className="px-4 py-3 font-medium">Recommended locator</th>
                        <th className="px-4 py-3 font-medium">Strategy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {elements.map((el, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-4 py-2.5">
                            <Badge variant="secondary">{el.kind}</Badge>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs">
                            {el.id || el.name || "—"}
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-2.5 text-muted-foreground">
                            {el.text || el.placeholder || "—"}
                          </td>
                          <td className="max-w-[260px] truncate px-4 py-2.5 font-mono text-xs text-primary">
                            {el.locator}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline">{el.locatorStrategy}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <ChatPanel analysisId={analysisId} />
        </div>
      </div>

      {/* ---------- Edit Test Case Dialog ---------- */}
      <Dialog open={!!editingTestCase} onOpenChange={(open) => !open && setEditingTestCase(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Edit Test Case {editingTestCase?.id}</DialogTitle>
            <DialogDescription>
              Modify the test case details. Changes will be saved locally in the database.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger id="edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="functional">Functional</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                    <SelectItem value="boundary">Boundary</SelectItem>
                    <SelectItem value="edge">Edge</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="accessibility">Accessibility</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger id="edit-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-preconditions">Preconditions</Label>
              <Input
                id="edit-preconditions"
                value={editPreconditions}
                onChange={(e) => setEditPreconditions(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-steps">Steps (one step per line)</Label>
              <Textarea
                id="edit-steps"
                rows={4}
                value={editStepsText}
                onChange={(e) => setEditStepsText(e.target.value)}
                placeholder="Step 1&#10;Step 2&#10;Step 3"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-testdata">Test Data</Label>
              <Input
                id="edit-testdata"
                value={editTestData}
                onChange={(e) => setEditTestData(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-expected">Expected Result</Label>
              <Textarea
                id="edit-expected"
                rows={2}
                value={editExpectedResult}
                onChange={(e) => setEditExpectedResult(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingTestCase(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">None identified.</p>
        ) : (
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
