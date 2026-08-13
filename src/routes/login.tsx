import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, ArrowLeft } from "lucide-react";

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

function AuthPage() {
  const nav = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentEmail, setSentEmail] = useState<string | null>(null);

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
        // If email confirmation is required, session will be null
        if (!data.session) {
          setSentEmail(email);
        } else {
          toast.success("অ্যাকাউন্ট তৈরি হয়েছে!");
          nav({ to: "/dashboard", replace: true });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
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

  if (sentEmail) {
    return (
      <div className="grid min-h-screen place-items-center px-4" style={{ background: "var(--gradient-hero)" }}>
        <div className="w-full max-w-md">
          <div className="surface-card p-8 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              <Mail className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-semibold">ইমেইল ভেরিফাই করুন</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              আমরা <span className="font-medium text-foreground">{sentEmail}</span> এ একটি ভেরিফিকেশন লিংক পাঠিয়েছি।
              ইমেইল খুলে লিংকে ক্লিক করুন, তারপর এখানে ফিরে এসে লগইন করুন।
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              (ইমেইল না পেলে স্প্যাম / প্রোমোশন ফোল্ডার চেক করুন)
            </p>
            <button
              onClick={() => {
                setSentEmail(null);
                setMode("signin");
              }}
              className="btn-brand mt-6 inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium"
            >
              লগইন পেজে যান
            </button>
          </div>
        </div>
      </div>
    );
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
                <Field label="আপনার নাম">
                  <input
                    className={inp}
                    placeholder="যেমনঃ রফিকুল ইসলাম"
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
              <input
                type="password"
                className={inp}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
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
