import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Code2, Sparkles, Terminal, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/locator-sandbox")({
  component: LocatorSandboxPage,
});

interface ExtractedElement {
  tag: string;
  id: string;
  name: string;
  type: string;
  text: string;
  recommended: string;
  strategy: string;
}

function LocatorSandboxPage() {
  const [htmlInput, setHtmlInput] = useState(
    `<form id="login-form">\n  <input type="text" id="user-email" name="email" placeholder="Enter email" />\n  <input type="password" name="password" class="input-field" />\n  <button type="submit" data-testid="login-submit">Login</button>\n</form>`
  );
  const [elements, setElements] = useState<ExtractedElement[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = () => {
    setAnalyzing(true);
    setTimeout(() => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlInput, "text/html");
        const found: ExtractedElement[] = [];

        // Traverse form elements
        const queryElements = doc.querySelectorAll("input, button, select, textarea, a");
        queryElements.forEach((el) => {
          const tag = el.tagName.toLowerCase();
          const id = el.getAttribute("id") || "";
          const name = el.getAttribute("name") || "";
          const type = el.getAttribute("type") || "";
          const text = el.textContent?.trim() || el.getAttribute("placeholder") || "";
          const testId = el.getAttribute("data-testid") || "";

          let recommended = "";
          let strategy = "";

          if (testId) {
            recommended = `[data-testid="${testId}"]`;
            strategy = "data-testid";
          } else if (id) {
            recommended = `#${id}`;
            strategy = "CSS (ID)";
          } else if (name) {
            recommended = `${tag}[name="${name}"]`;
            strategy = "CSS (Name)";
          } else {
            recommended = `//${tag}[contains(text(), '${text || "..."}')]`;
            strategy = "XPath";
          }

          found.push({
            tag,
            id,
            name,
            type,
            text,
            recommended,
            strategy,
          });
        });

        setElements(found);
      } catch (err) {
        console.error(err);
      } finally {
        setAnalyzing(false);
      }
    }, 600);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-2">
          <Code2 className="h-6 w-6 text-primary" /> Locator Sandbox
        </h1>
        <p className="mt-1 text-muted-foreground">
          Paste your custom HTML snippets below to extract element nodes and get instant automated selector recommendations.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">HTML Code Editor</CardTitle>
              <CardDescription>Enter the target web page HTML fragment.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={htmlInput}
                onChange={(e) => setHtmlInput(e.target.value)}
                className="font-mono text-xs h-60 bg-muted/20"
                placeholder="Paste HTML here..."
              />
              <Button onClick={handleAnalyze} className="mt-4 gap-2 w-full sm:w-auto" disabled={analyzing}>
                {analyzing ? (
                  <>
                    <Terminal className="h-4 w-4 animate-spin" /> Analyzing...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" /> Recommend Locators
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {elements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Selector Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b bg-muted/40 font-medium">
                      <th className="px-4 py-2">Tag</th>
                      <th className="px-4 py-2">Identities</th>
                      <th className="px-4 py-2">Selector</th>
                      <th className="px-4 py-2">Strategy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-muted-foreground">
                    {elements.map((el, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2">
                          <Badge variant="secondary">{el.tag}</Badge>
                        </td>
                        <td className="px-4 py-2 text-xs font-mono">
                          {el.id && `id: ${el.id} `}
                          {el.name && `name: ${el.name}`}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-primary font-semibold">
                          {el.recommended}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline">{el.strategy}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" /> How it works
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-3 leading-relaxed">
              <p>
                The locator sandbox parses your HTML snippet locally, extracting input, buttons, and links.
              </p>
              <p>
                It applies a hierarchy rule to suggest the most robust selectors for Selenium, Playwright, Cypress, and Puppeteer:
              </p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>
                  <strong className="text-foreground">data-testid:</strong> Always preferred if present.
                </li>
                <li>
                  <strong className="text-foreground">ID:</strong> Unique elements helper.
                </li>
                <li>
                  <strong className="text-foreground">Name:</strong> Best for standard fields.
                </li>
                <li>
                  <strong className="text-foreground">XPath:</strong> Text searching backup.
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
