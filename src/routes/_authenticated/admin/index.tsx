import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { Package, Users, ShoppingCart, Tag, TrendingUp, Wallet } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

type DailyRow = { day: string; orders: number; revenue: number; profit: number };
type ResellerRow = { name: string; sales: number };

function AdminDashboard() {
  const [stats, setStats] = useState({
    products: 0,
    resellers: 0,
    pendingResellers: 0,
    brands: 0,
    ordersToday: 0,
    revenue30: 0,
    profit30: 0,
  });
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [top, setTop] = useState<ResellerRow[]>([]);

  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 29);
      const sinceIso = since.toISOString().slice(0, 10);

      const [p, r, pr, b, oToday, orders] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("resellers").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("resellers").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("brands").select("*", { count: "exact", head: true }),
        supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .gte("created_at", new Date().toISOString().slice(0, 10)),
        supabase
          .from("orders")
          .select("id,total,reseller_profit,created_at,status,reseller_id,resellers(business_name)")
          .gte("created_at", sinceIso),
      ]);

      const rows = (orders.data ?? []) as Array<{ total: number; reseller_profit: number; created_at: string; status: string; resellers: { business_name: string } | null }>;
      const byDay = new Map<string, DailyRow>();
      for (let i = 0; i < 30; i++) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        const key = d.toISOString().slice(5, 10);
        byDay.set(key, { day: key, orders: 0, revenue: 0, profit: 0 });
      }
      let totalRev = 0;
      let totalProfit = 0;
      const bySeller = new Map<string, number>();
      for (const o of rows) {
        const key = o.created_at.slice(5, 10);
        const b = byDay.get(key);
        if (b) {
          b.orders += 1;
          b.revenue += Number(o.total);
          b.profit += Number(o.reseller_profit);
        }
        if (o.status === "delivered") {
          totalRev += Number(o.total);
          totalProfit += Number(o.reseller_profit);
        }
        const name = o.resellers?.business_name ?? "—";
        bySeller.set(name, (bySeller.get(name) ?? 0) + Number(o.total));
      }
      setDaily(Array.from(byDay.values()));
      setTop(
        Array.from(bySeller.entries())
          .map(([name, sales]) => ({ name, sales }))
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 6),
      );
      setStats({
        products: p.count ?? 0,
        resellers: r.count ?? 0,
        pendingResellers: pr.count ?? 0,
        brands: b.count ?? 0,
        ordersToday: oToday.count ?? 0,
        revenue30: totalRev,
        profit30: totalProfit,
      });
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="30-day overview — sales, orders, top resellers."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Orders today" value={stats.ordersToday} icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard label="Revenue (30d, delivered)" value={`৳${stats.revenue30.toLocaleString()}`} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Reseller profit (30d)" value={`৳${stats.profit30.toLocaleString()}`} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Pending applications" value={stats.pendingResellers} hint="Needs review" icon={<Users className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Products" value={stats.products} icon={<Package className="h-4 w-4" />} />
        <StatCard label="Active resellers" value={stats.resellers} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Brands" value={stats.brands} icon={<Tag className="h-4 w-4" />} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="surface-card p-5">
          <div className="mb-3 text-sm font-semibold">Daily orders & revenue</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="Revenue ৳" />
                <Area type="monotone" dataKey="profit" stroke="hsl(var(--success, 142 76% 36%))" fill="hsl(142 76% 36% / 0.15)" name="Profit ৳" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-5">
          <div className="mb-3 text-sm font-semibold">Top resellers (30d)</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
