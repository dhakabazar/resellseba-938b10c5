import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Reseller = {
  id: string;
  user_id: string;
  business_name: string;
  code: string;
  contact_phone: string | null;
  status: "pending" | "active" | "suspended" | "rejected";
  commission_rate: number;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/resellers")({
  component: ResellersPage,
});

function ResellersPage() {
  const [items, setItems] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "active">("pending");

  async function load() {
    setLoading(true);
    let q = supabase
      .from("resellers")
      .select("id,user_id,business_name,code,contact_phone,status,commission_rate,created_at")
      .order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setItems((data ?? []) as Reseller[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [filter]);

  async function approve(r: Reseller) {
    const { error } = await supabase
      .from("resellers")
      .update({ status: "active", approved_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    await supabase.from("user_roles").upsert(
      { user_id: r.user_id, role: "reseller" },
      { onConflict: "user_id,role" },
    );
    await supabase.from("reseller_settings").upsert(
      { reseller_id: r.id, store_name: r.business_name },
      { onConflict: "reseller_id" },
    );
    toast.success(`${r.business_name} approved`);
    load();
  }

  async function reject(r: Reseller) {
    const { error } = await supabase.from("resellers").update({ status: "rejected" }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    load();
  }

  return (
    <div>
      <PageHeader
        title="Resellers"
        description="Applications review korun. Approve korle reseller role assign hobe."
      />
      <div className="mb-4 inline-flex overflow-hidden rounded-md border">
        {(["pending", "active", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-sm capitalize ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="Nothing here" description="No resellers match this filter." />
      ) : (
        <div className="surface-card divide-y">
          {items.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{r.business_name}</div>
                <div className="text-xs text-muted-foreground">
                  #{r.code} · {r.contact_phone ?? "no phone"} · Commission{" "}
                  {r.commission_rate}%
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                  r.status === "active"
                    ? "bg-success/15 text-success-foreground"
                    : r.status === "pending"
                      ? "bg-warning/20 text-warning-foreground"
                      : "bg-destructive/15 text-destructive"
                }`}
              >
                {r.status}
              </span>
              {r.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approve(r)}
                    className="inline-flex items-center gap-1 rounded-md bg-success px-3 py-1.5 text-xs font-medium text-success-foreground"
                  >
                    <Check className="h-3 w-3" /> Approve
                  </button>
                  <button
                    onClick={() => reject(r)}
                    className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
