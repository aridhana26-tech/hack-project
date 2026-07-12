import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, ClipboardList, CheckSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/test-suites")({
  component: TestSuitesPage,
});

interface TestSuite {
  id: string;
  name: string;
  description: string;
  testCount: number;
}

function TestSuitesPage() {
  const [suites, setSuites] = useState<TestSuite[]>([
    { id: "S-1", name: "Sanity Suite", description: "Quick verification of basic app features.", testCount: 5 },
    { id: "S-2", name: "Regression Suite", description: "Full validation including edge cases.", testCount: 12 },
    { id: "S-3", name: "Authentication Suite", description: "Bypass login & guest credentials check.", testCount: 4 },
  ]);

  const [newSuiteName, setNewSuiteName] = useState("");
  const [newSuiteDesc, setNewSuiteDesc] = useState("");

  const handleAddSuite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuiteName.trim()) return;

    const newSuite: TestSuite = {
      id: `S-${suites.length + 1}`,
      name: newSuiteName.trim(),
      description: newSuiteDesc.trim() || "No description provided.",
      testCount: 0,
    };

    setSuites([...suites, newSuite]);
    setNewSuiteName("");
    setNewSuiteDesc("");
  };

  const handleDelete = (id: string) => {
    setSuites(suites.filter((s) => s.id !== id));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" /> Test Suites
        </h1>
        <p className="mt-1 text-muted-foreground">
          Create and organize your generated test cases into target release test suites.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {suites.map((suite) => (
            <Card key={suite.id} className="hover:border-primary/40 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckSquare className="h-4.5 w-4.5 text-primary" /> {suite.name}
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(suite.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription>{suite.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground flex justify-between items-center pt-2 border-t">
                <span>Suite ID: <code className="font-semibold">{suite.id}</code></span>
                <span className="font-medium text-foreground bg-accent/40 px-2 py-0.5 rounded">
                  {suite.testCount} tests linked
                </span>
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Create Test Suite</CardTitle>
              <CardDescription>Group new test conditions together.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddSuite} className="space-y-3">
                <div className="grid gap-1">
                  <Input
                    placeholder="Suite name (e.g. Profile Page)"
                    value={newSuiteName}
                    onChange={(e) => setNewSuiteName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-1">
                  <Input
                    placeholder="Short description"
                    value={newSuiteDesc}
                    onChange={(e) => setNewSuiteDesc(e.target.value)}
                  />
                </div>
                <Button type="submit" size="sm" className="w-full gap-1">
                  <Plus className="h-4 w-4" /> Add Suite
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
