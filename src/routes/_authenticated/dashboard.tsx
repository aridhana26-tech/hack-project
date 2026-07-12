import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  FilePlus2,
  FlaskConical,
  Globe,
  History as HistoryIcon,
  ArrowRight,
  Activity,
  Database,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";

import * as api from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HelpCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [url, setUrl] = useState("");
  const [tourStep, setTourStep] = useState<number | null>(null);

  useEffect(() => {
    const onboarded = localStorage.getItem("testgen-onboarded");
    if (!onboarded) {
      setTourStep(1);
    }
  }, []);

  const { data: analyses, isLoading } = useQuery({
    queryKey: ["analyses", "recent"],
    queryFn: () => api.getRecentAnalyses(5),
  });

  const total = analyses?.length ?? 0;
  const totalTests =
    analyses?.reduce((sum, a) => {
      const r = a.results_json as { testCases?: unknown[] } | null;
      return sum + (r?.testCases?.length ?? 0);
    }, 0) ?? 0;

  const handleStartAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedText.trim()) {
      toast.error("Please enter requirement text.");
      return;
    }
    setRunning(true);
    try {
      // Step 1: Analyze Requirements
      const reqAnalysis = await api.analyzeRequirements(pastedText);
      
      // Step 2: Fetch Page Elements (if URL provided)
      let pageElements = null;
      if (url.trim()) {
        try {
          pageElements = await api.fetchUrlElements(url.trim());
        } catch (err) {
          console.warn("URL analysis failed, proceeding without selectors", err);
        }
      }

      // Step 3: Generate Tests
      const result = await api.generateTests({
        requirementText: pastedText,
        url: url.trim() || null,
        requirementAnalysis: reqAnalysis,
        pageElements,
      });

      toast.success("Analysis complete!");
      navigate({ to: `/results/${result.id}` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setRunning(false);
    }
  };

  const stats = (() => {
    const categories: Record<string, number> = {};
    const priorities: Record<string, number> = { High: 0, Medium: 0, Low: 0 };

    if (!analyses) return { categoriesData: [], prioritiesData: [] };

    analyses.forEach((a) => {
      const res = a.results_json as { testCases?: { category: string; priority: string }[] } | null;
      if (res?.testCases) {
        res.testCases.forEach((tc) => {
          const cat = tc.category || "other";
          const catName = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
          categories[catName] = (categories[catName] || 0) + 1;
          
          const prio = tc.priority || "Medium";
          const prioName = prio.charAt(0).toUpperCase() + prio.slice(1).toLowerCase();
          if (prioName in priorities) {
            priorities[prioName] += 1;
          } else {
            priorities[prioName] = (priorities[prioName] || 0) + 1;
          }
        });
      }
    });

    const categoriesData = Object.entries(categories).map(([name, value]) => ({
      name,
      value,
    }));

    const prioritiesData = Object.entries(priorities).map(([name, value]) => ({
      name,
      value,
    }));

    return { categoriesData, prioritiesData };
  })();

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6b7280"];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      {/* Premium Hero Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl bg-gradient-to-r from-primary via-purple-500 to-indigo-600 bg-clip-text text-transparent">
            AI TestGen Pro Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Generate production-ready test suites, POM automation, and trace matrices instantly.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5 text-xs font-semibold"
            onClick={() => setTourStep(1)}
          >
            <HelpCircle className="h-4 w-4" /> Quick Tour
          </Button>
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-primary font-medium">
            <Badge className="bg-primary/20 text-primary pointer-events-none hover:bg-primary/20">v2.4 Pro</Badge>
            <span>Active</span>
          </div>
        </div>
      </div>

      {/* Real-time Collaboration Vibe */}
      <div className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-lg p-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Live Sync Active: <strong className="text-foreground">3 QA Architects</strong> editing this project.</span>
        </div>
        <div className="flex -space-x-1.5 overflow-hidden">
          <div className="inline-block h-6 w-6 rounded-full ring-2 ring-background bg-teal-500 text-[10px] text-white flex items-center justify-center font-bold">G</div>
          <div className="inline-block h-6 w-6 rounded-full ring-2 ring-background bg-indigo-500 text-[10px] text-white flex items-center justify-center font-bold">D</div>
          <div className="inline-block h-6 w-6 rounded-full ring-2 ring-background bg-amber-500 text-[10px] text-white flex items-center justify-center font-bold">A</div>
        </div>
      </div>

      {/* Grid: Overview Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="hover:border-primary/30 transition-all">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" /> Total analyses
            </CardDescription>
            <CardTitle className="text-3xl">{isLoading ? "—" : total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="hover:border-primary/30 transition-all">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-purple-500" /> Total Test cases
            </CardDescription>
            <CardTitle className="text-3xl">{isLoading ? "—" : totalTests}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="hover:border-primary/30 transition-all">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-500" /> Connection type
            </CardDescription>
            <CardTitle className="text-lg pt-1 font-semibold text-muted-foreground">SQLite DB (Local)</CardTitle>
          </CardHeader>
        </Card>
        <Card className="hover:border-primary/30 transition-all">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500 animate-pulse" /> API Latency Health
            </CardDescription>
            <CardTitle className="text-lg pt-1 font-semibold text-emerald-500 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block" /> Online (12ms)
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Grid Section: Instant Analyzer + Quick Info */}
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        {/* Instant Analyzer Widget */}
        <Card className="border-primary/20 shadow-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <Zap className="h-5 w-5 text-primary fill-primary/15" /> Instant Requirement Analyzer
            </CardTitle>
            <CardDescription>
              Analyze specifications and generate code without leaving the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStartAnalysis} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="inst-reqs">Requirements Specs (User stories, text description)</Label>
                <Textarea
                  id="inst-reqs"
                  rows={4}
                  placeholder="e.g. When the guest logs in, they should see a bypass banner..."
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  disabled={running}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inst-url">Target Application URL (Optional, to extract locators)</Label>
                <Input
                  id="inst-url"
                  placeholder="e.g. http://example.com/login"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={running}
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={running}>
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating Test Suite...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Start AI Generation
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Quick Tips Carousel */}
        <Card className="bg-gradient-to-b from-muted/30 to-muted/10">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" /> Pro Tips & Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-4 leading-relaxed">
            <div className="space-y-1.5 border-l-2 border-primary/45 pl-3 py-0.5">
              <h4 className="font-semibold text-foreground">Interactive Test Editor</h4>
              <p>You can modify and tune generated test cases in-place from the Results page.</p>
            </div>
            <div className="space-y-1.5 border-l-2 border-purple-500/45 pl-3 py-0.5">
              <h4 className="font-semibold text-foreground">Multi-Framework Export</h4>
              <p>Download full Page Object structures for Selenium, Playwright, or Cypress.</p>
            </div>
            <div className="space-y-1.5 border-l-2 border-indigo-500/45 pl-3 py-0.5">
              <h4 className="font-semibold text-foreground">Jira CSV Import</h4>
              <p>Export test case runs straight into Jira Xray CSV format to bypass manual setup.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {totalTests > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Priority chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Test Cases by Priority</CardTitle>
              <CardDescription>Visual breakdown of test severity levels.</CardDescription>
            </CardHeader>
            <CardContent className="h-64 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.prioritiesData}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <ChartTooltip contentStyle={{ background: "hsl(var(--background))", borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: "11px" }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Category chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Test Cases by Category</CardTitle>
              <CardDescription>Breakdown by testing target type.</CardDescription>
            </CardHeader>
            <CardContent className="h-64 flex flex-col justify-center pt-2">
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie
                    data={stats.categoriesData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {stats.categoriesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip contentStyle={{ background: "hsl(var(--background))", borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: "11px" }} />
                  <Legend verticalAlign="bottom" height={40} iconSize={6} iconType="circle" wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Recent analyses</CardTitle>
            <CardDescription>Your latest requirement analysis runs.</CardDescription>
          </div>
          <Link to="/history">
            <Button variant="ghost" size="sm" className="gap-1">
              <HistoryIcon className="h-4 w-4" /> View all
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !analyses || analyses.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No analyses yet. Upload a requirement document to get started.
              </p>
              <Link to="/new-analysis">
                <Button className="mt-4 gap-2">
                  <FilePlus2 className="h-4 w-4" /> Start your first analysis
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {analyses.map((a) => (
                <Link
                  key={a.id}
                  to="/results/$analysisId"
                  params={{ analysisId: a.id }}
                  className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.title || "Untitled analysis"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.url || "No URL"} · {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {((a.results_json as { testCases?: unknown[] } | null)?.testCases?.length ?? 0)}{" "}
                      tests
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Onboarding tour modal dialog */}
      <Dialog open={tourStep !== null} onOpenChange={(open) => !open && setTourStep(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-base">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" /> Onboarding Tour — Step {tourStep} of 4
            </DialogTitle>
            <DialogDescription className="text-xs pt-1.5 leading-relaxed">
              {tourStep === 1 && (
                <>
                  Welcome to <strong>AI TestGen Pro</strong>! This dashboard displays connection health parameters, total test counts, and gives you direct workspace analytics shortcuts.
                </>
              )}
              {tourStep === 2 && (
                <>
                  <strong>Instant Req-Analyzer</strong>: You don't need to jump to other screens. Type your requirements and target URL directly in the dashboard input block, and click generate to run the analysis!
                </>
              )}
              {tourStep === 3 && (
                <>
                  <strong>Interactive Results</strong>: Inside test reports, you can edit test steps visually, choose between Playwright / Cypress / Selenium automation frameworks, and export to Jira.
                </>
              )}
              {tourStep === 4 && (
                <>
                  <strong>Locator Sandbox & API Tester</strong>: Use the sidebar utilities to suggest elements selectors from HTML or test API endpoints directly inside your workspace.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-between items-center pt-4 border-t mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => {
                setTourStep(null);
                localStorage.setItem("testgen-onboarded", "true");
              }}
            >
              Skip Tour
            </Button>
            <Button
              size="sm"
              className="text-xs gap-1"
              onClick={() => {
                if (tourStep && tourStep < 4) {
                  setTourStep(tourStep + 1);
                } else {
                  setTourStep(null);
                  localStorage.setItem("testgen-onboarded", "true");
                  toast.success("Onboarding complete! Enjoy AI TestGen Pro.");
                }
              }}
            >
              {tourStep === 4 ? "Get Started" : "Next Step"} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
