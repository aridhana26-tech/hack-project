import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Settings2, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/prompts")({
  component: CustomPromptsPage,
});

const DEFAULT_PROMPT = `You are a Principal Software Quality Assurance Architect. 
Your task is to analyze user requirements and visual static HTML contents to extract elements and build professional-grade QA deliverables.
Ensure all test cases contain clear step-by-step logic, expected results, priority ranking, and are mapped to requirement IDs.`;

function CustomPromptsPage() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);

  useEffect(() => {
    const saved = localStorage.getItem("testgen-custom-prompt");
    if (saved) {
      setPrompt(saved);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("testgen-custom-prompt", prompt);
    toast.success("AI Prompt configuration saved successfully!");
  };

  const handleReset = () => {
    setPrompt(DEFAULT_PROMPT);
    localStorage.removeItem("testgen-custom-prompt");
    toast.success("Prompt reset to default guidelines.");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-primary" /> AI Prompt Customizer
        </h1>
        <p className="mt-1 text-muted-foreground">
          Modify the primary system instruction prompt template passed to Gemini to control generating test cases.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">System Prompt Instructions</CardTitle>
          <CardDescription>
            Tweak the prompt below to change testing language, style, or force specific test layout formats.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="system-prompt" className="text-xs font-semibold text-muted-foreground">Prompt Context</Label>
            <Textarea
              id="system-prompt"
              rows={12}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="font-mono text-xs leading-relaxed bg-muted/20"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleReset} className="gap-1.5 text-muted-foreground">
              <RotateCcw className="h-4 w-4" /> Reset Default
            </Button>
            <Button onClick={handleSave} className="gap-1.5">
              <Save className="h-4 w-4" /> Save Instructions
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
