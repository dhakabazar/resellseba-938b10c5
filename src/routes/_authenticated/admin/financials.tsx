import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { Loader2, Wallet, TrendingUp, Users, Award, PiggyBank } from "lucide-react";

type OrderRow = {
  reseller_id: string;
  status: string;
  subtotal: number;
  shipping_cost: number;
  total: number;
  sa_cost_total: number;
  reseller_profit: number;
};
type Reseller = { id: string; business_name: string; code: string; leader_id: string | null; commission_rate: number };
type Payout = { reseller_id: string; amount: number; status: string };
type Commission = { leader_id: string; reseller_id: string; amount: number; status: string };

type Aggregate = {
  reseller: Reseller;
  totalOrders: number;
  deliveredOrders: number;
  gross: number;             // customer sell subtotal (delivered)
  adminCost: number;         // admin buying + packaging (delivered)
  shipping: number;          // delivered
  deliveredProfit: number;   // reseller profit (delivered)
  paidOut: number;
  pendingPayout: number;
  available: number;
  leaderCommissionDue: number;
  leaderCommissionPaid: number;
};

export const Route = createFileRoute("/_authenticated/admin/financials")({
  component: FinancialsPage,
});

function FinancialsPage() {
  const [loading, setLoading] = useState(true);
  const [aggregates, setAggregates] = useState<Aggregate[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [resellersRes, ordersRes, payoutsRes, commissionsRes] = await Promise.all([
        supabase.from("resellers").select("id,business_name,code,leader_id,commission_rate"),
        supabase.from("orders").select("reseller_id,status,subtotal,shipping_cost,total,sa_cost_total,reseller_profit"),
        supabase.from("payouts").select("reseller_id,amount,status"),
        supabase.from("leader_commissions").select("leader_id,reseller_id,amount,status"),
      ]);

      const resellers = (resellersRes.data ?? []) as Reseller[];
      const orders = (ordersRes.data ?? []) as OrderRow[];
      const payouts = (payoutsRes.data ?? []) as Payout[];
      const commissions = (commissionsRes.data ?? []) as Commission[];

      const agg = new Map<string, Aggregate>();
      for (const r of resellers) {
        agg.set(r.id, {
          reseller: r, totalOrders: 0, deliveredOrders: 0,
          gross: 0, adminCost: 0, shipping: 0, deliveredProfit: 0,
          paidOut: 0, pendingPayout: 0, available: 0,
          leaderCommissionDue: 0, leaderCommissionPaid: 0,
        });
      }
      for (const o of orders) {
        const a = agg.get(o.reseller_id);
        if (!a) continue;
        a.totalOrders += 1;
        if (o.status === "delivered") {
          a.deliveredOrders += 1;
          a.gross += Number(o.subtotal);
          a.adminCost += Number(o.sa_cost_total);
          a.shipping += Number(o.shipping_cost);
          a.deliveredProfit += Number(o.reseller_profit);
        }
      }
      for (const p of payouts) {
        const a = agg.get(p.reseller_id);
        if (!a) continue;
        if (p.status === "paid") a.paidOut += Number(p.amount);
        else if (p.status === "pending" || p.status === "approved") a.pendingPayout += Number(p.amount);
      }
      for (const c of commissions) {
        const a = agg.get(c.leader_id);
        if (!a) continue;
        if (c.status === "paid") a.leaderCommissionPaid += Number(c.amount);
        else a.leaderCommissionDue += Number(c.amount);
      }
      for (const a of agg.values()) {
        a.available = Math.max(a.deliveredProfit - a.pendingPayout - a.paidOut, 0);
      }
      setAggregates(Array.from(agg.values()).sort((x, y) => y.deliveredProfit - x.deliveredProfit));
      setLoading(false);
    })();
  }, []);

  const totals = useMemo(() => {
    return aggregates.reduce(
      (t, a) => ({
        gross: t.gross + a.gross,
        adminCost: t.adminCost + a.adminCost,
        shipping: t.shipping + a.shipping,
        resellerProfit: t.resellerProfit + a.deliveredProfit,
        paidOut: t.paidOut + a.paidOut,
        pendingPayout: t.pendingPayout + a.pendingPayout,
        available: t.available + a.available,
        leaderDue: t.leaderDue + a.leaderCommissionDue,
        leaderPaid: t.leaderPaid + a.leaderCommissionPaid,
      }),
      { gross: 0, adminCost: 0, shipping: 0, resellerProfit: 0, paidOut: 0, pendingPayout: 0, available: 0, leaderDue: 0, leaderPaid: 0 }
    );
  }, [aggregates]);

  const platformMargin = totals.adminCost; // admin already collected shipping-through, this is buying+packaging revenue
  // Actually admin margin = adminCost - buying_cost. We don't have buying_cost here without an extra join.
  // Show what we have clearly.

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return aggregates;
    return aggregates.filter((a) => a.reseller.business_name.toLowerCase().includes(q) || a.reseller.code.toLowerCase().includes(q));
  }, [aggregates, query]);

  if (loading) return <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <PageHeader title="Financial report" description="Per-reseller profit, payout, r leader commission er full picture." />

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gross sales (delivered)" value={`৳${totals.gross.toLocaleString()}`} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Reseller profit total" value={`৳${totals.resellerProfit.toLocaleString()}`} hint={`Paid ৳${totals.paidOut.toLocaleString()} · Due ৳${totals.available.toLocaleString()}`} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Admin revenue (cost billed)" value={`৳${platformMargin.toLocaleString()}`} hint="Reseller-price + packaging" icon={<PiggyBank className="h-4 w-4" />} />
        <StatCard label="Leader commission due" value={`৳${totals.leaderDue.toLocaleString()}`} hint={`Paid ৳${totals.leaderPaid.toLocaleString()}`} icon={<Award className="h-4 w-4" />} />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reseller name or code…"
          className="w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> {aggregates.length} resellers
        </div>
      </div>

      <div className="surface-card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/40 text-left text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Reseller</th>
              <th className="p-3 text-right">Delivered</th>
              <th className="p-3 text-right">Gross sell</th>
              <th className="p-3 text-right">Admin cost</th>
              <th className="p-3 text-right">Delivery</th>
              <th className="p-3 text-right">Reseller profit</th>
              <th className="p-3 text-right">Paid</th>
              <th className="p-3 text-right">Due</th>
              <th className="p-3 text-right">Leader due</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.reseller.id} className="border-t align-top">
                <td className="p-3">
                  <div className="font-medium">{a.reseller.business_name}</div>
                  <div className="text-[11px] text-muted-foreground">/{a.reseller.code} · {a.reseller.commission_rate}%</div>
                </td>
                <td className="p-3 text-right text-muted-foreground">{a.deliveredOrders}/{a.totalOrders}</td>
                <td className="p-3 text-right">৳{a.gross.toLocaleString()}</td>
                <td className="p-3 text-right text-muted-foreground">৳{a.adminCost.toLocaleString()}</td>
                <td className="p-3 text-right text-muted-foreground">৳{a.shipping.toLocaleString()}</td>
                <td className="p-3 text-right font-semibold text-success">৳{a.deliveredProfit.toLocaleString()}</td>
                <td className="p-3 text-right">৳{a.paidOut.toLocaleString()}</td>
                <td className="p-3 text-right font-medium">৳{a.available.toLocaleString()}</td>
                <td className="p-3 text-right">
                  {a.leaderCommissionDue > 0 || a.leaderCommissionPaid > 0 ? (
                    <div>
                      <div className="font-medium">৳{a.leaderCommissionDue.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground">paid ৳{a.leaderCommissionPaid.toLocaleString()}</div>
                    </div>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No resellers found.</td></tr>
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="border-t bg-muted/30 text-sm font-medium">
              <tr>
                <td className="p-3">Totals</td>
                <td className="p-3 text-right"></td>
                <td className="p-3 text-right">৳{totals.gross.toLocaleString()}</td>
                <td className="p-3 text-right">৳{totals.adminCost.toLocaleString()}</td>
                <td className="p-3 text-right">৳{totals.shipping.toLocaleString()}</td>
                <td className="p-3 text-right text-success">৳{totals.resellerProfit.toLocaleString()}</td>
                <td className="p-3 text-right">৳{totals.paidOut.toLocaleString()}</td>
                <td className="p-3 text-right">৳{totals.available.toLocaleString()}</td>
                <td className="p-3 text-right">৳{totals.leaderDue.toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="mt-6 rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
        <div className="mb-1 font-medium text-foreground">Kivabe calculate hoy</div>
        <ul className="list-disc pl-4 space-y-1">
          <li><b>Gross sell</b> = reseller er selling price × qty (customer j price dey, delivery baade).</li>
          <li><b>Admin cost</b> = (reseller_price + packaging_cost) × qty. Eta admin er reseller er theke pawa amount.</li>
          <li><b>Delivery</b> admin collect kore, courier k dey — profit e count hoy na.</li>
          <li><b>Reseller profit</b> = Gross sell − Admin cost (shudhu delivered order e).</li>
          <li><b>Leader commission</b> = reseller profit × leader er rate% — admin pay kore (delivered hole trigger e create hoy).</li>
        </ul>
      </div>
    </div>
  );
}
