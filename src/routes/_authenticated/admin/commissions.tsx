import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  amount: number;
  base_profit: number;
  rate: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  leader: { business_name: string; code: string } | null;
  reseller: { business_name: string; code: string } | null;
  order: { order_number: string } | null;
};

export const Route = createFileRoute("/_authenticated/admin/commissions")({
  component: CommissionsPage,
});

function CommissionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("leader_commissions")
      .select("id,amount,base_profit,rate,status,created_at,paid_at,leader:resellers!leader_commissions_leader_id_fkey(business_name,code),reseller:resellers!leader_commissions_reseller_id_fkey(business_name,code),order:orders(order_number)")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function markPaid(id: string) {
    const { error } = await supabase
      .from("leader_commissions")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked paid");
    load();
  }

  return (
    <div>
      <PageHeader title="Leader commissions" description="Downline reseller er delivered order theke auto-calc commission." />
      {loading ? (
        <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <EmptyState title="No commissions yet" description="Leader-assigned resellers order delivered hole ekhane ashbe." />
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="hidden grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <div>Order</div><div>Leader</div><div>Reseller</div><div>Profit</div><div>Rate</div><div>Commission</div><div></div>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-1 items-center gap-2 border-b px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_auto]">
              <div className="font-mono text-xs">{r.order?.order_number}</div>
              <div>{r.leader?.business_name}</div>
              <div>{r.reseller?.business_name}</div>
              <div>৳{Number(r.base_profit).toFixed(0)}</div>
              <div>{r.rate}%</div>
              <div className="font-semibold">৳{Number(r.amount).toFixed(0)}</div>
              <div>
                {r.status === "paid" ? (
                  <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs text-success">Paid</span>
                ) : (
                  <button onClick={() => markPaid(r.id)} className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">
                    Mark paid
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
