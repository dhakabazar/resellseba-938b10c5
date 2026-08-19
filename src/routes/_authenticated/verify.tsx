import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sendVerificationCode } from "@/lib/verification.functions";
import { useVerification } from "@/lib/use-verification";
import { toast } from "sonner";
import { Loader2, Mail, Smartphone, ShieldCheck, Send, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/verify")({
  component: VerifyPage,
  head: () => ({
    meta: [
      { title: "অ্যাকাউন্ট ভেরিফাই করুন" },
      { name: "description", content: "রেজিস্ট্রেশন শেষ করতে ইমেইল ও মোবাইল নাম্বারে পাঠানো কোড দিয়ে ভেরিফাই করুন।" },
      { property: "og:title", content: "অ্যাকাউন্ট ভেরিফাই করুন" },
      { property: "og:description", content: "ভেরিফিকেশন কোড দিয়ে অ্যাকাউন্ট চালু করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function VerifyPage() {
  const nav = useNavigate();
  const send = useServerFn(sendVerificationCode);
  const { pending, loading, refresh } = useVerification();
  const [busy, setBusy] = useState<string | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({ email: "", sms: "" });

  useEffect(() => {
    if (!loading && pending.length === 0) nav({ to: "/dashboard", replace: true });
  }, [loading, pending.length, nav]);

  async function request(channel: "email" | "sms") {
    setBusy(`send-${channel}`);
    try {
      const res = await send({ data: { channel } });
      if (!res.ok) toast.error(res.error ?? "Could not send the code");
      else toast.success(`কোড পাঠানো হয়েছে — ${res.target}`);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send the code");
    } finally {
      setBusy(null);
    }
  }

  async function check(channel: "email" | "sms") {
    const code = (codes[channel] ?? "").trim();
    if (code.length < 4) return toast.error("কোডটি লিখুন");
    setBusy(`check-${channel}`);
    const { data, error } = await supabase.rpc("verify_check", { _channel: channel, _code: code });
    setBusy(null);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("কোড মেলেনি বা সময় শেষ — আবার কোড নিন");
    toast.success("ভেরিফাই হয়েছে!");
    setCodes((c) => ({ ...c, [channel]: "" }));
    await refresh();
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10" style={{ background: "var(--gradient-hero)" }}>
      <div className="w-full max-w-md">
        <div className="surface-card p-7">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-center text-2xl font-semibold tracking-tight">অ্যাকাউন্ট ভেরিফাই করুন</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            প্যানেলে ঢোকার আগে নিচের ধাপগুলো শেষ করুন।
          </p>

          <div className="mt-6 space-y-4">
            {pending.map((channel) => (
              <div key={channel} className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {channel === "email" ? <Mail className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                  {channel === "email" ? "ইমেইল ভেরিফিকেশন" : "মোবাইল (SMS) ভেরিফিকেশন"}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm tracking-[0.3em] outline-none focus:ring-2 focus:ring-ring"
                    placeholder="৬ ডিজিট কোড"
                    inputMode="numeric"
                    maxLength={6}
                    value={codes[channel] ?? ""}
                    onChange={(e) => setCodes((c) => ({ ...c, [channel]: e.target.value.replace(/\D/g, "") }))}
                  />
                  <button
                    onClick={() => check(channel)}
                    disabled={busy !== null}
                    className="btn-brand inline-flex shrink-0 items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {busy === `check-${channel}` && <Loader2 className="h-4 w-4 animate-spin" />} ভেরিফাই
                  </button>
                </div>
                <button
                  onClick={() => request(channel)}
                  disabled={busy !== null}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  {busy === `send-${channel}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  কোড পাঠান / আবার পাঠান
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              nav({ to: "/login", replace: true });
            }}
            className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> লগআউট
          </button>
        </div>
      </div>
    </div>
  );
}
