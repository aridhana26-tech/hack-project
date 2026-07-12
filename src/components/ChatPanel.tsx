import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, MessageSquare, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import * as api from "@/lib/api-client";
import type { ChatMessage } from "@/lib/testgen-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const suggestions = [
  "Generate login test cases",
  "Did I miss any edge cases?",
  "Generate SQL validations",
  "Explain TC-001",
];

export function ChatPanel({ analysisId }: { analysisId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chat = (args: { data: { analysisId: string; question: string; history: ChatMessage[] } }) =>
    api.chat(args.data);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
    const history = messages;
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    try {
      const { reply } = await chat({ data: { analysisId, question: q, history } });
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chat request failed.");
      setMessages((prev) => prev.slice(0, -1));
      setInput(q);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex h-[560px] flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-primary" /> QA Copilot
        </CardTitle>
        <CardDescription>Ask follow-up questions about this analysis.</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="space-y-2 pt-4">
              <p className="text-center text-sm text-muted-foreground">Try one of these:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:border-primary/50 hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                    : "max-w-[92%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm"
                }
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&_code]:text-xs [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-background [&_pre]:p-2 [&_table]:text-xs">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 animate-pulse text-primary" /> Thinking…
            </div>
          )}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <Input
            placeholder="Ask about test cases, coverage, SQL…"
            value={input}
            disabled={loading}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
