import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { Loader2, Check, X, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  component: AdminPayouts,
});

type Row = {
  id: string; amount: number; status: string; method: string | null; reference: string | null;
  notes: string | null; created_at: string; paid_at: string | null;
  reseller: { code: string; business_name: string } | null;
};

function AdminPayouts() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "paid" | "all">("pending");

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    let q = supabase.from("payouts").select("*, reseller:resellers(code, business_name)").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setRows((data ?? []) as any);
    setLoading(false);
  }

  async function updateStatus(id: string, status: "approved" | "paid" | "rejected") {
    const patch: any = { status };
    if (status === "paid") patch.paid_at = new Date().toISOString();
    const { error } = await supabase.from("payouts").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    load();
  }

  return (
    <div>
      <PageHeader title="Payouts" description="Reseller request review korun, bKash/bank e pay korar por 'Paid' e mark korun." />

      <div className="mb-4 flex flex-wrap gap-2">
        {(["pending", "approved", "paid", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={"rounded-full border px-3 py-1 text-xs capitalize transition-colors " + (filter === f ? "border-transparent bg-primary text-primary-foreground" : "hover:bg-muted")}>
            {f}
          </button>
        ))}
      </div>

      {loading ? <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
        <div className="surface-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Reseller</th><th>Amount</th><th>Method</th><th>Account</th><th>Status</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{r.reseller?.business_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">/{r.reseller?.code}</div>
                  </td>
                  <td className="font-semibold">৳{Number(r.amount).toLocaleString()}</td>
                  <td className="capitalize">{r.method}</td>
                  <td className="font-mono text-xs">{r.reference}</td>
                  <td><span className={"rounded-full px-2 py-0.5 text-[10px] " + statusStyle(r.status)}>{r.status}</span></td>
                  <td className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {r.status === "pending" && (
                        <>
                          <button onClick={() => updateStatus(r.id, "approved")} className="rounded-md border px-2 py-1 text-xs hover:bg-muted">Approve</button>
                          <button onClick={() => updateStatus(r.id, "rejected")} className="rounded-md border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"><X className="h-3 w-3" /></button>
                        </>
                      )}
                      {r.status === "approved" && (
                        <button onClick={() => updateStatus(r.id, "paid")} className="btn-brand inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs">
                          <Check className="h-3 w-3" /> Mark paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="p-12 text-center">
                  <Wallet className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No {filter} payouts.</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function statusStyle(s: string) {
  return s === "paid" ? "bg-success/20 text-success"
    : s === "approved" ? "bg-primary/15 text-primary"
    : s === "rejected" ? "bg-destructive/20 text-destructive"
    : "bg-warning/20 text-warning-foreground";
}
