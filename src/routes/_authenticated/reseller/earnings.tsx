import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
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
import { buildFinanceReport, bdt, toCsv, downloadCsv, orderProfit, PROFIT_FORMULA_HINT, type ReportItem, type ReportOrder } from "@/lib/finance-report";
import { orderStatusLabel, orderStatusTone } from "@/lib/courier-status";
import { OrderItemsStrip, type StripItem } from "@/components/order-items-strip";
import { Loader2, Wallet, TrendingUp, Clock, CheckCircle2, AlertTriangle, Truck, Download, Award, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reseller/earnings")({
  component: EarningsPage,
  head: () => ({
    meta: [
      { title: "Earnings & report — Reseller" },
      { name: "description", content: "Full report of your orders, profit, commission and payouts." },
    ],
  }),
});

type Item = ReportItem;
type Row = ReportOrder & {
  customer_name: string;
  customer_phone: string;
  address_line: string | null;
  order_items: {
    product_id: string | null;
    product_name: string;
    product_image: string | null;
    quantity: number;
    sa_price: number;
    reseller_price: number;
    profit: number;
    line_total: number;
  }[];
};
type Payout = { id: string; amount: number; status: string; method: string | null; reference: string | null; requested_at: string; paid_at: string | null };
type ResellerReportTab = "overview" | "products" | "trend" | "orders" | "payouts" | "commission" | "how";

type Commission = { id: string; amount: number; status: string; created_at: string; base_profit: number; rate: number; order_id: string };

function EarningsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [productMeta, setProductMeta] = useState<Record<string, { slug: string; image: string | null; packaging: number }>>({});
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ delivered_profit: 0, pending_payout: 0, paid_out: 0, available: 0 });
  const [filters, setFilters] = useState<OrderFilterState>(DEFAULT_ORDER_FILTERS);
  const [gran, setGran] = useState<"day" | "month">("day");
  const [tab, setTab] = useState<ResellerReportTab>("overview");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: r } = await supabase.from("resellers").select("id").eq("user_id", user.id).maybeSingle();
      if (!r) return setLoading(false);
      const [ordersRes, summaryRes, payoutRes, comRes] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id,order_number,reseller_id,status,created_at,customer_name,customer_phone,address_line,subtotal,shipping_cost,discount,total,sa_cost_total,reseller_profit,received_amount,packaging_total,order_items(product_id,product_name,product_image,quantity,sa_price,reseller_price,profit,line_total)",
          )
          .eq("reseller_id", r.id)
          .order("created_at", { ascending: false }),
        supabase.rpc("reseller_profit_summary", { _reseller_id: r.id }),
        supabase
          .from("payouts")
          .select("id,amount,status,method,reference,requested_at,paid_at")
          .eq("reseller_id", r.id)
          .order("requested_at", { ascending: false }),
        supabase
          .from("leader_commissions")
          .select("id,amount,status,created_at,base_profit,rate,order_id")
          .eq("leader_id", r.id)
          .order("created_at", { ascending: false }),
      ]);
      const orderRows = (ordersRes.data ?? []) as unknown as Row[];
      setRows(orderRows);
      const ids = [...new Set(orderRows.flatMap((o) => (o.order_items ?? []).map((i) => i.product_id).filter(Boolean)))] as string[];
      if (ids.length) {
        const { data: prods } = await supabase
          .from("products")
          .select("id,slug,og_image_url,packaging_cost")
          .in("id", ids);
        const map: Record<string, { slug: string; image: string | null; packaging: number }> = {};
        for (const p of prods ?? []) {
          map[p.id] = { slug: p.slug, image: p.og_image_url ?? null, packaging: Number(p.packaging_cost ?? 0) };
        }
        setProductMeta(map);
      }
      const s = Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data;
      if (s) {
        setSummary({
          delivered_profit: Number(s.delivered_profit ?? 0),
          pending_payout: Number(s.pending_payout ?? 0),
          paid_out: Number(s.paid_out ?? 0),
          available: Number(s.available ?? 0),
        });
      }
      setPayouts((payoutRes.data ?? []) as Payout[]);
      setCommissions((comRes.data ?? []) as Commission[]);
      setLoading(false);
    })();
  }, [user]);

  const scoped = useMemo(() => applyOrderFilters(rows, filters), [rows, filters]);
  const items: Item[] = useMemo(
    () =>
      scoped.flatMap((o) =>
        (o.order_items ?? []).map((i) => ({
          order_id: o.id,
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          sa_price: i.sa_price,
          reseller_price: i.reseller_price,
          line_total: i.line_total,
          profit: i.profit,
        })),
      ),
    [scoped],
  );


  const stripItems = (o: Row): StripItem[] =>
    (o.order_items ?? []).map((i, idx) => ({
      id: `${o.id}-${idx}`,
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: Number(i.quantity),
      unit_price: Number(i.reseller_price),
      line_total: Number(i.line_total),
      image: i.product_image ?? (i.product_id ? productMeta[i.product_id]?.image ?? null : null),
      slug: i.product_id ? productMeta[i.product_id]?.slug ?? null : null,
    }));

  const report = useMemo(() => buildFinanceReport(scoped, items, { trend: gran }), [scoped, items, gran]);

  const commissionTotals = useMemo(() => {
    let paid = 0, due = 0;
    for (const c of commissions) (c.status === "paid" ? (paid += Number(c.amount)) : (due += Number(c.amount)));
    return { paid, due };
  }, [commissions]);

  const exportOrders = () =>
    downloadCsv(
      "my-orders-report.csv",
      toCsv(
        ["Order", "Date", "Status", "Sell value", "Delivery", "Customer total", "Admin cost", "My profit"],
        scoped.map((o) => [
          o.order_number,
          new Date(o.created_at).toLocaleDateString(),
          o.status,
          Number(o.subtotal),
          Number(o.shipping_cost),
          Number(o.total),
          Number(o.sa_cost_total),
          orderProfit(o),
        ]),
      ),
    );
  const exportProducts = () =>
    downloadCsv(
      "my-products-report.csv",
      toCsv(
        ["Product", "Orders", "Qty", "Delivered qty", "Sell value", "Admin cost", "Profit", "Delivered profit"],
        report.products.map((p) => [p.name, p.orders, p.qty, p.deliveredQty, p.gross, p.cost, p.profit, p.deliveredProfit]),
      ),
    );

  if (loading)
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const tabs: { key: ResellerReportTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "products", label: "Product wise" },
    { key: "trend", label: "Trend" },
    { key: "orders", label: "Order wise" },
    { key: "payouts", label: "Payout ledger" },
    ...(commissions.length ? [{ key: "commission" as const, label: "Team commission" }] : []),
    { key: "how", label: "How it works" },
  ];

  return (
    <div>
      <PageHeader title="Earnings & report" />

      <OrderFilterBar value={filters} onChange={setFilters} total={rows.length} shown={scoped.length} showPerPage variant="report" />

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Confirmed profit (delivered)"
          value={bdt(summary.delivered_profit)}
          hint="Lifetime, from delivered orders"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Available for withdrawal"
          value={bdt(summary.available)}
          hint={`Paid ${bdt(summary.paid_out)} · Pending ${bdt(summary.pending_payout)}`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Pipeline profit (running)"
          value={bdt(report.pipeline.profit)}
          hint={`${report.pipeline.orders} orders not yet delivered`}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Team commission (leader)"
          value={bdt(commissionTotals.due)}
          hint={commissions.length ? `Due · Paid ${bdt(commissionTotals.paid)}` : "You are not a team leader"}
          icon={<Award className="h-4 w-4" />}
        />
        <StatCard
          label="Delivered sell value"
          value={bdt(report.realized.gross)}
          hint={`${report.realized.orders} orders · AOV ${bdt(report.avgOrderValue)}`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Admin cost (delivered)"
          value={bdt(report.realized.adminCost)}
          hint={`Product ${bdt(report.realized.adminCost - report.realized.packaging)} + packaging ${bdt(report.realized.packaging)}`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Packaging cost (delivered)"
          value={bdt(report.realized.packaging)}
          hint={`All orders ${bdt(report.all.packaging)} — already included in admin cost`}
          icon={<Package className="h-4 w-4" />}
          tone="violet"
        />
        <StatCard
          label="Delivery charge collected"
          value={bdt(report.realized.delivery)}
          hint={`Delivery success ${report.deliveryRate.toFixed(1)}%`}
          icon={<Truck className="h-4 w-4" />}
        />
        <StatCard
          label="Return / cancel loss"
          value={bdt(report.lost.gross + report.risk.gross)}
          hint={`Returned+cancelled ${report.lost.orders} · Pending return ${report.risk.orders} · Return rate ${report.returnRate.toFixed(1)}%`}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <ReportTabs tabs={tabs} active={tab} onChange={setTab} />

      <p className="mb-6 rounded-lg border border-dashed bg-muted/30 px-4 py-2.5 text-[11px] font-medium leading-relaxed text-muted-foreground">
        {PROFIT_FORMULA_HINT}
      </p>

      {tab === "overview" && (
      <>
      <ReportCard title="Order status wise report" hint="Grouped by the tabs on the Orders page. Product cost and packaging cost are shown separately.">
        <StatusReportTable report={report} />
      </ReportCard>


      <ReportCard
        title="Cost breakdown"
        hint="Admin cost split into product price and packaging. Profit calculation is unchanged — packaging is already inside admin cost."
      >
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-muted/20 text-center text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-center">Scope</th>
              <th className="px-2 py-2 text-center">Product cost</th>
              <th className="px-2 py-2 text-center">Packaging cost</th>
              <th className="px-2 py-2 text-center">Admin cost total</th>
              <th className="px-2 py-2 text-center">Profit</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: "Delivered", cost: report.realized.adminCost, pkg: report.realized.packaging, profit: report.realized.profit },
              { label: "All filtered orders", cost: report.all.adminCost, pkg: report.all.packaging, profit: report.all.profit },
            ].map((r) => (
              <tr key={r.label} className="border-t">
                <td className="px-2 py-2 text-center font-medium">{r.label}</td>
                <td className="px-2 py-2 text-center tabular-nums">{bdt(r.cost - r.pkg)}</td>
                <td className="px-2 py-2 text-center tabular-nums text-violet-500">{bdt(r.pkg)}</td>
                <td className="px-2 py-2 text-center tabular-nums text-muted-foreground">{bdt(r.cost)}</td>
                <td className="px-2 py-2 text-center font-semibold tabular-nums">{bdt(r.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportCard>

      <ReportCard title="Raw status split">
        <RawStatusList report={report} />
      </ReportCard>
      </>
      )}

      {tab === "products" && (
      <ReportCard
        title="Product wise profit"
        hint="Profit earned per product."
        right={<CsvBtn onClick={exportProducts} />}
      >
        <ProductReportTable products={report.products} />
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

      {tab === "orders" && (
      <ReportCard
        title="Order wise profit"
        hint="Cost, delivery and profit for each order."
        right={<CsvBtn onClick={exportOrders} />}
      >
        <div className="space-y-4 bg-muted/10 p-3 md:p-4">
          {scoped.slice(0, 100).map((o) => (
            <div key={o.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-4 py-3">
                <div>
                  <div className="font-mono text-sm font-semibold">{o.order_number}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString()} · {o.customer_name}
                  </div>
                </div>
                <span className={"ml-auto rounded-full px-2 py-0.5 text-[11px] " + orderStatusTone(o.status)}>
                  {orderStatusLabel(o.status)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                {[
                  { l: "Sell value", v: bdt(Number(o.subtotal)) },
                  { l: "Delivery", v: bdt(Number(o.shipping_cost)), muted: true },
                  { l: "Customer total", v: bdt(Number(o.total)) },
                  { l: "Admin cost", v: bdt(Number(o.sa_cost_total)), muted: true },
                  {
                    l: "My profit",
                    v: bdt(orderProfit(o)),
                    cls: "font-semibold " + (o.status === "delivered" ? "text-success" : ""),
                  },
                ].map((c) => (
                  <div key={c.l}>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{c.l}</div>
                    <div className={"tabular-nums " + (c.muted ? "text-muted-foreground " : "") + (c.cls ?? "")}>{c.v}</div>
                  </div>
                ))}
              </div>
              <OrderItemsStrip items={stripItems(o)} />
            </div>
          ))}
          {scoped.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No orders match this filter.</div>
          )}
        </div>

        {scoped.length > 100 && (
          <div className="border-t p-3 text-center text-[11px] text-muted-foreground">
            Showing first 100 — export CSV for the rest.
          </div>
        )}
      </ReportCard>
      )}

      {tab === "payouts" && (
      <ReportCard title="Payout ledger" hint="Withdrawal requests and payment history.">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-muted/20 text-center text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-center">Requested</th>
              <th className="px-2 py-2 text-center">Amount</th>
              <th className="px-2 py-2 text-center">Status</th>
              <th className="px-2 py-2 text-center">Method</th>
              <th className="px-2 py-2 text-center">Paid at</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-2 py-2 text-center">{new Date(p.requested_at).toLocaleDateString()}</td>
                <td className="px-2 py-2 text-center font-medium">{bdt(Number(p.amount))}</td>
                <td className="px-2 py-2 text-center capitalize">{p.status}</td>
                <td className="px-2 py-2 text-center uppercase text-muted-foreground">{p.method ?? "—"}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">
                  {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
            {payouts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-8 text-center text-muted-foreground">
                  No payout requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ReportCard>
      )}

      {tab === "commission" && commissions.length > 0 && (
        <ReportCard title="Team commission ledger" hint="Commission from your team's delivered orders.">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-muted/20 text-center text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-center">Date</th>
                <th className="px-2 py-2 text-center">Base profit</th>
                <th className="px-2 py-2 text-center">Rate</th>
                <th className="px-2 py-2 text-center">Commission</th>
                <th className="px-2 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-2 py-2 text-center">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground">{bdt(Number(c.base_profit))}</td>
                  <td className="px-2 py-2 text-center">{Number(c.rate)}%</td>
                  <td className="px-2 py-2 text-center font-medium">{bdt(Number(c.amount))}</td>
                  <td className="px-2 py-2 text-center capitalize">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportCard>
      )}

      {tab === "how" && (
      <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
        <div className="mb-1 font-medium text-foreground">How the numbers work</div>
        <ul className="list-disc space-y-1 pl-4">
          <li><b>Sell value</b> = your selling price × quantity (excluding delivery charge).</li>
          <li><b>Admin cost</b> = product price + packaging, paid to admin.</li>
          <li><b>Profit</b> = Sell value − Admin cost. Delivery charge is collected from customer and paid to courier.</li>
          <li>Profit is confirmed once <b>delivered</b>; it stays at risk while a return is pending.</li>
          <li><b>Withdrawable</b> = confirmed profit − paid − pending payout.</li>
        </ul>
      </div>
      )}
    </div>
  );
}

function CsvBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent">
      <Download className="h-3.5 w-3.5" /> CSV
    </button>
  );
}
