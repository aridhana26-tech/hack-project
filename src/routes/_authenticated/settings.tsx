import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, LogOut, Moon, ShieldCheck, Sun, Trash2, Upload, AlertTriangle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { deleteAccountFn } from "@/lib/testgen.functions";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { useGuestMode } from "@/lib/guest-mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const languages = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी (Hindi)" },
  { value: "fr", label: "Français (French)" },
  { value: "es", label: "Español (Spanish)" },
  { value: "de", label: "Deutsch (German)" },
];

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const deleteAccount = useServerFn(deleteAccountFn);
  const { isGuest, disableGuestMode } = useGuestMode();

  const [theme, setTheme] = useState<Theme>("dark");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Change password dialog
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // 2FA
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollQr, setEnrollQr] = useState<string | null>(null);
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  const [deleting, setDeleting] = useState(false);

  const [langState, setLangState] = useState(() => {
    try {
      return localStorage.getItem("preferred-language") || "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => setTheme(getStoredTheme()), []);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .maybeSingle();
      return { user: userData.user, profile: data };
    },
    enabled: !isGuest,
  });

  useEffect(() => {
    if (isGuest) {
      setName("Guest User");
      setEmail("");
      return;
    }
    if (!profile) return;
    setName(profile.profile?.full_name ?? (profile.user.user_metadata?.full_name as string) ?? "");
    setEmail(profile.user.email ?? "");
    const path = profile.profile?.avatar_url;
    if (path) {
      supabase.storage
        .from("avatars")
        .createSignedUrl(path, 3600)
        .then(({ data }) => setAvatarUrl(data?.signedUrl ?? null));
    }
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setMfaEnabled((data?.totp ?? []).some((f) => f.status === "verified"));
    });
  }, [profile, isGuest]);

  const saveProfile = async () => {
    if (isGuest) {
      toast.info("Cannot save profile in guest mode.");
      return;
    }
    if (!profile) return;
    setSaving(true);
    try {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ full_name: name.trim() })
        .eq("id", profile.user.id);
      if (pErr) throw pErr;
      await supabase.auth.updateUser({ data: { full_name: name.trim() } });
      if (email.trim() && email.trim() !== profile.user.email) {
        const { error: eErr } = await supabase.auth.updateUser({ email: email.trim() });
        if (eErr) throw eErr;
        toast.info("Check your new email inbox to confirm the address change.");
      }
      toast.success("Profile saved.");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!profile) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Avatar must be under 2MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${profile.user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      await supabase.from("profiles").update({ avatar_url: path }).eq("id", profile.user.id);
      const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
      setAvatarUrl(data?.signedUrl ?? null);
      toast.success("Profile picture updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Avatar upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success("Password changed.");
      setPwOpen(false);
      setNewPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setPwLoading(false);
    }
  };

  const startEnroll = async () => {
    setMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error || !data) throw error ?? new Error("Enroll failed");
      setEnrollFactorId(data.id);
      setEnrollQr(data.totp.qr_code);
      setEnrollOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start 2FA setup.");
    } finally {
      setMfaLoading(false);
    }
  };

  const verifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollFactorId) return;
    setMfaLoading(true);
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
        factorId: enrollFactorId,
      });
      if (cErr || !challenge) throw cErr ?? new Error("Challenge failed");
      const { error } = await supabase.auth.mfa.verify({
        factorId: enrollFactorId,
        challengeId: challenge.id,
        code: enrollCode.trim(),
      });
      if (error) throw error;
      setMfaEnabled(true);
      setEnrollOpen(false);
      setEnrollCode("");
      toast.success("Two-factor authentication enabled.");
    } catch {
      toast.error("Invalid code. Please try again.");
    } finally {
      setMfaLoading(false);
    }
  };

  const disableMfa = async () => {
    setMfaLoading(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      for (const f of data?.totp ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      setMfaEnabled(false);
      toast.success("Two-factor authentication disabled.");
    } catch {
      toast.error("Failed to disable 2FA.");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleLogout = async () => {
    if (isGuest) {
      disableGuestMode();
      navigate({ to: "/", replace: true });
      return;
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const handleDeleteAccount = async () => {
    if (isGuest) {
      toast.info("Cannot delete account in guest mode.");
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount({});
      await supabase.auth.signOut();
      queryClient.clear();
      toast.success("Your account has been deleted.");
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Account deletion failed.");
    } finally {
      setDeleting(false);
    }
  };

  const setLanguage = async (lang: string) => {
    setLangState(lang);
    try {
      localStorage.setItem("preferred-language", lang);
    } catch (e) {
      // ignore
    }
    if (isGuest) {
      toast.success("Language preference saved.");
      return;
    }
    if (!profile) return;
    const { error } = await supabase.from("profiles").update({ language: lang }).eq("id", profile.user.id);
    if (error) toast.error("Failed to save language.");
    else {
      toast.success("Language preference saved.");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
  };

  const initials = (name || email || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Settings</h1>
        <p className="mt-1 text-muted-foreground">Manage your profile, preferences and account.</p>
      </div>

      {isGuest && (
        <Alert className="border-warning/40 bg-accent/30">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle>Guest Mode</AlertTitle>
          <AlertDescription>
            You are currently browsing as a Guest. Profile editing, password change, and MFA security settings are disabled.
          </AlertDescription>
        </Alert>
      )}

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
          <CardDescription>Your name, email and profile picture.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile picture" />}
              <AvatarFallback className="bg-accent text-accent-foreground">{initials}</AvatarFallback>
            </Avatar>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            />
            <Button variant="outline" size="sm" className="gap-2" disabled={isGuest || uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Change picture
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="set-name">Full name</Label>
              <Input id="set-name" value={name} disabled={isGuest} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="set-email">Email</Label>
              <Input id="set-email" type="email" value={email} disabled={isGuest} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <Button onClick={saveProfile} disabled={isGuest || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </CardContent>
      </Card>

      {/* Appearance & language */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preferences</CardTitle>
          <CardDescription>Appearance and language.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <div>
                <p className="text-sm font-medium">Dark mode</p>
                <p className="text-xs text-muted-foreground">Dark theme is the default.</p>
              </div>
            </div>
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(checked) => {
                const t: Theme = checked ? "dark" : "light";
                setTheme(t);
                applyTheme(t);
              }}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Language</p>
              <p className="text-xs text-muted-foreground">Preferred interface language.</p>
            </div>
            <Select
              value={isGuest ? langState : (profile?.profile?.language ?? "en")}
              onValueChange={setLanguage}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security</CardTitle>
          <CardDescription>Password and two-factor authentication.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">Change your account password.</p>
            </div>
            <Button variant="outline" size="sm" disabled={isGuest} onClick={() => setPwOpen(true)}>
              Change password
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className={`h-4 w-4 ${mfaEnabled ? "text-success" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm font-medium">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">
                  {mfaEnabled ? "Enabled with an authenticator app." : "Add a TOTP authenticator app."}
                </p>
              </div>
            </div>
            {mfaEnabled ? (
              <Button variant="outline" size="sm" onClick={disableMfa} disabled={isGuest || mfaLoading}>
                Disable
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={startEnroll} disabled={isGuest || mfaLoading}>
                Enable
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">App version</span>
            <span className="font-mono">v1.0.0</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Help & Support</span>
            <a href="mailto:support@testgenpro.app" className="text-primary hover:underline">
              support@testgenpro.app
            </a>
          </div>
          <Separator />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <strong>Privacy Policy:</strong> Your requirement documents and analysis results are
            stored privately in your account and are only used to generate your test artifacts.
            <br />
            <strong>Terms & Conditions:</strong> Generated code and test cases are provided as-is
            for you to review and run in your own environment; they are not executed or verified by
            this app.
          </p>
        </CardContent>
      </Card>

      {/* Account */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
          <CardDescription>{isGuest ? "Exit guest session." : "Log out or permanently delete your account."}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" className="gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> {isGuest ? "Exit guest mode" : "Log out"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2" disabled={isGuest || deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes your account, profile and all analyses. This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDeleteAccount}
                >
                  Delete permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Change password dialog */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Enter a new password (min. 8 characters).</DialogDescription>
          </DialogHeader>
          <form onSubmit={changePassword} className="space-y-4">
            <Input
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              placeholder="New password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <Button type="submit" className="w-full" disabled={pwLoading}>
              {pwLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update password
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2FA enroll dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
            <DialogDescription>
              Scan this QR code with your authenticator app, then enter the 6-digit code.
            </DialogDescription>
          </DialogHeader>
          {enrollQr && (
            <div className="flex justify-center rounded-lg bg-white p-4">
              <img src={enrollQr} alt="2FA QR code" className="h-44 w-44" />
            </div>
          )}
          <form onSubmit={verifyEnroll} className="space-y-4">
            <Input
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="123456"
              value={enrollCode}
              onChange={(e) => setEnrollCode(e.target.value)}
            />
            <Button type="submit" className="w-full" disabled={mfaLoading || enrollCode.length !== 6}>
              {mfaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify & enable
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
