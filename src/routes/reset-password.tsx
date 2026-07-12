import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — AI TestGen Pro" },
      { name: "description", content: "Set a new password for your AI TestGen Pro account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      // The recovery link signs the user in with a temporary session.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setReady("ok");
        return;
      }
      // Give detectSessionInUrl a moment to process the hash
      setTimeout(async () => {
        const { data: again } = await supabase.auth.getSession();
        if (!cancelled) setReady(again.session ? "ok" : "invalid");
      }, 1500);
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/dashboard", replace: true });
    } catch {
      toast.error("Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <KeyRound className="h-5 w-5" />
          </div>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>
            {ready === "invalid"
              ? "This reset link is invalid or has expired."
              : "Choose a new password for your account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ready === "checking" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying reset link…
            </div>
          )}
          {ready === "invalid" && (
            <Link to="/auth">
              <Button variant="outline" className="w-full">
                Back to sign in
              </Button>
            </Link>
          )}
          {ready === "ok" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
