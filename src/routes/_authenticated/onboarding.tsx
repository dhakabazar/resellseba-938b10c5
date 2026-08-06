import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Store } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Become a reseller — ResellHub" },
      { name: "description", content: "Apply to become a reseller on ResellHub." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { user, roles, loading } = useAuth();
  const nav = useNavigate();
  const [businessName, setBusinessName] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"bkash" | "nagad" | "rocket" | "bank">("bkash");
  const [payoutAccountName, setPayoutAccountName] = useState("");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState("");
  const [payoutBankName, setPayoutBankName] = useState("");
  const [payoutBranch, setPayoutBranch] = useState("");
  const [payoutRouting, setPayoutRouting] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"none" | "pending" | "active" | "suspended" | "rejected">("none");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("resellers")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setStatus(data.status);
      });
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (roles.includes("super_admin")) nav({ to: "/admin", replace: true });
    // Reseller panel only opens after admin approval (status = active)
    else if (status === "active" && (roles.includes("reseller") || roles.includes("leader")))
      nav({ to: "/reseller", replace: true });
  }, [loading, roles, status, nav]);


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const isBank = payoutMethod === "bank";
      const payload = {
        business_name: businessName,
        code: code.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        contact_phone: phone,
        status: "pending" as const,
        payout_method: payoutMethod,
        payout_account_name: payoutAccountName || null,
        payout_account_number: payoutAccountNumber || null,
        payout_bank_name: isBank ? payoutBankName || null : null,
        payout_branch: isBank ? payoutBranch || null : null,
        payout_routing: isBank ? payoutRouting || null : null,
      };
      // Row auto-created at signup — update if exists, else insert.
      const { data: existing } = await supabase
        .from("resellers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const { error } = existing
        ? await supabase.from("resellers").update(payload).eq("user_id", user.id)
        : await supabase.from("resellers").insert({ user_id: user.id, ...payload });
      if (error) throw error;

      setStatus("pending");
      toast.success("Application submitted! Admin will review and approve it.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }


  if (status === "pending" || status === "suspended" || status === "rejected") {
    const info =
      status === "pending"
        ? {
            title: "Pending verification",
            text: "আপনার রেজিস্ট্রেশন সফল হয়েছে। সুপার অ্যাডমিন রিভিউ করে অ্যাপ্রুভ করলেই রিসেলার প্যানেল ওপেন হবে।",
          }
        : status === "suspended"
          ? {
              title: "Account suspended",
              text: "আপনার রিসেলার অ্যাকাউন্ট আপাতত সাসপেন্ড করা আছে। সাপোর্টে যোগাযোগ করুন।",
            }
          : {
              title: "Application rejected",
              text: "আপনার আবেদন অনুমোদন করা হয়নি। বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।",
            };
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="surface-card max-w-md p-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-warning/20 text-warning-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <h1 className="text-xl font-semibold">{info.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{info.text}</p>
          <button
            onClick={() => supabase.auth.signOut().then(() => nav({ to: "/login", replace: true }))}
            className="mt-6 rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }



  return (
    <div
      className="grid min-h-screen place-items-center px-4"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="w-full max-w-lg">
        <div className="surface-card p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary-soft text-primary">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Become a reseller
              </h1>
              <p className="text-sm text-muted-foreground">
                Set up your store in 2 minutes
              </p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Business name</label>
              <input
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="My Fashion Store"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Store code</label>
              <div className="flex items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
                <span className="border-r bg-muted px-3 py-2 text-xs text-muted-foreground">
                  resellhub.com/s/
                </span>
                <input
                  required
                  className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="my-store"
                  pattern="[a-z0-9-]+"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Contact phone</label>
              <input
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
              />
            </div>

            <div className="mt-4 border-t pt-4">
              <div className="mb-2 text-sm font-semibold">Payout information</div>
              <p className="mb-3 text-xs text-muted-foreground">
                We will send your earnings to this account. You can change it later in settings.
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium">Method</label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value as typeof payoutMethod)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium">Account holder name</label>
                  <input
                    value={payoutAccountName}
                    onChange={(e) => setPayoutAccountName(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    {payoutMethod === "bank" ? "Account number" : "Mobile number"}
                  </label>
                  <input
                    value={payoutAccountNumber}
                    onChange={(e) => setPayoutAccountNumber(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder={payoutMethod === "bank" ? "1234567890" : "01XXXXXXXXX"}
                  />
                </div>
              </div>
              {payoutMethod === "bank" && (
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium">Bank name</label>
                    <input
                      value={payoutBankName}
                      onChange={(e) => setPayoutBankName(e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Branch</label>
                    <input
                      value={payoutBranch}
                      onChange={(e) => setPayoutBranch(e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Routing</label>
                    <input
                      value={payoutRouting}
                      onChange={(e) => setPayoutRouting(e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              disabled={busy}
              className="btn-brand mt-4 flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit application
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
