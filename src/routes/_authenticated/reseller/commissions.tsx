import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/ui-kit";
import { Loader2, Users, Wallet } from "lucide-react";

type Row = {
  id: string;
  amount: number;
  base_profit: number;
  rate: number;
  status: string;
  created_at: string;
  reseller: { business_name: string; code: string } | null;
  order: { order_number: string } | null;
};

export const Route = createFileRoute("/_authenticated/reseller/commissions")({
  component: LeaderCommissionsPage,
});

function LeaderCommissionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("leader_commissions")
        .select("id,amount,base_profit,rate,status,created_at,reseller:resellers!leader_commissions_reseller_id_fkey(business_name,code),order:orders(order_number)")
        .order("created_at", { ascending: false });
      setRows((data ?? []) as unknown as Row[]);
      setLoading(false);
    })();
  }, []);

  const pending = rows.filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.amount), 0);
  const paid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0);
  const downlines = new Set(rows.map((r) => r.reseller?.code).filter(Boolean)).size;

  return (
    <div>
      <PageHeader title="My leader commissions" description="Apnar downline reseller der theke commission." />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Pending" value={`৳${pending.toLocaleString()}`} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Paid to date" value={`৳${paid.toLocaleString()}`} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Active downlines" value={downlines} icon={<Users className="h-4 w-4" />} />
      </div>
      {loading ? (
        <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <EmptyState title="No commissions yet" description="Apnar downline reseller der order delivered hole ekhane ashbe." />
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="hidden grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <div>Order</div><div>Reseller</div><div>Base profit</div><div>Rate</div><div>Commission</div>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-1 items-center gap-2 border-b px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_1fr_1fr_1fr_1fr]">
              <div className="font-mono text-xs">{r.order?.order_number}</div>
              <div>{r.reseller?.business_name}</div>
              <div>৳{Number(r.base_profit).toFixed(0)}</div>
              <div>{r.rate}%</div>
              <div className="flex items-center gap-2 font-semibold">
                ৳{Number(r.amount).toFixed(0)}
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${r.status === "paid" ? "bg-success/20 text-success" : "bg-muted"}`}>{r.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
