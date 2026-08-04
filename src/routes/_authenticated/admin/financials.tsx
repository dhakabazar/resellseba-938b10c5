import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/ui-kit";
import {
  OrderFilterBar,
  applyOrderFilters,
  DEFAULT_ORDER_FILTERS,
  type OrderFilterState,
} from "@/components/order-filters";
import {
  ReportCard,
  ReportTabs,
  StatusReportTable,
  ProductReportTable,
  TrendReportTable,
  RawStatusList,
} from "@/components/report-blocks";
import {
  buildFinanceReport,
  bdt,
  toCsv,
  downloadCsv,
  type ReportItem,
  type ReportOrder,
} from "@/lib/finance-report";
import { Loader2, Wallet, TrendingUp, Award, PiggyBank, Truck, Download, AlertTriangle, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/financials")({
  component: FinancialsPage,
  head: () => ({
    meta: [
      { title: "Financial report — Admin" },
      { name: "description", content: "Full financial report by reseller, status and product." },
    ],
  }),
});

type OrderRow = ReportOrder & {
  customer_name: string;
  customer_phone: string;
  address_line: string | null;
  resellers?: { business_name: string; code: string } | null;
};
type Reseller = { id: string; business_name: string; code: string; leader_id: string | null; commission_rate: number };
type Payout = { reseller_id: string; amount: number; status: string };
type Commission = { leader_id: string; reseller_id: string; amount: number; status: string; created_at: string };
type Shipment = { order_id: string; provider: string; cost: number | null; delivery_charge: number | null };

type AdminReportTab = "overview" | "resellers" | "products" | "courier" | "trend" | "how";
const ADMIN_TABS: { key: AdminReportTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "resellers", label: "Per-reseller" },
  { key: "products", label: "Product wise" },
  { key: "courier", label: "Courier wise" },
  { key: "trend", label: "Trend" },
  { key: "how", label: "How it's calculated" },
];

function FinancialsPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<ReportItem[]>([]);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [filters, setFilters] = useState<OrderFilterState>(DEFAULT_ORDER_FILTERS);
  const [gran, setGran] = useState<"day" | "month">("day");
  const [resellerQ, setResellerQ] = useState("");
  const [tab, setTab] = useState<AdminReportTab>("overview");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [o, it, r, p, c, s] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id,order_number,reseller_id,status,created_at,customer_name,customer_phone,address_line,subtotal,shipping_cost,discount,total,sa_cost_total,reseller_profit,resellers(business_name,code)",
          )
          .order("created_at", { ascending: false }),
        supabase.from("order_items").select("order_id,product_id,product_name,quantity,sa_price,reseller_price,line_total,profit"),
        supabase.from("resellers").select("id,business_name,code,leader_id,commission_rate"),
        supabase.from("payouts").select("reseller_id,amount,status"),
        supabase.from("leader_commissions").select("leader_id,reseller_id,amount,status,created_at"),
        supabase.from("shipments").select("order_id,provider,cost,delivery_charge"),
      ]);
      setOrders((o.data ?? []) as unknown as OrderRow[]);
      setItems((it.data ?? []) as unknown as ReportItem[]);
      setResellers((r.data ?? []) as Reseller[]);
      setPayouts((p.data ?? []) as Payout[]);
      setCommissions((c.data ?? []) as Commission[]);
      setShipments((s.data ?? []) as Shipment[]);
      setLoading(false);
    })();
  }, []);

  /** Date + reseller filtered order set — every report block reads from this. */
  const scoped = useMemo(() => applyOrderFilters(orders, filters), [orders, filters]);
  const scopedIds = useMemo(() => new Set(scoped.map((o) => o.id)), [scoped]);
  const scopedItems = useMemo(() => items.filter((i) => scopedIds.has(i.order_id)), [items, scopedIds]);
  const report = useMemo(() => buildFinanceReport(scoped, scopedItems, { trend: gran }), [scoped, scopedItems, gran]);

  /** Payouts / commissions are ledger-wide (lifetime) — filter only by reseller. */
  const ledgerResellerIds = useMemo(
    () => (filters.reseller ? new Set([filters.reseller]) : new Set(resellers.map((r) => r.id))),
    [filters.reseller, resellers],
  );
  const payoutTotals = useMemo(() => {
    let paid = 0, pending = 0;
    for (const p of payouts) {
      if (!ledgerResellerIds.has(p.reseller_id)) continue;
      if (p.status === "paid") paid += Number(p.amount);
      else if (p.status === "pending" || p.status === "approved") pending += Number(p.amount);
    }
    return { paid, pending };
  }, [payouts, ledgerResellerIds]);
  const commissionTotals = useMemo(() => {
    let paid = 0, due = 0;
    for (const c of commissions) {
      if (!ledgerResellerIds.has(c.reseller_id)) continue;
      if (c.status === "paid") paid += Number(c.amount);
      else due += Number(c.amount);
    }
    return { paid, due };
  }, [commissions, ledgerResellerIds]);

  /** Courier cost vs delivery collected (delivered orders only). */
  const courierStats = useMemo(() => {
    const deliveredIds = new Set(scoped.filter((o) => o.status === "delivered").map((o) => o.id));
    const map = new Map<string, { provider: string; shipments: number; cost: number; charge: number }>();
    for (const s of shipments) {
      if (!scopedIds.has(s.order_id)) continue;
      const row = map.get(s.provider) ?? { provider: s.provider, shipments: 0, cost: 0, charge: 0 };
      row.shipments += 1;
      row.cost += Number(s.cost ?? 0);
      row.charge += Number(s.delivery_charge ?? 0);
      map.set(s.provider, row);
    }
    const deliveredCollected = scoped
      .filter((o) => deliveredIds.has(o.id))
      .reduce((t, o) => t + Number(o.shipping_cost), 0);
    return { rows: Array.from(map.values()).sort((a, b) => b.shipments - a.shipments), deliveredCollected };
  }, [shipments, scoped, scopedIds]);

  /** Per-reseller aggregate on the filtered order set. */
  const perReseller = useMemo(() => {
    const base = new Map<
      string,
      {
        reseller: Reseller;
        orders: number;
        delivered: number;
        returned: number;
        gross: number;
        adminCost: number;
        delivery: number;
        deliveredProfit: number;
        pipelineProfit: number;
        paid: number;
        pending: number;
        available: number;
        leaderDue: number;
        leaderPaid: number;
      }
    >();
    for (const r of resellers) {
      base.set(r.id, {
        reseller: r, orders: 0, delivered: 0, returned: 0, gross: 0, adminCost: 0, delivery: 0,
        deliveredProfit: 0, pipelineProfit: 0, paid: 0, pending: 0, available: 0, leaderDue: 0, leaderPaid: 0,
      });
    }
    for (const o of scoped) {
      const a = base.get(o.reseller_id);
      if (!a) continue;
      a.orders += 1;
      if (o.status === "delivered") {
        a.delivered += 1;
        a.gross += Number(o.subtotal);
        a.adminCost += Number(o.sa_cost_total);
        a.delivery += Number(o.shipping_cost);
        a.deliveredProfit += Number(o.reseller_profit);
      } else if (o.status === "returned" || o.status === "cancelled") {
        a.returned += 1;
      } else {
        a.pipelineProfit += Number(o.reseller_profit);
      }
    }
    for (const p of payouts) {
      const a = base.get(p.reseller_id);
      if (!a) continue;
      if (p.status === "paid") a.paid += Number(p.amount);
      else if (p.status === "pending" || p.status === "approved") a.pending += Number(p.amount);
    }
    for (const c of commissions) {
      const a = base.get(c.leader_id);
      if (!a) continue;
      if (c.status === "paid") a.leaderPaid += Number(c.amount);
      else a.leaderDue += Number(c.amount);
    }
    for (const a of base.values()) a.available = Math.max(a.deliveredProfit - a.paid - a.pending, 0);
    let rows = Array.from(base.values());
    if (filters.reseller) rows = rows.filter((a) => a.reseller.id === filters.reseller);
    const q = resellerQ.trim().toLowerCase();
    if (q) rows = rows.filter((a) => a.reseller.business_name.toLowerCase().includes(q) || a.reseller.code.toLowerCase().includes(q));
    return rows.sort((x, y) => y.deliveredProfit - x.deliveredProfit);
  }, [resellers, scoped, payouts, commissions, filters.reseller, resellerQ]);

  const totalAvailable = perReseller.reduce((t, a) => t + a.available, 0);
  const courierCost = courierStats.rows.reduce((t, r) => t + r.cost, 0);

  const exportStatus = () =>
    downloadCsv(
      "report-status.csv",
      toCsv(
        ["Status", "Orders", "Sell value", "Delivery", "Admin cost", "Reseller profit"],
        Object.entries(report.byStatus).map(([s, b]) => [s, b.orders, b.gross, b.delivery, b.adminCost, b.profit]),
      ),
    );
  const exportProducts = () =>
    downloadCsv(
      "report-products.csv",
      toCsv(
        ["Product", "Orders", "Qty", "Delivered qty", "Sell value", "Cost", "Profit", "Delivered profit"],
        report.products.map((p) => [p.name, p.orders, p.qty, p.deliveredQty, p.gross, p.cost, p.profit, p.deliveredProfit]),
      ),
    );
  const exportResellers = () =>
    downloadCsv(
      "report-resellers.csv",
      toCsv(
        ["Reseller", "Code", "Orders", "Delivered", "Returned/Cancelled", "Gross sell", "Admin cost", "Delivery", "Delivered profit", "Pipeline profit", "Paid", "Pending", "Due", "Leader due"],
        perReseller.map((a) => [
          a.reseller.business_name, a.reseller.code, a.orders, a.delivered, a.returned,
          a.gross, a.adminCost, a.delivery, a.deliveredProfit, a.pipelineProfit, a.paid, a.pending, a.available, a.leaderDue,
        ]),
      ),
    );

  if (loading)
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div>
      <PageHeader title="Financial report" />

      <OrderFilterBar
        value={filters}
        onChange={setFilters}
        resellerOptions={resellers.map((r) => ({ value: r.id, label: `${r.business_name} (${r.code})` }))}
        total={orders.length}
        shown={scoped.length}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Delivered sell value"
          value={bdt(report.realized.gross)}
          hint={`${report.realized.orders} delivered · AOV ${bdt(report.avgOrderValue)}`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Admin revenue (product+pkg)"
          value={bdt(report.realized.adminCost)}
          hint="Reseller price + packaging on delivered orders"
          icon={<PiggyBank className="h-4 w-4" />}
        />
        <StatCard
          label="Reseller profit (delivered)"
          value={bdt(report.realized.profit)}
          hint={`Paid ${bdt(payoutTotals.paid)} · Pending ${bdt(payoutTotals.pending)} · Due ${bdt(totalAvailable)}`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Leader commission"
          value={bdt(commissionTotals.due)}
          hint={`Due now · Paid ${bdt(commissionTotals.paid)}`}
          icon={<Award className="h-4 w-4" />}
        />
        <StatCard
          label="Pipeline profit (running)"
          value={bdt(report.pipeline.profit)}
          hint={`${report.pipeline.orders} order — new/confirmed/RTS/courier`}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Pending return (risk)"
          value={bdt(report.risk.gross)}
          hint={`${report.risk.orders} orders — becomes returned if received`}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Lost (returned + cancelled)"
          value={bdt(report.lost.gross)}
          hint={`${report.lost.orders} order · Return rate ${report.returnRate.toFixed(1)}%`}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Delivery: collected vs courier"
          value={`${bdt(courierStats.deliveredCollected)} / ${bdt(courierCost)}`}
          hint={`Success rate ${report.deliveryRate.toFixed(1)}%`}
          icon={<Truck className="h-4 w-4" />}
        />
      </div>

      <ReportTabs tabs={ADMIN_TABS} active={tab} onChange={setTab} />

      {tab === "overview" && (
      <>
      <ReportCard
        title="Order status wise report"
        hint="Matches the order list tab buckets."
        right={<CsvBtn onClick={exportStatus} />}
      >
        <StatusReportTable report={report} />
      </ReportCard>

      <ReportCard title="Raw status split" hint="Each database status shown separately.">
        <RawStatusList report={report} />
      </ReportCard>
      </>
      )}

      {tab === "resellers" && (
      <ReportCard
        title="Per-reseller report"
        hint="Filtered date range orders + lifetime payout ledger."
        right={
          <>
            <input
              value={resellerQ}
              onChange={(e) => setResellerQ(e.target.value)}
              placeholder="Search resellers…"
              className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
            />
            <CsvBtn onClick={exportResellers} />
          </>
        }
      >
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-muted/20 text-left text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Reseller</th>
              <th className="p-3 text-right">Orders</th>
              <th className="p-3 text-right">Gross sell</th>
              <th className="p-3 text-right">Admin cost</th>
              <th className="p-3 text-right">Delivery</th>
              <th className="p-3 text-right">Delivered profit</th>
              <th className="p-3 text-right">Pipeline</th>
              <th className="p-3 text-right">Paid</th>
              <th className="p-3 text-right">Pending</th>
              <th className="p-3 text-right">Due</th>
              <th className="p-3 text-right">Leader due</th>
            </tr>
          </thead>
          <tbody>
            {perReseller.map((a) => (
              <tr key={a.reseller.id} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{a.reseller.business_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    /{a.reseller.code} · leader rate {a.reseller.commission_rate}%
                  </div>
                </td>
                <td className="p-3 text-right text-muted-foreground">
                  {a.delivered}/{a.orders}
                  <div className="text-[10px]">ret/can {a.returned}</div>
                </td>
                <td className="p-3 text-right">{bdt(a.gross)}</td>
                <td className="p-3 text-right text-muted-foreground">{bdt(a.adminCost)}</td>
                <td className="p-3 text-right text-muted-foreground">{bdt(a.delivery)}</td>
                <td className="p-3 text-right font-semibold text-success">{bdt(a.deliveredProfit)}</td>
                <td className="p-3 text-right text-muted-foreground">{bdt(a.pipelineProfit)}</td>
                <td className="p-3 text-right">{bdt(a.paid)}</td>
                <td className="p-3 text-right">{bdt(a.pending)}</td>
                <td className="p-3 text-right font-medium">{bdt(a.available)}</td>
                <td className="p-3 text-right">
                  {a.leaderDue || a.leaderPaid ? (
                    <div>
                      <div className="font-medium">{bdt(a.leaderDue)}</div>
                      <div className="text-[10px] text-muted-foreground">paid {bdt(a.leaderPaid)}</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {perReseller.length === 0 && (
              <tr>
                <td colSpan={11} className="p-8 text-center text-muted-foreground">
                  No resellers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ReportCard>
      )}

      {tab === "products" && (
      <ReportCard
        title="Product wise report"
        hint="Sales and profit by product."
        right={<CsvBtn onClick={exportProducts} />}
      >
        <ProductReportTable products={report.products} />
      </ReportCard>
      )}

      {tab === "courier" && (
      <ReportCard title="Courier wise report" hint="Booking count, courier charge and COD delivery charge.">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-muted/20 text-left text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Courier</th>
              <th className="p-3 text-right">Shipments</th>
              <th className="p-3 text-right">Booking cost</th>
              <th className="p-3 text-right">Courier delivery charge</th>
            </tr>
          </thead>
          <tbody>
            {courierStats.rows.map((r) => (
              <tr key={r.provider} className="border-t">
                <td className="p-3 font-medium capitalize">{r.provider}</td>
                <td className="p-3 text-right">{r.shipments}</td>
                <td className="p-3 text-right">{bdt(r.cost)}</td>
                <td className="p-3 text-right text-muted-foreground">{bdt(r.charge)}</td>
              </tr>
            ))}
            {courierStats.rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  No shipments in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ReportCard>
      )}

      {tab === "trend" && (
      <ReportCard
        title="Trend report"
        right={
          <select
            value={gran}
            onChange={(e) => setGran(e.target.value as "day" | "month")}
            className="h-8 rounded-md border bg-background px-2 text-xs outline-none"
          >
            <option value="day">Daily</option>
            <option value="month">Monthly</option>
          </select>
        }
      >
        <TrendReportTable trend={report.trend} />
      </ReportCard>
      )}

      {tab === "how" && (
      <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
        <div className="mb-1 font-medium text-foreground">How it's calculated</div>
        <ul className="list-disc space-y-1 pl-4">
          <li><b>Sell value</b> = reseller's selling price × qty (excluding delivery).</li>
          <li><b>Admin cost / revenue</b> = (reseller_price + packaging_cost) × qty — paid by reseller to admin.</li>
          <li><b>Delivery</b> is collected from customer and paid to courier — not counted in profit.</li>
          <li><b>Reseller profit</b> = Sell value − Admin cost. Confirmed once delivered; pipeline means running.</li>
          <li><b>Leader commission</b> = delivered order's reseller profit × leader rate% (auto-created via trigger).</li>
          <li><b>Due</b> = delivered profit − paid − pending payout.</li>
        </ul>
      </div>
      )}
    </div>
  );
}

function CsvBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
    >
      <Download className="h-3.5 w-3.5" /> CSV
    </button>
  );
}
