import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendVerificationCode } from "@/lib/verification.functions";
import { fetchAdvancedSettings } from "@/lib/advanced-settings";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    redirect: z.string().optional(),
    mode: z.enum(["signin", "signup"]).optional(),
  }),
  head: () => ({
    meta: [
      { title: "লগইন / রেজিস্টার" },
      { name: "description", content: "আপনার রিসেলার অ্যাকাউন্টে সাইন ইন করুন অথবা নতুন করে রেজিস্টার করুন।" },
      { property: "og:title", content: "লগইন / রেজিস্টার" },
      { property: "og:description", content: "রিসেলার অ্যাকাউন্ট তৈরি করে নিজের স্টোর চালু করুন।" },
    ],
  }),
  component: AuthPage,
});

async function confirmEmailViaRpc(targetEmail: string) {
  try {
    await supabase.rpc("confirm_auth_user_by_email" as any, { _email: targetEmail });
  } catch {
    // Ignore RPC failure if already confirmed or not defined
  }
}

function AuthPage() {
  const nav = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const sendCode = useServerFn(sendVerificationCode);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        const target =
          search.redirect && search.redirect.startsWith("/") && !search.redirect.startsWith("/login")
            ? search.redirect
            : "/dashboard";
        nav({ to: target, replace: true });
      }
    });
  }, [nav, search.redirect]);

  useEffect(() => {
    if (search.mode) setMode(search.mode);
  }, [search.mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
            data: { full_name: name, phone },
          },
        });
        if (error) throw error;

        // Auto-confirm email in auth database so password sign in is never blocked
        await confirmEmailViaRpc(email);

        // Sign in immediately to create an active user session
        let { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) {
          await confirmEmailViaRpc(email);
          const retry = await supabase.auth.signInWithPassword({ email, password });
          signInErr = retry.error;
          if (signInErr) throw signInErr;
        }

        const adv = await fetchAdvancedSettings();
        if (adv.verifyEnabled && (adv.verifyEmail || adv.verifySms)) {
          // Verification is enabled by Admin
          if (adv.verifyEmail) {
            try {
              await sendCode({ data: { channel: "email" } });
            } catch {
              // best effort
            }
          }
          if (adv.verifySms) {
            try {
              await sendCode({ data: { channel: "sms" } });
            } catch {
              // best effort
            }
          }
          toast.success("অ্যাকাউন্ট তৈরি হয়েছে — কোড দিয়ে ভেরিফাই করুন");
          nav({ to: "/verify", replace: true });
        } else {
          // Verification is disabled by Admin -> complete signup, reset and enter dashboard
          setEmail("");
          setPassword("");
          setName("");
          setPhone("");
          toast.success("রেজিস্ট্রেশন সফল হয়েছে — স্বাগতম!");
          nav({ to: "/dashboard", replace: true });
        }
      } else {
        let { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error && error.message.toLowerCase().includes("email not confirmed")) {
          // Auto-confirm via RPC and retry
          await confirmEmailViaRpc(email);
          const retry = await supabase.auth.signInWithPassword({ email, password });
          error = retry.error;
        }
        if (error) throw error;
        toast.success("স্বাগতম!");
        const target =
          search.redirect && search.redirect.startsWith("/") && !search.redirect.startsWith("/login")
            ? search.redirect
            : "/dashboard";
        nav({ to: target, replace: true });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "কিছু একটা সমস্যা হয়েছে");
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="grid min-h-screen place-items-center px-4" style={{ background: "var(--gradient-hero)" }}>
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> হোমপেজে ফিরে যান
        </Link>

        <div className="surface-card p-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isSignup ? "নতুন অ্যাকাউন্ট তৈরি করুন" : "লগইন করুন"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignup
              ? "নিচের তথ্য দিয়ে রেজিস্টার করুন — কয়েক সেকেন্ডেই হয়ে যাবে।"
              : "আপনার ইমেইল ও পাসওয়ার্ড দিয়ে সাইন ইন করুন।"}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            {isSignup && (
              <>
                <Field label="আপনার নাম / Store নাম">
                  <input
                    className={inp}
                    placeholder="যেমনঃ রফিকুল ইসলাম / রফিক স্টোর"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field>
                <Field label="ফোন নাম্বার">
                  <input
                    className={inp}
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </Field>
              </>
            )}
            <Field label="ইমেইল">
              <input
                type="email"
                className={inp}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="পাসওয়ার্ড" hint={isSignup ? "কমপক্ষে ৬ অক্ষর" : undefined}>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className={`${inp} pr-10`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <button
              type="submit"
              disabled={busy}
              className="btn-brand flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignup ? "রেজিস্টার করুন" : "লগইন করুন"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {isSignup ? "আগে থেকে অ্যাকাউন্ট আছে?" : "নতুন এখানে?"}{" "}
            <button
              onClick={() => setMode(isSignup ? "signin" : "signup")}
              className="font-medium text-primary hover:underline"
            >
              {isSignup ? "লগইন করুন" : "রেজিস্টার করুন"}
            </button>
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          সাইন ইন করলেই আপনি আমাদের শর্তাবলি ও প্রাইভেসি পলিসিতে সম্মত হচ্ছেন।
        </p>
      </div>
    </div>
  );
}

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 flex items-center justify-between text-xs font-medium">
        <span>{label}</span>
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
