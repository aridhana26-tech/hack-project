import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  CircleDashed,
  FileText,
  Info,
  Loader2,
  Sparkles,
  Upload,
  X,
  XCircle,
} from "lucide-react";

import * as api from "@/lib/api-client";
import { extractTextFromFile, MAX_FILE_SIZE } from "@/lib/extract-text";
import type { PageElements, RequirementAnalysis } from "@/lib/testgen-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/new-analysis")({
  component: NewAnalysisPage,
});

type StepState = "pending" | "active" | "done" | "error" | "skipped";

interface Step {
  key: string;
  label: string;
  state: StepState;
}

const initialSteps: Step[] = [
  { key: "parse", label: "Parsing requirement document", state: "pending" },
  { key: "analyze", label: "Analyzing requirements with AI", state: "pending" },
  { key: "fetch", label: "Fetching & inspecting application URL", state: "pending" },
  { key: "tests", label: "Generating test cases, RTM & suggestions", state: "pending" },
];

function NewAnalysisPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>(initialSteps);

  const analyzeRequirements = (args: { data: { requirementText: string } }) =>
    api.analyzeRequirements(args.data.requirementText);
  const fetchUrlElements = (args: { data: { url: string } }) =>
    api.fetchUrlElements(args.data.url);
  const generateTests = (args: {
    data: {
      requirementText: string;
      url: string | null;
      requirementAnalysis: any;
      pageElements: any;
    };
  }) => api.generateTests(args.data);

  const setStep = (key: string, state: StepState) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, state } : s)));

  const doneCount = steps.filter((s) => s.state === "done" || s.state === "skipped").length;
  const progressValue = running || doneCount > 0 ? (doneCount / steps.length) * 100 : 0;

  const handleFileChange = (f: File | null) => {
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast.error("File exceeds the 10MB limit.");
      return;
    }
    const ok = [".pdf", ".docx", ".txt"].some((ext) => f.name.toLowerCase().endsWith(ext));
    if (!ok) {
      toast.error("Unsupported file type. Upload PDF, DOCX, or TXT.");
      return;
    }
    setFile(f);
  };

  const handleGenerate = async () => {
    if (!file && pastedText.trim().length < 20) {
      toast.error("Upload a requirement document or paste at least a short requirement text.");
      return;
    }
    setRunning(true);
    setSteps(initialSteps.map((s) => ({ ...s })));

    try {
      // Step 1: parse document (client-side)
      let requirementText = pastedText.trim();
      setStep("parse", "active");
      if (file) {
        try {
          const extracted = await extractTextFromFile(file);
          requirementText = [extracted, requirementText].filter(Boolean).join("\n\n");
        } catch (err) {
          setStep("parse", "error");
          toast.error(err instanceof Error ? err.message : "Failed to read the document.");
          setRunning(false);
          return;
        }
      }
      if (requirementText.trim().length < 20) {
        setStep("parse", "error");
        toast.error("The document contained too little text. Try pasting the requirements instead.");
        setRunning(false);
        return;
      }
      setStep("parse", "done");

      // Step 2: AI requirement analysis
      setStep("analyze", "active");
      let analysis: RequirementAnalysis;
      try {
        analysis = await analyzeRequirements({ data: { requirementText } });
      } catch (err) {
        setStep("analyze", "error");
        toast.error(err instanceof Error ? err.message : "Requirement analysis failed.");
        setRunning(false);
        return;
      }
      setStep("analyze", "done");

      // Step 3: fetch URL (optional)
      let pageElements: PageElements | null = null;
      if (url.trim()) {
        setStep("fetch", "active");
        try {
          pageElements = await fetchUrlElements({ data: { url: url.trim() } });
          setStep("fetch", "done");
        } catch (err) {
          setStep("fetch", "error");
          toast.warning(
            (err instanceof Error ? err.message : "URL inspection failed.") +
              " Continuing without UI element mapping.",
          );
          pageElements = null;
        }
      } else {
        setStep("fetch", "skipped");
      }

      // Step 4: generate tests + save
      setStep("tests", "active");
      try {
        const { analysisId } = await generateTests({
          data: {
            requirementText,
            url: url.trim() || null,
            requirementAnalysis: analysis,
            pageElements,
          },
        });
        setStep("tests", "done");
        toast.success("Analysis complete!");
        navigate({ to: "/results/$analysisId", params: { analysisId } });
      } catch (err) {
        setStep("tests", "error");
        toast.error(err instanceof Error ? err.message : "Test generation failed.");
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">New Analysis</h1>
        <p className="mt-1 text-muted-foreground">
          Provide requirements and an application URL to generate a full test design.
        </p>
      </div>

      <Alert className="border-primary/40 bg-accent/30">
        <Info className="h-4 w-4" />
        <AlertTitle>How analysis works</AlertTitle>
        <AlertDescription>
          This tool analyzes with HTML and CSS. Pages that require login, JavaScript rendering, or
          complex interaction cannot be fully inspected. Generated Selenium/Java code is provided as
          downloadable source for you to run in your own environment — it is not executed or
          verified within this app.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Requirement document</CardTitle>
          <CardDescription>Upload a PDF, DOCX, or TXT file (max 10MB) — or paste the text below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={running}
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              disabled={running}
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Click to upload requirement document</span>
              <span className="text-xs text-muted-foreground">PDF, DOCX, or TXT · max 10MB</span>
            </button>
          )}

          <div className="space-y-2">
            <Label htmlFor="pasted-text">Or paste requirement text</Label>
            <Textarea
              id="pasted-text"
              rows={7}
              disabled={running}
              placeholder="Paste your functional requirements, user stories, or acceptance criteria here…"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-url">Application URL (optional but recommended)</Label>
            <Input
              id="app-url"
              type="url"
              disabled={running}
              placeholder="https://your-app.example.com/login"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              We fetch the static HTML to extract forms, inputs, buttons and build real locators.
            </p>
          </div>

          <Button className="w-full gap-2" size="lg" onClick={handleGenerate} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {running ? "Generating…" : "Generate"}
          </Button>
        </CardContent>
      </Card>

      {(running || doneCount > 0 || steps.some((s) => s.state === "error")) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progressValue} />
            <ul className="space-y-3">
              {steps.map((s) => (
                <li key={s.key} className="flex items-center gap-3 text-sm">
                  {s.state === "done" && <CheckCircle2 className="h-4 w-4 text-success" />}
                  {s.state === "skipped" && <CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
                  {s.state === "active" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  {s.state === "pending" && <CircleDashed className="h-4 w-4 text-muted-foreground" />}
                  {s.state === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                  <span
                    className={
                      s.state === "active"
                        ? "font-medium"
                        : s.state === "pending"
                          ? "text-muted-foreground"
                          : ""
                    }
                  >
                    {s.label}
                    {s.state === "skipped" && " (skipped — no URL)"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
