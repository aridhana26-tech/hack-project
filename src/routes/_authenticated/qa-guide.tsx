import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Code2, Cpu, HelpCircle, ShieldAlert, Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/qa-guide")({
  component: QaGuidePage,
});

function QaGuidePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" /> QA Guide & Best Practices
        </h1>
        <p className="mt-1 text-muted-foreground">
          Learn how to write optimized requirement documents and write robust test scripts.
        </p>
      </div>

      <Tabs defaultValue="writing" className="space-y-4">
        <TabsList>
          <TabsTrigger value="writing" className="gap-2">
            <Cpu className="h-4 w-4" /> Requirements Guidelines
          </TabsTrigger>
          <TabsTrigger value="locators" className="gap-2">
            <Code2 className="h-4 w-4" /> Locator Best Practices
          </TabsTrigger>
          <TabsTrigger value="scripting" className="gap-2">
            <Sparkles className="h-4 w-4" /> Script Examples
          </TabsTrigger>
        </TabsList>

        {/* ── Requirements Guidelines ── */}
        <TabsContent value="writing">
          <Card>
            <CardHeader>
              <CardTitle>Writing AI-Friendly Requirements</CardTitle>
              <CardDescription>
                How to write requirement text to get the most accurate, structured test cases.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 border-r pr-4">
                  <h3 className="font-semibold text-foreground">💡 Do:</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Use clear, explicit numbered action items.</li>
                    <li>Clearly specify positive and negative path behavior.</li>
                    <li>Specify exact field rules (e.g. "password length: 8-15 characters").</li>
                    <li>Provide a mock URL (e.g. login, signup) to help extract input fields.</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">⚠️ Avoid:</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Vague descriptions like "user profile should look nice".</li>
                    <li>Combining unrelated features in a single block.</li>
                    <li>Ambiguous phrases like "system should behave normally".</li>
                    <li>Pasting raw code comments or database schema directly.</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Locator Best Practices ── */}
        <TabsContent value="locators">
          <Card>
            <CardHeader>
              <CardTitle>Choosing Web Element Locators</CardTitle>
              <CardDescription>
                A standard guide for picking stable web selectors for Selenium and Playwright.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b bg-muted/40 font-medium">
                    <th className="px-4 py-3">Locator Strategy</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Example</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-muted-foreground">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-foreground">data-testid</td>
                    <td className="px-4 py-3"><Badge className="bg-success/20 text-success" variant="secondary">1. Best</Badge></td>
                    <td className="px-4 py-3">Dedicated identifier for automated testing. Resilient to layout/CSS updates.</td>
                    <td className="px-4 py-3 font-mono text-xs text-primary">[data-testid="login-submit"]</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-foreground">ID</td>
                    <td className="px-4 py-3"><Badge className="bg-success/20 text-success" variant="secondary">2. High</Badge></td>
                    <td className="px-4 py-3">Unique element ID. Avoid dynamic IDs (e.g. containing random numbers).</td>
                    <td className="px-4 py-3 font-mono text-xs text-primary">#username</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-foreground">Name / Placeholder</td>
                    <td className="px-4 py-3"><Badge className="bg-warning/20 text-warning" variant="secondary">3. Medium</Badge></td>
                    <td className="px-4 py-3">Form input name attributes. Useful in simple forms.</td>
                    <td className="px-4 py-3 font-mono text-xs text-primary">input[name="email"]</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-foreground">XPath (Text matching)</td>
                    <td className="px-4 py-3"><Badge className="bg-destructive/20 text-destructive" variant="secondary">4. Low</Badge></td>
                    <td className="px-4 py-3">Locating by visual button text. Muted to spelling/language edits.</td>
                    <td className="px-4 py-3 font-mono text-xs text-primary">//button[text()="Submit"]</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Scripting Examples ── */}
        <TabsContent value="scripting">
          <Card>
            <CardHeader>
              <CardTitle>Page Object Model (POM) Structure</CardTitle>
              <CardDescription>
                Compare basic syntax structure for generated frameworks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                    <Code2 className="h-4 w-4 text-primary" /> Playwright (TypeScript)
                  </h4>
                  <pre className="rounded bg-muted p-4 text-xs font-mono overflow-x-auto leading-relaxed">
{`import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly userInput: Locator;
  readonly submitBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userInput = page.locator('#username');
    this.submitBtn = page.locator('[data-testid="submit"]');
  }

  async login(user: string) {
    await this.userInput.fill(user);
    await this.submitBtn.click();
  }
}`}
                  </pre>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                    <Code2 className="h-4 w-4 text-primary" /> Selenium (Java)
                  </h4>
                  <pre className="rounded bg-muted p-4 text-xs font-mono overflow-x-auto leading-relaxed">
{`import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;

public class LoginPage extends BasePage {
    @FindBy(id = "username")
    private WebElement userInput;

    @FindBy(css = "[data-testid='submit']")
    private WebElement submitBtn;

    public LoginPage(WebDriver driver) {
        super(driver);
    }

    public void login(String user) {
        userInput.sendKeys(user);
        submitBtn.click();
    }
}`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
