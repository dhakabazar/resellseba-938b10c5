import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { ShoppingBag, TrendingUp, ClipboardList, Wallet } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/reseller/")({
  component: ResellerDashboard,
});

type DailyRow = { day: string; orders: number; profit: number };

function ResellerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ listings: 0, orders30: 0, profit30: 0, payoutDue: 0 });
  const [daily, setDaily] = useState<DailyRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: r } = await supabase.from("resellers").select("id").eq("user_id", user.id).maybeSingle();
      if (!r) return;
      const since = new Date();
      since.setDate(since.getDate() - 29);
      const sinceIso = since.toISOString().slice(0, 10);

      const [{ count: listings }, orders, summary] = await Promise.all([
        supabase.from("reseller_listings").select("*", { count: "exact", head: true }).eq("reseller_id", r.id),
        supabase
          .from("orders")
          .select("total,reseller_profit,status,created_at")
          .eq("reseller_id", r.id)
          .gte("created_at", sinceIso),
        supabase.rpc("reseller_profit_summary", { _reseller_id: r.id }),
      ]);

      const rows = (orders.data ?? []) as Array<{ total: number; reseller_profit: number; status: string; created_at: string }>;
      const byDay = new Map<string, DailyRow>();
      for (let i = 0; i < 30; i++) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        const key = d.toISOString().slice(5, 10);
        byDay.set(key, { day: key, orders: 0, profit: 0 });
      }
      let profit = 0;
      for (const o of rows) {
        const key = o.created_at.slice(5, 10);
        const b = byDay.get(key);
        if (b) {
          b.orders += 1;
          if (o.status === "delivered") b.profit += Number(o.reseller_profit);
        }
        if (o.status === "delivered") profit += Number(o.reseller_profit);
      }
      setDaily(Array.from(byDay.values()));

      const s = Array.isArray(summary.data) ? summary.data[0] : summary.data;
      setStats({
        listings: listings ?? 0,
        orders30: rows.length,
        profit30: profit,
        payoutDue: Number((s as { available_balance?: number } | null)?.available_balance ?? 0),
      });
    })();
  }, [user]);

  return (
    <div>
      <PageHeader title="Welcome back" description="Apnar store er quick overview — listing, orders, income." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active listings" value={stats.listings} icon={<ShoppingBag className="h-4 w-4" />} />
        <StatCard label="Orders (30d)" value={stats.orders30} icon={<ClipboardList className="h-4 w-4" />} />
        <StatCard label="Profit (30d)" value={`৳${stats.profit30.toLocaleString()}`} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Available payout" value={`৳${stats.payoutDue.toLocaleString()}`} icon={<Wallet className="h-4 w-4" />} />
      </div>

      <div className="mt-8 surface-card p-5">
        <div className="mb-3 text-sm font-semibold">Daily orders & profit</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Area type="monotone" dataKey="orders" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="Orders" />
              <Area type="monotone" dataKey="profit" stroke="hsl(142 76% 36%)" fill="hsl(142 76% 36% / 0.15)" name="Profit ৳" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
