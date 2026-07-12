import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/_authenticated/api-tester")({
  component: ApiTesterPage,
});

function ApiTesterPage() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("http://localhost:8000/api/analyses");
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    setResponse("");
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setResponse(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-2">
          <Terminal className="h-6 w-6 text-primary" /> API Tester
        </h1>
        <p className="mt-1 text-muted-foreground">
          Quickly test and run backend endpoints right from the dashboard.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">HTTP Request Panel</CardTitle>
          <CardDescription>Enter method, URL endpoint, and click send.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:8000/api/..."
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={loading} className="gap-1.5">
              <Send className="h-4 w-4" /> Send
            </Button>
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Response Output</label>
            <ScrollArea className="h-[340px] w-full rounded-md border bg-muted/40 font-mono text-xs p-4">
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Terminal className="h-4 w-4 animate-spin" /> Querying API endpoint...
                </div>
              ) : response ? (
                <pre>{response}</pre>
              ) : (
                <span className="text-muted-foreground">No response triggered yet.</span>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
