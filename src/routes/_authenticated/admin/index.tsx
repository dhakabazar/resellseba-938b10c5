import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { DateRangeBar, DEFAULT_DATE_RANGE, resolveRange, type DateRangeState } from "@/components/date-range-filter";
import { bdt } from "@/lib/finance-report";
import { Package, Users, ShoppingCart, Tag, TrendingUp, Wallet, Loader2, RefreshCw } from "lucide-react";
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
type OrderRow = {
  total: number | string;
  reseller_profit: number | string;
  sa_cost_total: number | string;
  created_at: string;
  status: string;
  resellers: { business_name: string } | null;
};

function AdminDashboard() {
  const [range, setRange] = useState<DateRangeState>(DEFAULT_DATE_RANGE);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ products: 0, resellers: 0, pendingResellers: 0, brands: 0 });
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [lifetime, setLifetime] = useState({
    orders: 0,
    revenue: 0,
    profit: 0,
    saCost: 0,
    deliveredOrders: 0,
    payoutPaid: 0,
    payoutDue: 0,
  });

  const load = useCallback(async (r: DateRangeState) => {
    setLoading(true);
    const { fromTs, toTs } = resolveRange(r);
    let oq = supabase
      .from("orders")
      .select("total,reseller_profit,sa_cost_total,created_at,status,resellers(business_name)");
    if (fromTs != null) oq = oq.gte("created_at", new Date(fromTs).toISOString());
    if (toTs != null) oq = oq.lte("created_at", new Date(toTs).toISOString());

    const [p, res, pr, b, orders] = await Promise.all([
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase.from("resellers").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("resellers").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("brands").select("*", { count: "exact", head: true }),
      oq.order("created_at", { ascending: false }).limit(5000),
    ]);

    setCounts({
      products: p.count ?? 0,
      resellers: res.count ?? 0,
      pendingResellers: pr.count ?? 0,
      brands: b.count ?? 0,
    });
    setRows((orders.data ?? []) as OrderRow[]);
    setLoading(false);
  }, []);

  const loadLifetime = useCallback(async () => {
    const [allOrders, delivered, payoutsRes] = await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }),
      supabase
        .from("orders")
        .select("total,reseller_profit,sa_cost_total")
        .eq("status", "delivered")
        .limit(20000),
      supabase.from("payouts").select("amount,status").limit(20000),
    ]);
    const d = (delivered.data ?? []) as { total: number | string; reseller_profit: number | string; sa_cost_total: number | string }[];
    const pay = (payoutsRes.data ?? []) as { amount: number | string; status: string }[];
    setLifetime({
      orders: allOrders.count ?? 0,
      deliveredOrders: d.length,
      revenue: d.reduce((s, o) => s + Number(o.total), 0),
      profit: d.reduce((s, o) => s + Number(o.reseller_profit), 0),
      saCost: d.reduce((s, o) => s + Number(o.sa_cost_total), 0),
      payoutPaid: pay.filter((x) => x.status === "paid").reduce((s, x) => s + Number(x.amount), 0),
      payoutDue: pay
        .filter((x) => ["pending", "approved"].includes(x.status))
        .reduce((s, x) => s + Number(x.amount), 0),
    });
  }, []);

  useEffect(() => {
    void loadLifetime();
  }, [loadLifetime]);

  useEffect(() => {
    void load(range);
  }, [load, range]);


  const { stats, daily, top } = useMemo(() => {
    const dayMap = new Map<string, DailyRow>();
    const bySeller = new Map<string, number>();
    let orders = 0;
    let revenue = 0;
    let profit = 0;
    let saCost = 0;
    let deliveredOrders = 0;

    for (const o of rows) {
      orders += 1;
      const key = o.created_at.slice(0, 10);
      const d = dayMap.get(key) ?? { day: key.slice(5), orders: 0, revenue: 0, profit: 0 };
      d.orders += 1;
      d.revenue += Number(o.total);
      d.profit += Number(o.reseller_profit);
      dayMap.set(key, d);
      if (o.status === "delivered") {
        deliveredOrders += 1;
        revenue += Number(o.total);
        profit += Number(o.reseller_profit);
        saCost += Number(o.sa_cost_total);
      }
      const name = o.resellers?.business_name ?? "—";
      bySeller.set(name, (bySeller.get(name) ?? 0) + Number(o.total));
    }

    return {
      stats: { orders, revenue, profit, saCost, deliveredOrders },
      daily: Array.from(dayMap.entries())
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([, v]) => v),
      top: Array.from(bySeller.entries())
        .map(([name, sales]) => ({ name, sales }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 6) as ResellerRow[],
    };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        actions={
          <button
            type="button"
            onClick={() => {
              void load(range);
              void loadLifetime();
            }}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        }
      />

      <section className="mb-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total revenue (delivered)"
            value={bdt(lifetime.revenue)}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            label="Total admin earning"
            value={bdt(lifetime.saCost)}
            icon={<Wallet className="h-4 w-4" />}
          />
          <StatCard
            label="Total reseller profit"
            value={bdt(lifetime.profit)}
            icon={<Wallet className="h-4 w-4" />}
          />
          <StatCard
            label="Pending payout"
            value={bdt(lifetime.payoutDue)}
            icon={<Wallet className="h-4 w-4" />}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Products" value={counts.products} icon={<Package className="h-4 w-4" />} />
          <StatCard label="Active resellers" value={counts.resellers} icon={<Users className="h-4 w-4" />} />
          <StatCard label="Brands" value={counts.brands} icon={<Tag className="h-4 w-4" />} />
          <StatCard
            label="Pending applications"
            value={counts.pendingResellers}
            icon={<Users className="h-4 w-4" />}
          />
        </div>
      </section>

      <div className="mb-4 flex justify-end">
        <DateRangeBar value={range} onChange={setRange} compact />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Orders" value={stats.orders} icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard
          label="Revenue (delivered)"
          value={bdt(stats.revenue)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard label="Reseller profit" value={bdt(stats.profit)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard
          label="Admin earning (delivered)"
          value={bdt(stats.saCost)}
          icon={<Wallet className="h-4 w-4" />}
        />
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
                <Area type="monotone" dataKey="profit" stroke="hsl(142 76% 36%)" fill="hsl(142 76% 36% / 0.15)" name="Reseller profit ৳" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-5">
          <div className="mb-3 text-sm font-semibold">Top resellers</div>
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
