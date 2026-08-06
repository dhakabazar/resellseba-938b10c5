import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { DateRangeBar, DEFAULT_DATE_RANGE, resolveRange, type DateRangeState } from "@/components/date-range-filter";
import {
  ReportCard,
  StatusReportTable,
  ProductReportTable,
  TrendReportTable,
} from "@/components/report-blocks";
import { buildFinanceReport, bdt, type ReportItem, type ReportOrder } from "@/lib/finance-report";
import {
  ShoppingBag,
  TrendingUp,
  ClipboardList,
  Wallet,
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Award,
  RefreshCw,
  Package,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/reseller/")({
  component: ResellerDashboard,
});

type PayoutRow = { amount: number | string; status: string; created_at: string };
type CommissionRow = { amount: number | string; status: string; created_at: string };

function ResellerDashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState<DateRangeState>(DEFAULT_DATE_RANGE);
  const [loading, setLoading] = useState(true);
  const [rid, setRid] = useState<string | null>(null);
  const [listings, setListings] = useState({ total: 0, active: 0 });
  const [orders, setOrders] = useState<ReportOrder[]>([]);
  const [items, setItems] = useState<ReportItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [lifetime, setLifetime] = useState({ delivered: 0, pendingPayout: 0, paidOut: 0, available: 0 });

  const uid = user?.id;

  const load = useCallback(
    async (r: DateRangeState) => {
      if (!uid) return;
      setLoading(true);
      const { data: reseller } = await supabase
        .from("resellers")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();
      if (!reseller) {
        setLoading(false);
        return;
      }
      setRid(reseller.id);
      const { fromTs, toTs } = resolveRange(r);

      let oq = supabase
        .from("orders")
        .select(
          "id,order_number,reseller_id,status,created_at,subtotal,shipping_cost,discount,total,sa_cost_total,reseller_profit",
        )
        .eq("reseller_id", reseller.id);
      if (fromTs != null) oq = oq.gte("created_at", new Date(fromTs).toISOString());
      if (toTs != null) oq = oq.lte("created_at", new Date(toTs).toISOString());

      const [ordersRes, listAll, listActive, payoutRes, commRes, summaryRes] = await Promise.all([
        oq.order("created_at", { ascending: false }).limit(5000),
        supabase.from("reseller_listings").select("*", { count: "exact", head: true }).eq("reseller_id", reseller.id),
        supabase
          .from("reseller_listings")
          .select("*", { count: "exact", head: true })
          .eq("reseller_id", reseller.id)
          .eq("is_active", true),
        supabase.from("payouts").select("amount,status,created_at").eq("reseller_id", reseller.id),
        supabase.from("leader_commissions").select("amount,status,created_at").eq("leader_id", reseller.id),
        supabase.rpc("reseller_profit_summary", { _reseller_id: reseller.id }),
      ]);

      const os = (ordersRes.data ?? []) as ReportOrder[];
      setOrders(os);
      setListings({ total: listAll.count ?? 0, active: listActive.count ?? 0 });
      setPayouts((payoutRes.data ?? []) as PayoutRow[]);
      setCommissions((commRes.data ?? []) as CommissionRow[]);

      const s = (Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data) as
        | { delivered_profit?: number; pending_payout?: number; paid_out?: number; available?: number }
        | null;
      setLifetime({
        delivered: Number(s?.delivered_profit ?? 0),
        pendingPayout: Number(s?.pending_payout ?? 0),
        paidOut: Number(s?.paid_out ?? 0),
        available: Number(s?.available ?? 0),
      });

      if (os.length) {
        const ids = os.map((o) => o.id);
        const chunks: ReportItem[] = [];
        for (let i = 0; i < ids.length; i += 200) {
          const { data } = await supabase
            .from("order_items")
            .select("order_id,product_id,product_name,quantity,sa_price,reseller_price,line_total,profit")
            .in("order_id", ids.slice(i, i + 200));
          chunks.push(...((data ?? []) as ReportItem[]));
        }
        setItems(chunks);
      } else {
        setItems([]);
      }
      setLoading(false);
    },
    [uid],
  );

  useEffect(() => {
    void load(range);
  }, [load, range]);

  const report = useMemo(() => buildFinanceReport(orders, items, { trend: "day" }), [orders, items]);

  const inR = useCallback(
    (created: string) => {
      const { fromTs, toTs } = resolveRange(range);
      const ts = new Date(created).getTime();
      if (fromTs != null && ts < fromTs) return false;
      if (toTs != null && ts > toTs) return false;
      return true;
    },
    [range],
  );

  const paidInRange = useMemo(
    () =>
      payouts
        .filter((p) => p.status === "paid" && inR(p.created_at))
        .reduce((s, p) => s + Number(p.amount), 0),
    [payouts, inR],
  );
  const requestedInRange = useMemo(
    () =>
      payouts
        .filter((p) => ["pending", "approved"].includes(p.status) && inR(p.created_at))
        .reduce((s, p) => s + Number(p.amount), 0),
    [payouts, inR],
  );
  const commissionInRange = useMemo(
    () => commissions.filter((c) => inR(c.created_at)).reduce((s, c) => s + Number(c.amount), 0),
    [commissions, inR],
  );
  const commissionLifetime = useMemo(
    () => commissions.reduce((s, c) => s + Number(c.amount), 0),
    [commissions],
  );

  const chart = useMemo(
    () =>
      report.trend
        .slice(0, 60)
        .map((t) => ({
          day: t.key.slice(5),
          orders: t.orders,
          profit: Math.round(t.deliveredProfit),
        }))
        .reverse(),
    [report.trend],
  );

  return (
    <div>
      <PageHeader
        title="Store Dashboard"
        description="Track your earnings, orders, and business growth."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void load(range)}
              className="group inline-flex items-center gap-2 rounded-xl border-2 border-primary/10 bg-card px-4 py-2.5 text-sm font-bold transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-95"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 transition-transform group-hover:rotate-180" />}
              Sync
            </button>
            <Link
              to="/reseller/earnings"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-elegant transition-all hover:opacity-90 active:scale-95"
            >
              <Wallet className="h-4 w-4" /> Reports
            </Link>
          </div>
        }
      />

      <section className="mb-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Total earning (lifetime)"
            value={bdt(lifetime.delivered + commissionLifetime)}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            label="Available payout"
            value={bdt(lifetime.available)}
            icon={<Wallet className="h-4 w-4" />}
          />
          <StatCard
            label="Paid out (lifetime)"
            value={bdt(lifetime.paidOut)}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <StatCard
            label="Due (unpaid earning)"
            value={bdt(Math.max(lifetime.delivered + commissionLifetime - lifetime.paidOut, 0))}
            icon={<Clock className="h-4 w-4" />}
          />
          <StatCard
            label="Active products"
            value={listings.active}
            icon={<ShoppingBag className="h-4 w-4" />}
          />
        </div>
      </section>

      <div className="mb-4 flex justify-end">
        <DateRangeBar value={range} onChange={setRange} compact />
      </div>

      {loading && !orders.length ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Orders"
              value={report.all.orders}
              icon={<ClipboardList className="h-4 w-4" />}
            />
            <StatCard
              label="Earned profit"
              value={bdt(report.realized.profit)}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <StatCard
              label="Pending profit"
              value={bdt(report.pipeline.profit)}
              icon={<Clock className="h-4 w-4" />}
            />
            <StatCard
              label="Paid out (range)"
              value={bdt(paidInRange)}
              icon={<Wallet className="h-4 w-4" />}
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="On the way (courier)"
              value={bdt(report.byStatusTab.courier?.customerTotal ?? 0)}
              icon={<Truck className="h-4 w-4" />}
            />
            <StatCard
              label="Return risk"
              value={bdt(report.risk.profit)}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <StatCard
              label="Lost (return + cancel)"
              value={bdt(report.lost.profit)}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <StatCard
              label="Delivery rate"
              value={`${report.deliveryRate.toFixed(1)}%`}
              icon={<Award className="h-4 w-4" />}
            />
          </div>

          {commissionLifetime > 0 && (
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Team commission (range)"
                value={bdt(commissionInRange)}
                icon={<Award className="h-4 w-4" />}
              />
            </div>
          )}


          <div className="surface-card group p-6 hover:border-primary/50">
            <div className="mb-4 flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">Profit & Order Insights</h3>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="orders"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.2)"
                    name="Orders"
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="hsl(142 76% 36%)"
                    fill="hsl(142 76% 36% / 0.15)"
                    name="Profit ৳"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-6">
            <ReportCard title="Status wise money">
              <StatusReportTable report={report} showAdminCost />
            </ReportCard>

            <ReportCard
              title="Top products"
              right={
                <Link to="/reseller/listings" className="inline-flex items-center gap-1.5 text-xs text-primary">
                  <Package className="h-3.5 w-3.5" /> Manage listings
                </Link>
              }
            >
              <ProductReportTable products={report.products} limit={10} showCost />
            </ReportCard>

            <ReportCard title="Day wise trend">
              <TrendReportTable trend={report.trend} limit={31} />
            </ReportCard>
          </div>

          {!rid && <p className="text-sm text-muted-foreground">Reseller profile pawa jaini.</p>}
        </>
      )}
    </div>
  );
}
