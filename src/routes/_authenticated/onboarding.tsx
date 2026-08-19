import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/use-auth";
import { useVerification } from "@/lib/use-verification";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Store, Mail } from "lucide-react";

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
  const { user, roles, permissions, loading } = useAuth();
  const { required: needsVerify, loading: verifyLoading } = useVerification();
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
  const [storePrefix, setStorePrefix] = useState("/s/");

  useEffect(() => {
    if (!verifyLoading && needsVerify) nav({ to: "/verify", replace: true });
  }, [needsVerify, verifyLoading, nav]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setStorePrefix(`${window.location.host}/s/`);
    }
  }, []);


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
    const isSuperAdmin = roles.includes("super_admin");
    const isStaff = roles.includes("staff");
    
    if (isSuperAdmin || isStaff) {
      nav({ to: "/admin", replace: true });
    } else if (status === "active" && (roles.includes("reseller") || roles.includes("leader"))) {
      nav({ to: "/reseller", replace: true });
    }
  }, [loading, roles, permissions, status, nav]);


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
            title: "Approval pending",
            text: "আপনার রেজিস্ট্রেশন সফল হয়েছে। সুপার অ্যাডমিন আপনার স্টোর চেক করে অনুমোদন দিলে আপনি রিসেলার প্যানেলে অ্যাক্সেস পাবেন।",
          }
        : status === "suspended"
          ? {
              title: "Account deactivated",
              text: "আপনার রিসেলার অ্যাকাউন্ট বর্তমানে ডিঅ্যাক্টিভেট করা আছে। পুনরায় সক্রিয় করতে অ্যাডমিনের সাথে যোগাযোগ করুন।",
            }
          : {
              title: "Application rejected",
              text: "আপনার রিসেলার আবেদনটি এই মুহূর্তে অনুমোদন করা সম্ভব হয়নি। বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।",
            };

    return (
      <div className="grid min-h-screen place-items-center px-4" style={{ background: "var(--gradient-hero)" }}>
        <div className="w-full max-w-md">
          <div className="surface-card p-8 text-center shadow-elegant">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              {status === "pending" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Store className="h-6 w-6 opacity-40" />}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{info.title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{info.text}</p>
            
            <div className="mt-8 grid grid-cols-2 gap-3">
              <ContactButton variant="whatsapp" />
              <ContactButton variant="email" />
            </div>

            <div className="mt-8 border-t pt-6">
              <button
                onClick={() => supabase.auth.signOut().then(() => nav({ to: "/login", replace: true }))}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign out from this account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

function ContactButton({ variant }: { variant: "whatsapp" | "email" }) {
  const [contact, setContact] = useState<{ phone: string | null; email: string | null } | null>(null);

  useEffect(() => {
    supabase.from("global_settings").select("contact_phone, contact_email").eq("id", 1).maybeSingle()
      .then(({ data }) => setContact({ phone: data?.contact_phone ?? null, email: data?.contact_email ?? null }));
  }, []);

  if (variant === "whatsapp") {
    const phone = contact?.phone?.replace(/\D/g, "");
    if (!phone) return null;
    return (
      <a
        href={`https://wa.me/${phone}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366]/10 py-2.5 text-xs font-semibold text-[#25D366] transition hover:bg-[#25D366]/20"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
        WhatsApp
      </a>
    );
  }

  if (variant === "email") {
    if (!contact?.email) return null;
    return (
      <a
        href={`mailto:${contact.email}`}
        className="flex items-center justify-center gap-2 rounded-lg bg-primary/10 py-2.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
      >
        <Mail className="h-4 w-4" />
        Email Support
      </a>
    );
  }

  return null;
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
                  {storePrefix}
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
