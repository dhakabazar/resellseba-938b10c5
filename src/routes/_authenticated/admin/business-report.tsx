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
import { ReportCard, ReportTabs } from "@/components/report-blocks";
import { bdt, toCsv, downloadCsv, isRealizedStatus, type ReportOrder } from "@/lib/finance-report";
import {
  Loader2,
  Download,
  Wallet,
  Package,
  Truck,
  Boxes,
  Percent,
  TrendingDown,
  Award,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/business-report")({
  component: BusinessReportPage,
  head: () => ({
    meta: [
      { title: "Business report — Admin" },
      {
        name: "description",
        content: "Own business P&L: product cost, packaging, admin revenue, delivery margin and net profit.",
      },
      { property: "og:title", content: "Business report — Admin" },
      { property: "og:description", content: "Product wise cost and profit for the admin business." },
    ],
  }),
});

type OrderRow = ReportOrder & {
  customer_name: string;
  customer_phone: string;
  address_line: string | null;
  resellers?: { business_name: string; code: string } | null;
};
type ItemRow = {
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  sa_price: number;
  reseller_price: number;
  line_total: number;
};
type ProductRow = {
  id: string;
  name: string;
  product_code: string;
  buying_price: number;
  packaging_cost: number;
  reseller_price: number;
};
type Shipment = { order_id: string; provider: string; cost: number | null };
type Reseller = { id: string; business_name: string; code: string };
type Commission = { amount: number; status: string; created_at: string };

type Tab = "overview" | "products" | "trend" | "status" | "how";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "products", label: "Product P&L" },
  { key: "trend", label: "Trend" },
  { key: "status", label: "Status split" },
  { key: "how", label: "How it's calculated" },
];

type Line = {
  key: string;
  name: string;
  code: string;
  orders: number;
  qty: number;
  deliveredQty: number;
  returnedQty: number;
  customerSell: number;
  adminRevenue: number;
  buyCost: number;
  packCost: number;
  adminProfit: number;
  resellerShare: number;
  deliveredRevenue: number;
  deliveredCost: number;
  deliveredProfit: number;
};

const th = "px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const td = "px-3 py-2 align-middle";

function BusinessReportPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [filters, setFilters] = useState<OrderFilterState>(DEFAULT_ORDER_FILTERS);
  const [tab, setTab] = useState<Tab>("overview");
  const [gran, setGran] = useState<"day" | "month">("day");
  const [productQ, setProductQ] = useState("");
  const [basis, setBasis] = useState<"delivered" | "all">("delivered");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [o, it, p, s, r, c] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id,order_number,reseller_id,status,created_at,customer_name,customer_phone,address_line,subtotal,shipping_cost,discount,total,sa_cost_total,reseller_profit,received_amount,packaging_total,resellers(business_name,code)",
          )
          .order("created_at", { ascending: false }),
        supabase.from("order_items").select("order_id,product_id,product_name,quantity,sa_price,reseller_price,line_total"),
        supabase.from("products").select("id,name,product_code,buying_price,packaging_cost,reseller_price"),
        supabase.from("shipments").select("order_id,provider,cost"),
        supabase.from("resellers").select("id,business_name,code"),
        supabase.from("leader_commissions").select("amount,status,created_at"),
      ]);
      setOrders((o.data ?? []) as unknown as OrderRow[]);
      setItems((it.data ?? []) as unknown as ItemRow[]);
      setProducts((p.data ?? []) as unknown as ProductRow[]);
      setShipments((s.data ?? []) as Shipment[]);
      setResellers((r.data ?? []) as Reseller[]);
      setCommissions((c.data ?? []) as Commission[]);
      setLoading(false);
    })();
  }, []);

  const scoped = useMemo(() => applyOrderFilters(orders, filters), [orders, filters]);
  const orderById = useMemo(() => new Map(scoped.map((o) => [o.id, o])), [scoped]);
  const scopedItems = useMemo(() => items.filter((i) => orderById.has(i.order_id)), [items, orderById]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  /** Product wise admin P&L. Admin revenue = what the reseller pays admin (sa_price). */
  const lines = useMemo(() => {
    const map = new Map<string, Line & { orderIds: Set<string> }>();
    for (const i of scopedItems) {
      const o = orderById.get(i.order_id);
      if (!o) continue;
      const p = i.product_id ? productById.get(i.product_id) : undefined;
      const key = i.product_id ?? `name:${i.product_name}`;
      const row =
        map.get(key) ??
        ({
          key,
          name: p?.name ?? i.product_name,
          code: p?.product_code ?? "—",
          orders: 0,
          qty: 0,
          deliveredQty: 0,
          returnedQty: 0,
          customerSell: 0,
          adminRevenue: 0,
          buyCost: 0,
          packCost: 0,
          adminProfit: 0,
          resellerShare: 0,
          deliveredRevenue: 0,
          deliveredCost: 0,
          deliveredProfit: 0,
          orderIds: new Set<string>(),
        } as Line & { orderIds: Set<string> });

      const qty = Number(i.quantity);
      const pack = Number(p?.packaging_cost ?? 0) * qty;
      const buy = Number(p?.buying_price ?? 0) * qty;
      const adminRev = Number(i.sa_price) * qty;
      const sell = Number(i.line_total);

      row.orderIds.add(i.order_id);
      row.qty += qty;
      row.customerSell += sell;
      row.adminRevenue += adminRev;
      row.buyCost += buy;
      row.packCost += pack;
      row.resellerShare += sell - adminRev;
      if (isRealizedStatus(o.status)) {
        row.deliveredQty += qty;
        row.deliveredRevenue += adminRev;
        row.deliveredCost += buy + pack;
      } else if (o.status === "returned" || o.status === "cancelled") {
        row.returnedQty += qty;
      }
      map.set(key, row);
    }
    let rows = Array.from(map.values()).map((r) => {
      r.orders = r.orderIds.size;
      r.adminProfit = r.adminRevenue - r.buyCost - r.packCost;
      r.deliveredProfit = r.deliveredRevenue - r.deliveredCost;
      return r as Line;
    });
    const q = productQ.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
    return rows.sort((a, b) =>
      basis === "delivered" ? b.deliveredProfit - a.deliveredProfit : b.adminProfit - a.adminProfit,
    );
  }, [scopedItems, orderById, productById, productQ, basis]);

  /** Courier cost and delivery collection on the scoped set. */
  const delivery = useMemo(() => {
    const deliveredIds = new Set(scoped.filter((o) => isRealizedStatus(o.status)).map((o) => o.id));
    const failedIds = new Set(
      scoped.filter((o) => o.status === "returned" || o.status === "pending_return").map((o) => o.id),
    );
    let courierCost = 0;
    let lostCourierCost = 0;
    for (const s of shipments) {
      if (!orderById.has(s.order_id)) continue;
      const cost = Number(s.cost ?? 0);
      courierCost += cost;
      if (failedIds.has(s.order_id)) lostCourierCost += cost;
    }
    const collected = scoped
      .filter((o) => (basis === "delivered" ? deliveredIds.has(o.id) : true))
      .reduce((t, o) => t + Number(o.shipping_cost), 0);
    return { courierCost, lostCourierCost, collected, margin: collected - courierCost };
  }, [scoped, shipments, orderById, basis]);

  const totals = useMemo(() => {
    const pick = <K extends keyof Line>(k: K) => lines.reduce((t, l) => t + Number(l[k]), 0);
    const revenue = basis === "delivered" ? pick("deliveredRevenue") : pick("adminRevenue");
    const cost = basis === "delivered" ? pick("deliveredCost") : pick("buyCost") + pick("packCost");
    const grossProfit = revenue - cost;
    const commissionDue = commissions.reduce((t, c) => t + Number(c.amount), 0);
    return {
      revenue,
      cost,
      buy: pick("buyCost"),
      pack: pick("packCost"),
      grossProfit,
      qty: basis === "delivered" ? pick("deliveredQty") : pick("qty"),
      customerSell: pick("customerSell"),
      resellerShare: pick("resellerShare"),
      commissionDue,
      net: grossProfit + delivery.margin - commissionDue,
      margin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    };
  }, [lines, basis, delivery.margin, commissions]);

  /** Trend on admin P&L (order date bucketed). */
  const trend = useMemo(() => {
    const buckets = new Map<string, { key: string; orders: number; revenue: number; cost: number; profit: number }>();
    const itemsByOrder = new Map<string, ItemRow[]>();
    for (const i of scopedItems) {
      const arr = itemsByOrder.get(i.order_id) ?? [];
      arr.push(i);
      itemsByOrder.set(i.order_id, arr);
    }
    for (const o of scoped) {
      if (basis === "delivered" && !isRealizedStatus(o.status)) continue;
      const d = new Date(o.created_at);
      const key =
        gran === "month"
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          : d.toISOString().slice(0, 10);
      const b = buckets.get(key) ?? { key, orders: 0, revenue: 0, cost: 0, profit: 0 };
      b.orders += 1;
      for (const i of itemsByOrder.get(o.id) ?? []) {
        const p = i.product_id ? productById.get(i.product_id) : undefined;
        const qty = Number(i.quantity);
        b.revenue += Number(i.sa_price) * qty;
        b.cost += (Number(p?.buying_price ?? 0) + Number(p?.packaging_cost ?? 0)) * qty;
      }
      b.profit = b.revenue - b.cost;
      buckets.set(key, b);
    }
    return Array.from(buckets.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [scoped, scopedItems, productById, gran, basis]);

  /** Status split on admin P&L. */
  const statusSplit = useMemo(() => {
    const map = new Map<string, { status: string; orders: number; revenue: number; cost: number; profit: number }>();
    const itemsByOrder = new Map<string, ItemRow[]>();
    for (const i of scopedItems) {
      const arr = itemsByOrder.get(i.order_id) ?? [];
      arr.push(i);
      itemsByOrder.set(i.order_id, arr);
    }
    for (const o of scoped) {
      const b = map.get(o.status) ?? { status: o.status, orders: 0, revenue: 0, cost: 0, profit: 0 };
      b.orders += 1;
      for (const i of itemsByOrder.get(o.id) ?? []) {
        const p = i.product_id ? productById.get(i.product_id) : undefined;
        const qty = Number(i.quantity);
        b.revenue += Number(i.sa_price) * qty;
        b.cost += (Number(p?.buying_price ?? 0) + Number(p?.packaging_cost ?? 0)) * qty;
      }
      b.profit = b.revenue - b.cost;
      map.set(o.status, b);
    }
    return Array.from(map.values()).sort((a, b) => b.orders - a.orders);
  }, [scoped, scopedItems, productById]);

  const exportProducts = () =>
    downloadCsv(
      "business-report-products.csv",
      toCsv(
        [
          "Product",
          "Code",
          "Orders",
          "Qty",
          "Delivered qty",
          "Returned qty",
          "Customer paid",
          "Admin revenue",
          "Buying cost",
          "Packaging",
          "Admin profit",
          "Delivered profit",
          "Reseller share",
        ],
        lines.map((l) => [
          l.name,
          l.code,
          l.orders,
          l.qty,
          l.deliveredQty,
          l.returnedQty,
          l.customerSell,
          l.adminRevenue,
          l.buyCost,
          l.packCost,
          l.adminProfit,
          l.deliveredProfit,
          l.resellerShare,
        ]),
      ),
    );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Business report"
        description="Own P&L — buying cost, packaging, admin revenue, delivery margin and net profit."
        actions={
          <div className="flex items-center gap-2">
            <div className="surface-card flex items-center gap-1 p-1">
              {(["delivered", "all"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBasis(b)}
                  className={
                    "rounded-md px-3 py-1.5 text-xs font-medium " +
                    (basis === b ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")
                  }
                >
                  {b === "delivered" ? "Delivered + partial" : "All orders"}
                </button>
              ))}
            </div>
            <button type="button" onClick={exportProducts} className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export
            </button>
          </div>
        }
      />

      <OrderFilterBar
        value={filters}
        onChange={setFilters}
        resellerOptions={resellers.map((r) => ({ value: r.id, label: `${r.business_name} (${r.code})` }))}
        total={orders.length}
        shown={scoped.length}
        showPerPage
        variant="report"
      />

      <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Admin revenue"
          value={bdt(totals.revenue)}
          hint={`${basis === "delivered" ? "Delivered + partial orders" : "All scoped orders"} · ${totals.qty} qty · customer paid ${bdt(totals.customerSell)}`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Product + packaging cost"
          value={bdt(totals.cost)}
          hint={`Buying ${bdt(totals.buy)} · Packaging ${bdt(totals.pack)}`}
          icon={<Boxes className="h-4 w-4" />}
          tone="violet"
        />
        <StatCard
          label="Gross profit"
          value={bdt(totals.grossProfit)}
          hint={`Admin revenue − product & packaging cost · ${totals.margin.toFixed(1)}% margin`}
          icon={<Package className="h-4 w-4" />}
          tone="emerald"
        />
        <StatCard
          label="Net business profit"
          value={bdt(totals.net)}
          hint={`Gross profit ${bdt(totals.grossProfit)} + delivery margin ${bdt(delivery.margin)} − leader commission ${bdt(totals.commissionDue)}`}
          icon={<Percent className="h-4 w-4" />}
        />
        <StatCard
          label="Delivery collected"
          value={bdt(delivery.collected)}
          hint={`Delivery charge on ${basis === "delivered" ? "delivered + partial" : "all scoped"} orders · courier bill ${bdt(delivery.courierCost)}`}
          icon={<Truck className="h-4 w-4" />}
          tone="sky"
        />
        <StatCard
          label="Delivery margin"
          value={bdt(delivery.margin)}
          hint={`Collected ${bdt(delivery.collected)} − courier bill ${bdt(delivery.courierCost)}`}
          icon={<Truck className="h-4 w-4" />}
          tone="sky"
        />
        <StatCard
          label="Return courier loss"
          value={bdt(delivery.lostCourierCost)}
          hint="Courier bill on returned / pending-return shipments — never recovered"
          icon={<TrendingDown className="h-4 w-4" />}
          tone="rose"
        />
        <StatCard
          label="Leader commission"
          value={bdt(totals.commissionDue)}
          hint={`Commission on this date range · paid ${bdt(totals.commissionPaid)}`}
          icon={<Award className="h-4 w-4" />}
          tone="amber"
        />
      </div>

      <ReportTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "overview" && (
        <ReportCard title="Top products by profit" hint="Highest contributing products on this filter">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/20 text-left">
              <tr>
                <th className={th}>Product</th>
                <th className={`${th} text-right`}>Qty</th>
                <th className={`${th} text-right`}>Admin revenue</th>
                <th className={`${th} text-right`}>Cost</th>
                <th className={`${th} text-right`}>Profit</th>
                <th className={`${th} text-right`}>Margin</th>
              </tr>
            </thead>
            <tbody>
              {lines.slice(0, 10).map((l) => {
                const rev = basis === "delivered" ? l.deliveredRevenue : l.adminRevenue;
                const cost = basis === "delivered" ? l.deliveredCost : l.buyCost + l.packCost;
                const profit = rev - cost;
                return (
                  <tr key={l.key} className="border-t">
                    <td className={td}>
                      <div className="font-medium">{l.name}</div>
                      <div className="text-[11px] text-muted-foreground">#{l.code}</div>
                    </td>
                    <td className={`${td} text-right`}>{basis === "delivered" ? l.deliveredQty : l.qty}</td>
                    <td className={`${td} text-right`}>{bdt(rev)}</td>
                    <td className={`${td} text-right`}>{bdt(cost)}</td>
                    <td className={`${td} text-right font-semibold`}>{bdt(profit)}</td>
                    <td className={`${td} text-right`}>{rev > 0 ? `${((profit / rev) * 100).toFixed(1)}%` : "—"}</td>
                  </tr>
                );
              })}
              {lines.length === 0 && (
                <tr>
                  <td className={`${td} text-center text-muted-foreground`} colSpan={6}>
                    No sales in this range
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ReportCard>
      )}

      {tab === "products" && (
        <ReportCard
          title="Product wise cost & profit"
          hint="Admin revenue is the reseller-paid price; reseller share is customer price above it"
          right={
            <input
              value={productQ}
              onChange={(e) => setProductQ(e.target.value)}
              placeholder="Search product or code"
              className="h-9 w-52 rounded-lg border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-primary/30"
            />
          }
        >
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-muted/20 text-left">
              <tr>
                <th className={th}>Product</th>
                <th className={`${th} text-right`}>Orders</th>
                <th className={`${th} text-right`}>Qty</th>
                <th className={`${th} text-right`}>Delivered</th>
                <th className={`${th} text-right`}>Returned</th>
                <th className={`${th} text-right`}>Customer paid</th>
                <th className={`${th} text-right`}>Admin revenue</th>
                <th className={`${th} text-right`}>Buying</th>
                <th className={`${th} text-right`}>Packaging</th>
                <th className={`${th} text-right`}>Admin profit</th>
                <th className={`${th} text-right`}>Delivered profit</th>
                <th className={`${th} text-right`}>Reseller share</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className="border-t">
                  <td className={td}>
                    <div className="font-medium">{l.name}</div>
                    <div className="text-[11px] text-muted-foreground">#{l.code}</div>
                  </td>
                  <td className={`${td} text-right`}>{l.orders}</td>
                  <td className={`${td} text-right`}>{l.qty}</td>
                  <td className={`${td} text-right`}>{l.deliveredQty}</td>
                  <td className={`${td} text-right`}>{l.returnedQty}</td>
                  <td className={`${td} text-right`}>{bdt(l.customerSell)}</td>
                  <td className={`${td} text-right`}>{bdt(l.adminRevenue)}</td>
                  <td className={`${td} text-right`}>{bdt(l.buyCost)}</td>
                  <td className={`${td} text-right`}>{bdt(l.packCost)}</td>
                  <td className={`${td} text-right font-semibold`}>{bdt(l.adminProfit)}</td>
                  <td className={`${td} text-right`}>{bdt(l.deliveredProfit)}</td>
                  <td className={`${td} text-right text-muted-foreground`}>{bdt(l.resellerShare)}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td className={`${td} text-center text-muted-foreground`} colSpan={12}>
                    No sales in this range
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ReportCard>
      )}

      {tab === "trend" && (
        <ReportCard
          title="Profit trend"
          hint="Bucketed by order date"
          right={
            <div className="surface-card flex items-center gap-1 p-1">
              {(["day", "month"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGran(g)}
                  className={
                    "rounded-md px-3 py-1 text-xs font-medium " +
                    (gran === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")
                  }
                >
                  {g === "day" ? "Daily" : "Monthly"}
                </button>
              ))}
            </div>
          }
        >
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/20 text-left">
              <tr>
                <th className={th}>{gran === "day" ? "Date" : "Month"}</th>
                <th className={`${th} text-right`}>Orders</th>
                <th className={`${th} text-right`}>Admin revenue</th>
                <th className={`${th} text-right`}>Cost</th>
                <th className={`${th} text-right`}>Profit</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((b) => (
                <tr key={b.key} className="border-t">
                  <td className={td}>{b.key}</td>
                  <td className={`${td} text-right`}>{b.orders}</td>
                  <td className={`${td} text-right`}>{bdt(b.revenue)}</td>
                  <td className={`${td} text-right`}>{bdt(b.cost)}</td>
                  <td className={`${td} text-right font-semibold`}>{bdt(b.profit)}</td>
                </tr>
              ))}
              {trend.length === 0 && (
                <tr>
                  <td className={`${td} text-center text-muted-foreground`} colSpan={5}>
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ReportCard>
      )}

      {tab === "status" && (
        <ReportCard title="Status split" hint="Admin revenue and cost locked by current order status">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/20 text-left">
              <tr>
                <th className={th}>Status</th>
                <th className={`${th} text-right`}>Orders</th>
                <th className={`${th} text-right`}>Admin revenue</th>
                <th className={`${th} text-right`}>Cost</th>
                <th className={`${th} text-right`}>Profit</th>
              </tr>
            </thead>
            <tbody>
              {statusSplit.map((s) => (
                <tr key={s.status} className="border-t">
                  <td className={`${td} capitalize`}>{s.status.replace(/_/g, " ")}</td>
                  <td className={`${td} text-right`}>{s.orders}</td>
                  <td className={`${td} text-right`}>{bdt(s.revenue)}</td>
                  <td className={`${td} text-right`}>{bdt(s.cost)}</td>
                  <td className={`${td} text-right font-semibold`}>{bdt(s.profit)}</td>
                </tr>
              ))}
              {statusSplit.length === 0 && (
                <tr>
                  <td className={`${td} text-center text-muted-foreground`} colSpan={5}>
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ReportCard>
      )}

      {tab === "how" && (
        <ReportCard title="How it's calculated">
          <ul className="space-y-2 p-4 text-sm text-muted-foreground">
            <li>Admin revenue = reseller price + packaging charged to the reseller, per sold unit.</li>
            <li>Cost = product buying price + packaging cost, per sold unit.</li>
            <li>Admin profit = admin revenue − cost. Delivered profit counts delivered orders only.</li>
            <li>Reseller share = customer paid amount above admin revenue (never part of admin profit).</li>
            <li>Delivery margin = delivery collected from customers − courier bills on booked shipments.</li>
            <li>Net business profit = gross profit + delivery margin − leader commission ledger.</li>
            <li>Every block follows the filter bar above (date range, reseller, search).</li>
          </ul>
        </ReportCard>
      )}
    </div>
  );
}
