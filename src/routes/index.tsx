import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  FileText,
  Globe,
  FlaskConical,
  Table2,
  Code2,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  UserRoundCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGuestMode } from "@/lib/guest-mode";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI TestGen Pro — Generate Test Cases & Selenium Code with AI" },
      {
        name: "description",
        content:
          "Upload requirements, point at a URL, and get test cases, an RTM, locator reports and a downloadable Selenium/Java project in minutes.",
      },
      { property: "og:title", content: "AI TestGen Pro — Generate Test Cases & Selenium Code with AI" },
      {
        property: "og:description",
        content:
          "Upload requirements, point at a URL, and get test cases, an RTM, locator reports and a downloadable Selenium/Java project in minutes.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: FileText,
    title: "Requirement Intelligence",
    desc: "Upload PDF, DOCX or TXT specs. AI extracts functional requirements, business rules, validations and acceptance criteria.",
  },
  {
    icon: Globe,
    title: "Live URL Inspection",
    desc: "Point at your application URL. We extract forms, inputs, buttons and build a prioritized locator report.",
  },
  {
    icon: FlaskConical,
    title: "Full Test Coverage",
    desc: "Functional, positive, negative, boundary, edge, security and accessibility scenarios — plus API, DB and performance ideas.",
  },
  {
    icon: Table2,
    title: "Traceability Matrix",
    desc: "Requirement ↔ test case ↔ UI element mapping with priority, risk and severity. Export to Excel in one click.",
  },
  {
    icon: Code2,
    title: "Selenium/Java Project",
    desc: "A complete Page Object Model project — BaseTest, DriverFactory, page objects with real locators, TestNG suites and pom.xml.",
  },
  {
    icon: MessageSquare,
    title: "QA Copilot Chat",
    desc: "Ask follow-ups: generate more cases, explain TC-005, find missed edge cases, or draft SQL validations.",
  },
];

function Landing() {
  const { enableGuestMode } = useGuestMode();
  const navigate = useNavigate();

  const handleGuestLogin = () => {
    enableGuestMode();
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FlaskConical className="h-4 w-4" />
          </div>
          <span className="text-lg font-bold tracking-tight">AI TestGen Pro</span>
        </div>
        <Link to="/auth">
          <Button variant="outline">Sign in</Button>
        </Link>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
          <Badge variant="outline" className="mb-6 gap-1.5 border-primary/40 px-3 py-1 text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            AI-powered QA engineering
          </Badge>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            From requirements to <span className="text-gradient-primary">runnable test suites</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Upload a requirement document, point at your application URL, and get complete test
            cases, a traceability matrix, locator reports and a downloadable Selenium/Java
            automation project — in minutes.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link to="/auth">
              <Button size="lg" className="gap-2 glow-primary">
                Get started free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 border-primary/30 hover:bg-primary/10 hover:text-primary transition-all"
              onClick={handleGuestLogin}
            >
              <UserRoundCog className="h-4 w-4" />
              Continue as Guest
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border bg-card p-6 transition-colors hover:border-primary/40"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        AI TestGen Pro — generated automation code is provided as source for local execution; it is
        not executed or verified within this app.
      </footer>
    </div>
  );
}
