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
    else if (roles.includes("reseller") || roles.includes("leader"))
      nav({ to: "/reseller", replace: true });
  }, [loading, roles, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("resellers").insert({
        user_id: user.id,
        business_name: businessName,
        code: code.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        contact_phone: phone,
        status: "pending",
      });
      if (error) throw error;
      setStatus("pending");
      toast.success("Application submitted! Admin will review it shortly.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (status === "pending") {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="surface-card max-w-md p-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-warning/20 text-warning-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <h1 className="text-xl font-semibold">Application under review</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ekjon super admin apnar reseller application review korchen. Approve holei
            apni dashboard e access paben.
          </p>
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
                Nijer store setup korun 2 minute e
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
            <button
              disabled={busy}
              className="btn-brand flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium disabled:opacity-50"
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
