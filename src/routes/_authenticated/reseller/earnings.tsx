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
import { buildFinanceReport, bdt, toCsv, downloadCsv, type ReportItem, type ReportOrder } from "@/lib/finance-report";
import { orderStatusLabel, orderStatusTone } from "@/lib/courier-status";
import { Loader2, Wallet, TrendingUp, Clock, CheckCircle2, AlertTriangle, Truck, Download, Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reseller/earnings")({
  component: EarningsPage,
  head: () => ({
    meta: [
      { title: "Earnings & report — Reseller" },
      { name: "description", content: "Nijer order, profit, commission ar payout er full report." },
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
            "id,order_number,reseller_id,status,created_at,customer_name,customer_phone,address_line,subtotal,shipping_cost,discount,total,sa_cost_total,reseller_profit,order_items(product_id,product_name,quantity,sa_price,reseller_price,profit,line_total)",
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
      setRows((ordersRes.data ?? []) as unknown as Row[]);
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
          Number(o.reseller_profit),
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
    { key: "how", label: "Hisab niyom" },
  ];

  return (
    <div>
      <PageHeader title="Earnings & report" />

      <OrderFilterBar value={filters} onChange={setFilters} total={rows.length} shown={scoped.length} />

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Confirmed profit (delivered)"
          value={bdt(summary.delivered_profit)}
          hint="Lifetime — delivered order theke"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Withdraw kora jabe"
          value={bdt(summary.available)}
          hint={`Paid ${bdt(summary.paid_out)} · Pending ${bdt(summary.pending_payout)}`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Pipeline profit (running)"
          value={bdt(report.pipeline.profit)}
          hint={`${report.pipeline.orders} order delivery hoyni ekhono`}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Team commission (leader)"
          value={bdt(commissionTotals.due)}
          hint={commissions.length ? `Due · Paid ${bdt(commissionTotals.paid)}` : "Apni kono team leader non"}
          icon={<Award className="h-4 w-4" />}
        />
        <StatCard
          label="Delivered sell value"
          value={bdt(report.realized.gross)}
          hint={`${report.realized.orders} order · AOV ${bdt(report.avgOrderValue)}`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Admin cost (delivered)"
          value={bdt(report.realized.adminCost)}
          hint="Product + packaging — admin k dewa"
          icon={<Wallet className="h-4 w-4" />}
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
          hint={`Returned+cancel ${report.lost.orders} · Pending return ${report.risk.orders} · Return rate ${report.returnRate.toFixed(1)}%`}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <ReportTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "overview" && (
      <>
      <ReportCard title="Order status wise report" hint="Order page er tab onujai bucket.">
        <StatusReportTable report={report} />
      </ReportCard>

      <ReportCard title="Raw status split">
        <RawStatusList report={report} />
      </ReportCard>
      </>
      )}

      {tab === "products" && (
      <ReportCard
        title="Product wise profit"
        hint="Kon product theke koto profit pacchen."
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
        hint="Prottek order er cost, delivery ar profit — sob clear."
        right={<CsvBtn onClick={exportOrders} />}
      >
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/20 text-left text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Sell value</th>
              <th className="p-3 text-right">Delivery</th>
              <th className="p-3 text-right">Customer total</th>
              <th className="p-3 text-right">Admin cost</th>
              <th className="p-3 text-right">My profit</th>
            </tr>
          </thead>
          <tbody>
            {scoped.slice(0, 100).map((o) => (
              <tr key={o.id} className="border-t align-top">
                <td className="p-3">
                  <div className="font-mono text-xs font-medium">{o.order_number}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString()} · {o.customer_name}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {(o.order_items ?? []).map((i, idx) => (
                      <div key={idx} className="text-[11px] text-muted-foreground">
                        {i.product_name} × {i.quantity} — cost {bdt(Number(i.sa_price))} / sell {bdt(Number(i.reseller_price))} ={" "}
                        <span className="text-success">{bdt(Number(i.profit))}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="p-3">
                  <span className={"rounded-full px-2 py-0.5 text-[11px] " + orderStatusTone(o.status)}>
                    {orderStatusLabel(o.status)}
                  </span>
                </td>
                <td className="p-3 text-right">{bdt(Number(o.subtotal))}</td>
                <td className="p-3 text-right text-muted-foreground">{bdt(Number(o.shipping_cost))}</td>
                <td className="p-3 text-right">{bdt(Number(o.total))}</td>
                <td className="p-3 text-right text-muted-foreground">{bdt(Number(o.sa_cost_total))}</td>
                <td className={"p-3 text-right font-semibold " + (o.status === "delivered" ? "text-success" : "")}>
                  {bdt(Number(o.reseller_profit))}
                </td>
              </tr>
            ))}
            {scoped.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Ei filter e kono order nai.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {scoped.length > 100 && (
          <div className="border-t p-3 text-center text-[11px] text-muted-foreground">
            Prothom 100 ta dekhano hocche — baki ta CSV export korun.
          </div>
        )}
      </ReportCard>
      )}

      {tab === "payouts" && (
      <ReportCard title="Payout ledger" hint="Withdraw request ar payment history.">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-muted/20 text-left text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Requested</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Method</th>
              <th className="p-3">Paid at</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{new Date(p.requested_at).toLocaleDateString()}</td>
                <td className="p-3 text-right font-medium">{bdt(Number(p.amount))}</td>
                <td className="p-3 capitalize">{p.status}</td>
                <td className="p-3 uppercase text-muted-foreground">{p.method ?? "—"}</td>
                <td className="p-3 text-muted-foreground">
                  {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
            {payouts.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  Ekhono kono payout request nai.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ReportCard>
      )}

      {tab === "commission" && commissions.length > 0 && (
        <ReportCard title="Team commission ledger" hint="Apnar team er delivered order theke commission.">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-muted/20 text-left text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3 text-right">Base profit</th>
                <th className="p-3 text-right">Rate</th>
                <th className="p-3 text-right">Commission</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="p-3 text-right text-muted-foreground">{bdt(Number(c.base_profit))}</td>
                  <td className="p-3 text-right">{Number(c.rate)}%</td>
                  <td className="p-3 text-right font-medium">{bdt(Number(c.amount))}</td>
                  <td className="p-3 capitalize">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportCard>
      )}

      {tab === "how" && (
      <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
        <div className="mb-1 font-medium text-foreground">Hisab kivabe hoy</div>
        <ul className="list-disc space-y-1 pl-4">
          <li><b>Sell value</b> = apnar selling price × qty (delivery charge chara).</li>
          <li><b>Admin cost</b> = product price + packaging — eta admin er.</li>
          <li><b>Profit</b> = Sell value − Admin cost. Delivery charge customer theke niye courier k dewa hoy.</li>
          <li><b>Delivered</b> hole profit confirm, pending return hole ekhono risk e.</li>
          <li><b>Withdraw</b> = confirmed profit − paid − pending payout.</li>
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
