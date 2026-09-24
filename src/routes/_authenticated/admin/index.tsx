import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAdminDashboard, getAdminLookups, clearBootstrapCache } from "@/lib/bootstrap";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { DateRangeBar, DEFAULT_DATE_RANGE, resolveRange, type DateRangeState } from "@/components/date-range-filter";
import { bdt, buildFinanceReport, isRealizedStatus, orderProfit, PROFIT_FORMULA_HINT, type FinanceReport, type ReportOrder } from "@/lib/finance-report";
import { ORDER_TABS } from "@/lib/courier-status";
import { Package, Users, ShoppingCart, Tag, TrendingUp, Wallet, Loader2, RefreshCw, Award, Clock, Plus } from "lucide-react";
import { NewOrderModal } from "@/components/NewOrderModal";
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
  Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

type DailyRow = { day: string; orders: number; revenue: number; profit: number };
type ResellerRow = { name: string; sales: number };

const BAR_PALETTE: { from: string; to: string }[] = [
  { from: "hsl(var(--primary))", to: "hsl(270 75% 60%)" },
  { from: "hsl(142 76% 36%)", to: "hsl(160 80% 42%)" },
  { from: "hsl(38 92% 50%)", to: "hsl(28 90% 55%)" },
  { from: "hsl(0 84% 60%)", to: "hsl(340 82% 58%)" },
  { from: "hsl(199 89% 48%)", to: "hsl(210 92% 52%)" },
  { from: "hsl(280 70% 60%)", to: "hsl(300 70% 55%)" },
];

type OrderRow = {
  total: number | string;
  shipping_cost: number | string;
  reseller_profit: number | string;
  sa_cost_total: number | string;
  created_at: string;
  status: string;
  resellers: { business_name: string } | null;
};

function AdminDashboard() {
  const [range, setRange] = useState<DateRangeState>(DEFAULT_DATE_RANGE);
  const [orderOpen, setOrderOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [resellers, setResellers] = useState<any[]>([]);
  const modalDataLoaded = useRef(false);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ products: 0, resellers: 0, pendingResellers: 0, brands: 0 });
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [catalog, setCatalog] = useState({
    products: 0, active: 0, inactive: 0, featured: 0, low: 0, out: 0,
    categories: 0, activeCategories: 0, activeBrands: 0,
  });
  const [orderReport, setOrderReport] = useState<FinanceReport>(() => buildFinanceReport([], []));
  const [resellerReport, setResellerReport] = useState({
    total: 0, active: 0, pending: 0, suspended: 0, rejected: 0,
    withStore: 0, depositBalance: 0, frozen: 0, withdrawable: 0,
  });
  const [lifetime, setLifetime] = useState({
    orders: 0,
    revenue: 0,
    profit: 0,
    saCost: 0,
    deliveredOrders: 0,
    payoutPaid: 0,
    payoutDue: 0,
  });

  // ONE call per range: range orders + lifetime orders + catalog/reseller/payout aggregates.
  const load = useCallback(async (r: DateRangeState) => {
    setLoading(true);
    const { fromTs, toTs } = resolveRange(r);
    const data = await getAdminDashboard(fromTs, toTs, true);
    const ranged = (data?.range_orders ?? []) as unknown as ReportOrder[];
    setRows(ranged as unknown as OrderRow[]);

    // Every card on this page follows the selected date range.
    const d = ranged.filter((o) => ["delivered", "partial"].includes(String(o.status ?? ""))) as unknown as {
      total: number | string; shipping_cost: number | string; reseller_profit: number | string; sa_cost_total: number | string;
      received_amount?: number | string | null; packaging_total?: number | string | null; status?: string;
    }[];
    setOrderReport(buildFinanceReport(ranged, []));

    const cat = data?.catalog ?? {};
    setCatalog({
      products: Number(cat.products ?? 0),
      active: Number(cat.active ?? 0),
      inactive: Number(cat.inactive ?? 0),
      featured: Number(cat.featured ?? 0),
      low: Number(cat.low ?? 0),
      out: Number(cat.out ?? 0),
      categories: Number(cat.categories ?? 0),
      activeCategories: Number(cat.activeCategories ?? 0),
      activeBrands: Number(cat.activeBrands ?? 0),
    });

    const rs = data?.resellers ?? {};
    setCounts({
      products: Number(cat.products ?? 0),
      resellers: Number(rs.active ?? 0),
      pendingResellers: Number(rs.pending ?? 0),
      brands: Number(cat.brands ?? 0),
    });
    const m = data?.metrics;
    setResellerReport({
      total: Number(rs.total ?? 0),
      active: Number(rs.active ?? 0),
      pending: Number(rs.pending ?? 0),
      suspended: Number(rs.suspended ?? 0),
      rejected: Number(rs.rejected ?? 0),
      withStore: Number(m?.withStore ?? 0),
      depositBalance: Number(m?.depositBalance ?? 0),
      frozen: Number(m?.frozen ?? 0),
      withdrawable: Number(m?.withdrawable ?? 0),
    });
    setLifetime({
      orders: ranged.length,
      deliveredOrders: d.length,
      revenue: d.reduce((s, o) => s + Number(o.total), 0),
      profit: d.reduce((s, o) => s + orderProfit(o), 0),
      saCost: d.reduce((s, o) => s + Number(o.sa_cost_total), 0),
      payoutPaid: Number(data?.payouts?.paid ?? 0),
      payoutDue: Number(data?.payouts?.due ?? 0),
    });
    setLoading(false);
  }, []);

  // Order-modal pickers are fetched once, the first time the modal is opened.
  useEffect(() => {
    if (!orderOpen || modalDataLoaded.current) return;
    modalDataLoaded.current = true;
    void (async () => {
      const data = await getAdminLookups();
      setResellers((data?.resellers ?? []) as any[]);
      setAllProducts((data?.products ?? []) as any[]);
    })();
  }, [orderOpen]);


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
      d.profit += orderProfit(o);
      dayMap.set(key, d);
      if (isRealizedStatus(o.status)) {
        deliveredOrders += 1;
        revenue += Number(o.total);
        profit += orderProfit(o);
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
        title="Admin Overview"
        description="Monitor platform performance, resellers, and financial health."
        actions={
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <DateRangeBar
              value={range}
              onChange={setRange}
              compact
              right={
                <button
                  onClick={() => setOrderOpen(true)}
                  className="btn-brand inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-elegant transition-all hover:opacity-90 active:scale-95"
                >
                  <Plus className="h-4 w-4" /> Add order
                </button>
              }
            />
          </div>
        }
      />

      <section className="mb-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Revenue"
            tone="primary"
            to="/admin/orders"
            search={{ tab: "delivered" }}
            value={bdt(lifetime.revenue)}
            icon={<TrendingUp className="h-4 w-4" />}
            hint="Total from delivered orders"
          />
          <StatCard
            label="Platform Earnings"
            tone="emerald"
            to="/admin/business-report"
            value={bdt(lifetime.saCost)}
            icon={<Wallet className="h-4 w-4" />}
            hint="Admin share after payouts"
          />
          <StatCard
            label="Reseller Profits"
            tone="violet"
            to="/admin/commissions"
            value={bdt(lifetime.profit)}
            icon={<Award className="h-4 w-4" />}
            hint="Total minus delivery, product & packaging cost"
          />
          <StatCard
            label="Pending Payouts"
            tone="amber"
            to="/admin/payouts"
            value={bdt(lifetime.payoutDue)}
            icon={<Clock className="h-4 w-4" />}
            hint="Funds requested by resellers"
          />
        </div>

      </section>

      <section className="mb-8">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground/80">
          Order report
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {ORDER_TABS.map((t) => {
            const b = orderReport.byStatusTab[t.key];
            const bucket = t.key === "all" ? orderReport.all : b;
            return (
              <MiniCard
                key={t.key}
                to="/admin/orders"
                search={{ tab: t.key }}
                label={t.label}
                value={bucket?.orders ?? 0}
                hint={bdt(bucket?.customerTotal ?? 0)}
                tone={
                  t.key === "delivered"
                    ? "emerald"
                    : t.key === "returned" || t.key === "cancelled"
                      ? "rose"
                      : t.key === "pending_return"
                        ? "amber"
                        : undefined
                }
              />
            );
          })}
        </div>
      </section>

      <section className="mb-8">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground/80">
          Reseller report
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <MiniCard to="/admin/resellers" search={{ status: "all" }} label="Total resellers" value={resellerReport.total} />
          <MiniCard to="/admin/resellers" search={{ status: "active" }} label="Active" value={resellerReport.active} tone="emerald" />
          <MiniCard to="/admin/resellers" search={{ status: "pending" }} label="Applicants" value={resellerReport.pending} tone="amber" />
          <MiniCard to="/admin/resellers" search={{ status: "suspended" }} label="Deactivated" value={resellerReport.suspended} tone="rose" />
          <MiniCard to="/admin/resellers" search={{ status: "rejected" }} label="Rejected" value={resellerReport.rejected} tone="rose" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniCard to="/admin/resellers" search={{ status: "active" }} label="Selling resellers" value={resellerReport.withStore} hint="With at least 1 order" tone="violet" />
          <MiniCard to="/admin/advanced" label="Deposit balance" value={bdt(resellerReport.depositBalance)} />
          <MiniCard to="/admin/advanced" label="Frozen" value={bdt(resellerReport.frozen)} tone="amber" />
          <MiniCard to="/admin/payouts" label="Withdrawable" value={bdt(resellerReport.withdrawable)} tone="emerald" />
        </div>
      </section>


      <section className="mb-8">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground/80">
          Product report
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <MiniCard to="/admin/products" label="Total" value={catalog.products} />
          <MiniCard to="/admin/products" search={{ status: "active" }} label="Active" value={catalog.active} tone="emerald" />
          <MiniCard to="/admin/products" search={{ status: "hidden" }} label="Inactive" value={catalog.inactive} tone="rose" />
          <MiniCard to="/admin/products" search={{ status: "featured" }} label="Featured" value={catalog.featured} tone="violet" />
          <MiniCard to="/admin/products" search={{ stock: "low" }} label="Low stock (≤5)" value={catalog.low} tone="amber" />
          <MiniCard to="/admin/products" search={{ stock: "out" }} label="Out of stock" value={catalog.out} tone="rose" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniCard to="/admin/categories" label="Categories" value={catalog.categories} />
          <MiniCard to="/admin/categories" label="Active categories" value={catalog.activeCategories} tone="emerald" />
          <MiniCard to="/admin/brands" label="Brands" value={counts.brands} />
          <MiniCard to="/admin/brands" label="Active brands" value={catalog.activeBrands} tone="emerald" />
        </div>
      </section>



      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Orders" value={stats.orders} tone="sky" icon={<ShoppingCart className="h-4 w-4" />} hint="Range er sob order" />
        <StatCard
          label="Revenue (delivered)"
            tone="primary"
          value={bdt(stats.revenue)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard label="Reseller profit" value={bdt(stats.profit)} tone="violet" icon={<Wallet className="h-4 w-4" />} hint="Delivered order theke reseller profit" />
        <StatCard
          label="Admin earning (delivered)"
            tone="emerald"
          value={bdt(stats.saCost)}
          icon={<Wallet className="h-4 w-4" />}
        />
      </div>


      <div className="mt-8 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="surface-card group relative overflow-hidden p-6 hover:border-primary/50">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-violet-500 to-emerald-400" />
          <div className="mb-4 flex items-center justify-between border-b pb-2">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground/80">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-r from-sky-400 to-violet-500" />
              Activity & Revenue
            </h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }}
                  itemStyle={{ fontSize: 12, fontWeight: 600 }}
                />
                <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, paddingTop: 8, fontWeight: 600 }} />
                <Area type="monotone" dataKey="orders" stroke="#38bdf8" strokeWidth={2.5} fill="url(#gradOrders)" name="Orders" />
                <Area type="monotone" dataKey="revenue" stroke="#a855f7" strokeWidth={2.5} fill="url(#gradRevenue)" name="Revenue ৳" />
                <Area type="monotone" dataKey="profit" stroke="#34d399" strokeWidth={2.5} fill="url(#gradProfit)" name="Reseller profit ৳" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card group p-6 hover:border-primary/50">
          <div className="mb-4 flex items-center justify-between border-b pb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Top Reseller Performance</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} layout="vertical" margin={{ left: 20, right: 24, top: 8, bottom: 8 }}>
                <defs>
                  {BAR_PALETTE.map((c, i) => (
                    <linearGradient key={i} id={`barGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={c.from} stopOpacity={0.92} />
                      <stop offset="100%" stopColor={c.to} stopOpacity={0.75} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={100} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }}
                  itemStyle={{ fontSize: 12, fontWeight: 600 }}
                  formatter={(value: number) => [bdt(value), "Sales"]}
                />
                <Bar dataKey="sales" radius={[0, 8, 8, 0]} barSize={18}>
                  {top.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={`url(#barGrad-${i % BAR_PALETTE.length})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {orderOpen && (
        <NewOrderModal
          listings={[]}
          allProducts={allProducts}
          resellers={resellers}
          isAdmin
          onClose={() => setOrderOpen(false)}
          onCreated={() => {
            setOrderOpen(false);
            clearBootstrapCache("adash:");
            void load(range);
          }}
        />
      )}
    </div>
  );
}

const TONES: Record<string, string> = {
  emerald: "border-emerald-500/25 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  rose: "border-rose-500/25 bg-rose-500/5 text-rose-600 dark:text-rose-400",
  amber: "border-amber-500/25 bg-amber-500/5 text-amber-600 dark:text-amber-400",
  violet: "border-violet-500/25 bg-violet-500/5 text-violet-600 dark:text-violet-400",
};

/** Small clickable report tile — always links to the page (with filter) it reports on. */
function MiniCard({
  to, search, label, value, hint, tone,
}: {
  to: string;
  search?: Record<string, string>;
  label: string;
  value: number | string;
  hint?: string;
  tone?: "emerald" | "rose" | "amber" | "violet";
}) {
  return (
    <Link
      to={to}
      search={search as never}
      className={`surface-card p-4 text-center transition hover:-translate-y-0.5 hover:border-primary/50 ${tone ? TONES[tone] : ""}`}
    >
      <div className={`text-2xl font-black ${tone ? "" : "text-primary"}`}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{hint}</div>}
    </Link>
  );
}
