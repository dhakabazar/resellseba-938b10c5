import { ORDER_TABS, type OrderTabKey } from "@/lib/courier-status";

/** Minimal order shape needed by every finance report (admin + reseller). */
export type ReportOrder = {
  id: string;
  order_number: string;
  reseller_id: string;
  status: string;
  created_at: string;
  subtotal: number | string;
  shipping_cost: number | string;
  discount?: number | string | null;
  total: number | string;
  sa_cost_total: number | string;
  reseller_profit: number | string;
};

export type ReportItem = {
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  sa_price: number | string;
  reseller_price: number | string;
  line_total: number | string;
  profit: number | string;
};

const n = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

/**
 * Single source of truth for order profit.
 * Profit = customer total − delivery charge − (product cost + packaging cost).
 * Derived from the order total so a changed delivery charge or product price
 * always stays correct, instead of trusting a stale stored value.
 */
export function orderProfit(o: {
  total: number | string;
  shipping_cost: number | string;
  sa_cost_total: number | string;
}) {
  return n(o.total) - n(o.shipping_cost) - n(o.sa_cost_total);
}

/** Reusable hint shown on every profit report/card so the math is transparent. */
export const PROFIT_FORMULA_HINT =
  "Profit = customer total − delivery charge − product cost − packaging cost. Always derived from the order total, so delivery or price changes stay accurate.";


/** Money bucket used across all report tables. */
export type MoneyBucket = {
  orders: number;
  gross: number; // customer sell (subtotal, delivery baade)
  delivery: number;
  customerTotal: number;
  adminCost: number; // reseller_price + packaging
  profit: number; // reseller profit
};

const emptyBucket = (): MoneyBucket => ({
  orders: 0,
  gross: 0,
  delivery: 0,
  customerTotal: 0,
  adminCost: 0,
  profit: 0,
});

function addOrder(b: MoneyBucket, o: ReportOrder) {
  b.orders += 1;
  b.gross += n(o.subtotal);
  b.delivery += n(o.shipping_cost);
  b.customerTotal += n(o.total);
  b.adminCost += n(o.sa_cost_total);
  b.profit += orderProfit(o);
}

/** status -> order tab key (same buckets as the order list tabs). */
export function statusTab(status: string): OrderTabKey {
  for (const t of ORDER_TABS) {
    if (t.key !== "all" && (t.statuses as string[]).includes(status)) return t.key;
  }
  return "all";
}

export const REALIZED_STATUSES = ["delivered"];
export const LOST_STATUSES = ["returned", "cancelled"];
export const RISK_STATUSES = ["pending_return"];
/** Money still moving — not yet earned, not yet lost. */
export const PIPELINE_STATUSES = [
  "draft",
  "pending",
  "confirmed",
  "forwarded",
  "ready_to_ship",
  "processing",
  "shipped",
];

export type ProductLine = {
  key: string;
  name: string;
  orders: number;
  qty: number;
  deliveredQty: number;
  gross: number;
  cost: number;
  profit: number;
  deliveredProfit: number;
};

export type TrendPoint = {
  key: string; // YYYY-MM-DD or YYYY-MM
  orders: number;
  gross: number;
  profit: number;
  deliveredProfit: number;
};

export type FinanceReport = {
  all: MoneyBucket;
  byStatusTab: Record<OrderTabKey, MoneyBucket>;
  byStatus: Record<string, MoneyBucket>;
  realized: MoneyBucket;
  pipeline: MoneyBucket;
  risk: MoneyBucket;
  lost: MoneyBucket;
  products: ProductLine[];
  trend: TrendPoint[];
  deliveryRate: number; // delivered / (delivered + returned + cancelled)
  returnRate: number;
  avgOrderValue: number;
};

export function buildFinanceReport(
  orders: ReportOrder[],
  items: ReportItem[],
  opts: { trend?: "day" | "month" } = {},
): FinanceReport {
  const byStatusTab = {} as Record<OrderTabKey, MoneyBucket>;
  for (const t of ORDER_TABS) byStatusTab[t.key] = emptyBucket();
  const byStatus: Record<string, MoneyBucket> = {};
  const all = emptyBucket();
  const realized = emptyBucket();
  const pipeline = emptyBucket();
  const risk = emptyBucket();
  const lost = emptyBucket();

  const statusOf = new Map<string, string>();
  const trendMap = new Map<string, TrendPoint>();
  const gran = opts.trend ?? "day";

  for (const o of orders) {
    statusOf.set(o.id, o.status);
    addOrder(all, o);
    addOrder(byStatusTab[statusTab(o.status)] ?? byStatusTab.all, o);
    byStatus[o.status] = byStatus[o.status] ?? emptyBucket();
    addOrder(byStatus[o.status], o);
    if (REALIZED_STATUSES.includes(o.status)) addOrder(realized, o);
    else if (LOST_STATUSES.includes(o.status)) addOrder(lost, o);
    else if (RISK_STATUSES.includes(o.status)) addOrder(risk, o);
    else addOrder(pipeline, o);

    const d = new Date(o.created_at);
    const key =
      gran === "month"
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const tp = trendMap.get(key) ?? { key, orders: 0, gross: 0, profit: 0, deliveredProfit: 0 };
    tp.orders += 1;
    tp.gross += n(o.subtotal);
    tp.profit += orderProfit(o);
    if (o.status === "delivered") tp.deliveredProfit += orderProfit(o);

    trendMap.set(key, tp);
  }

  const prodMap = new Map<string, ProductLine & { _orders: Set<string> }>();
  for (const it of items) {
    const st = statusOf.get(it.order_id);
    if (!st) continue; // item of an order outside the current filter
    const key = it.product_id ?? it.product_name;
    let p = prodMap.get(key);
    if (!p) {
      p = {
        key,
        name: it.product_name,
        orders: 0,
        qty: 0,
        deliveredQty: 0,
        gross: 0,
        cost: 0,
        profit: 0,
        deliveredProfit: 0,
        _orders: new Set<string>(),
      };
      prodMap.set(key, p);
    }
    p._orders.add(it.order_id);
    p.qty += it.quantity;
    p.gross += n(it.line_total);
    p.cost += n(it.sa_price) * it.quantity;
    p.profit += n(it.profit);
    if (st === "delivered") {
      p.deliveredQty += it.quantity;
      p.deliveredProfit += n(it.profit);
    }
  }
  const products = Array.from(prodMap.values())
    .map(({ _orders, ...p }) => ({ ...p, orders: _orders.size }))
    .sort((a, b) => b.gross - a.gross);

  const settled = realized.orders + lost.orders;
  return {
    all,
    byStatusTab,
    byStatus,
    realized,
    pipeline,
    risk,
    lost,
    products,
    trend: Array.from(trendMap.values()).sort((a, b) => (a.key < b.key ? 1 : -1)),
    deliveryRate: settled ? (realized.orders / settled) * 100 : 0,
    returnRate: settled ? (lost.orders / settled) * 100 : 0,
    avgOrderValue: all.orders ? all.customerTotal / all.orders : 0,
  };
}

export const bdt = (v: number) =>
  `৳${Math.round(v).toLocaleString("en-US")}`;

/** Simple CSV builder used by every report export. */
export function toCsv(headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
