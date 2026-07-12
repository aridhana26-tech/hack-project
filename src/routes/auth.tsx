import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Loader2, Mail, UserRoundCog } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGuestMode } from "@/lib/guest-mode";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AI TestGen Pro" },
      { name: "description", content: "Sign in or create your AI TestGen Pro account." },
    ],
  }),
  component: AuthPage,
});

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak", color: "bg-destructive" };
  if (score <= 3) return { score, label: "Fair", color: "bg-warning" };
  return { score, label: "Strong", color: "bg-success" };
}

function GoogleButton({ disabled }: { disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    // Load Google Identity Services script dynamically
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!scriptLoaded) return;

    const interval = setInterval(() => {
      if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
        clearInterval(interval);
        try {
          (window as any).google.accounts.id.initialize({
            client_id: "172766196950-opbau7fj77mau1g09t8vf7ql44ipthn5.apps.googleusercontent.com",
            callback: async (response: any) => {
              setLoading(true);
              try {
                const { data, error } = await supabase.auth.signInWithIdToken({
                  provider: "google",
                  token: response.credential,
                });
                if (error) {
                  console.error("ID Token login error, falling back", error);
                  // Try OAuth fallback
                  await handleGoogleOAuthFallback();
                  return;
                }
                toast.success("Welcome!");
                navigate({ to: "/dashboard" });
              } catch (err) {
                console.error("ID token auth exception, falling back", err);
                await handleGoogleOAuthFallback();
              } finally {
                setLoading(false);
              }
            },
          });

          (window as any).google.accounts.id.renderButton(
            document.getElementById("google-signin-btn"),
            { theme: "outline", size: "large", width: 360, text: "continue_with" }
          );
        } catch (e) {
          console.error("Failed to render Google button:", e);
        }
      }
    }, 300);

    return () => clearInterval(interval);
  }, [scriptLoaded, navigate]);

  const handleGoogleOAuthFallback = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) {
        toast.error(`Google Sign-In failed: ${error.message}`);
      }
    } catch (err) {
      toast.error("Google Sign-In failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center gap-2">
      {loading ? (
        <Button variant="outline" className="w-full gap-2" disabled>
          <Loader2 className="h-4 w-4 animate-spin" /> Authenticating...
        </Button>
      ) : (
        <>
          <div id="google-signin-btn" className="w-full min-h-[40px] flex justify-center items-center" />
          <Button
            type="button"
            variant="ghost"
            className="text-xs text-muted-foreground hover:text-primary transition-all w-full"
            onClick={handleGoogleOAuthFallback}
            disabled={disabled}
          >
            Or use default redirect auth
          </Button>
        </>
      )}
    </div>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { enableGuestMode } = useGuestMode();

  // Sign in state
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  // Sign up state
  const [fullName, setFullName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const strength = useMemo(() => passwordStrength(signUpPassword), [signUpPassword]);

  // Forgot password
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const finishSignIn = async () => {
    // Check if 2FA (TOTP) is required for this account
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      setMfaRequired(true);
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: signInEmail.trim(),
        password: signInPassword,
      });
      if (error) {
        toast.error(
          error.message.includes("Invalid login credentials")
            ? "Incorrect email or password."
            : error.message,
        );
        return;
      }
      await finishSignIn();
    } catch {
      toast.error("Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (fErr || !totp) {
        toast.error("Could not find your authenticator. Contact support.");
        return;
      }
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
        factorId: totp.id,
      });
      if (cErr || !challenge) {
        toast.error("Could not start 2FA verification.");
        return;
      }
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: totp.id,
        challengeId: challenge.id,
        code: mfaCode.trim(),
      });
      if (vErr) {
        toast.error("Invalid code. Please try again.");
        return;
      }
      toast.success("Welcome back!");
      navigate({ to: "/dashboard" });
    } catch {
      toast.error("2FA verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (signUpPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail.trim(),
        password: signUpPassword,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast.error(
          error.message.includes("already registered")
            ? "This email is already registered. Try signing in instead."
            : error.message,
        );
        return;
      }
      if (data.session) {
        toast.success("Account created!");
        navigate({ to: "/dashboard" });
      } else {
        toast.success("Account created! Check your email to confirm your address.");
      }
    } catch {
      toast.error("Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password reset email sent. Check your inbox.");
      setForgotOpen(false);
    } catch {
      toast.error("Could not send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground glow-primary">
            <FlaskConical className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">AI TestGen Pro</h1>
          <p className="text-sm text-muted-foreground">AI-powered test design & automation</p>
        </div>

        {mfaRequired ? (
          <Card>
            <CardHeader>
              <CardTitle>Two-factor authentication</CardTitle>
              <CardDescription>Enter the 6-digit code from your authenticator app.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMfaVerify} className="space-y-4">
                <Input
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  placeholder="123456"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                />
                <Button type="submit" className="w-full" disabled={loading || mfaCode.length !== 6}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <Card>
                <CardHeader>
                  <CardTitle>Welcome back</CardTitle>
                  <CardDescription>Sign in to your account to continue.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <GoogleButton disabled={loading} />
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or</span>
                    </div>
                  </div>
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="you@company.com"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signin-password">Password</Label>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => setForgotOpen(true)}
                        >
                          Forgot password?
                        </button>
                      </div>
                      <Input
                        id="signin-password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign in
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="signup">
              <Card>
                <CardHeader>
                  <CardTitle>Create your account</CardTitle>
                  <CardDescription>Start generating test suites in minutes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <GoogleButton disabled={loading} />
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or</span>
                    </div>
                  </div>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full name</Label>
                      <Input
                        id="signup-name"
                        required
                        autoComplete="name"
                        placeholder="Jane Tester"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="you@company.com"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="Min. 8 characters"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                      />
                      {signUpPassword.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex h-1.5 gap-1">
                            {[0, 1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className={`h-full flex-1 rounded-full transition-colors ${
                                  i < strength.score ? strength.color : "bg-muted"
                                }`}
                              />
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Password strength: {strength.label}
                          </p>
                        </div>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create account
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Guest mode option */}
        {!mfaRequired && (
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or skip sign-in</span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="mt-4 w-full gap-2 border border-dashed border-primary/30 hover:bg-primary/10 hover:text-primary transition-all"
              onClick={() => {
                enableGuestMode();
                toast.success("Welcome, Guest! Some features may be limited.");
                navigate({ to: "/dashboard" });
              }}
            >
              <UserRoundCog className="h-4 w-4" />
              Continue as Guest
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Guest mode — your data won't be saved between sessions.
            </p>
          </div>
        )}

        <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Reset your password</DialogTitle>
              <DialogDescription>
                We'll email you a link to set a new password.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send reset link
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
