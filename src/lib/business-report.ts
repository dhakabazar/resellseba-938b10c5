import {
  isFailedOrder,
  isRealizedStatus,
  orderProfit,
  orderReceived,
  orderPackaging,
  orderDeliveryCost,
  type ProfitOrder,
} from "@/lib/finance-report";

const n = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

export type BizOrder = ProfitOrder & {
  id: string;
  order_number: string;
  reseller_id: string | null;
  status: string;
  created_at: string;
  total: number | string;
  resellers?: { business_name: string; code: string } | null;
};

export type BizItem = {
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  returned_qty?: number | null;
  sa_price: number | string;
  line_total: number | string;
  profit: number | string;
  /** Cost snapshot frozen when the line was created (see snapshotCost). */
  buying_price?: number | string | null;
  packaging_cost?: number | string | null;
};

export type BizProduct = {
  id: string;
  name: string;
  product_code: string;
  buying_price: number | string;
  packaging_cost: number | string;
  og_image_url: string | null;
};

export type Expense = {
  id: string;
  title: string;
  category: string;
  amount: number | string;
  spent_on: string;
  method: string | null;
  reference: string | null;
  note: string | null;
  created_at: string;
};

export const EXPENSE_CATEGORIES = [
  "delivery",
  "packaging",
  "salary",
  "marketing",
  "office",
  "courier",
  "refund",
  "other",
] as const;

export const ADMIN_PROFIT_HINT =
  "Admin profit = money received for the order − what the reseller finally earns − admin buying price of the products the customer kept. Advance already collected counts as received (the same way the transaction report does it). Delivery charge and packaging are not deducted twice here — record them once in Expenses and the net profit takes them out.";

/**
 * Quantity of an item the customer actually kept.
 * Fully failed statuses keep nothing; an in-flight order still counts the full
 * quantity, otherwise a pending order would look like it had zero product cost.
 */
export function keptQty(item: BizItem, status: string) {
  if (status === "cancelled" || status === "returned" || status === "pending_return" || status === "partial_delivery")
    return 0;
  return Math.max(Number(item.quantity) - Number(item.returned_qty ?? 0), 0);
}

/**
 * Reseller-side product cost of the kept items, mirroring the SQL
 * `order_kept_product_cost` (proportional share of sa_cost_total) so client math
 * and the DB-stored profit never disagree on `partial_item` orders.
 */
export function keptProductCost(o: BizOrder | ProfitOrder, items: BizItem[]) {
  const full = items.reduce((s, it) => s + n(it.sa_price) * Number(it.quantity), 0);
  const kept = items.reduce((s, it) => s + n(it.sa_price) * keptQty(it, String(o.status ?? "")), 0);
  const productCost = Math.max(n(o.sa_cost_total) - n(o.packaging_total), 0);
  if (full <= 0) return productCost;
  return Math.round(productCost * (kept / full) * 100) / 100;
}

/** Order object with the kept-product cost attached, ready for orderProfit(). */
export function withKeptCost<T extends BizOrder | ProfitOrder>(o: T, items: BizItem[]): T {
  return { ...o, kept_product_cost: keptProductCost(o, items) };
}



/**
 * Buying price used for reporting: always the value frozen on the order line, so
 * changing a product's price later never rewrites past orders. Only very old
 * lines with no snapshot fall back to the product record.
 */
export function lineBuyingPrice(it: BizItem, products: Map<string, BizProduct>) {
  const snap = n(it.buying_price);
  if (snap > 0) return snap;
  const p = it.product_id ? products.get(it.product_id) : undefined;
  return n(p?.buying_price);
}

/** Admin buying cost of the kept items of one order. */
export function orderBuyingCost(items: BizItem[], status: string, products: Map<string, BizProduct>) {
  let cost = 0;
  for (const it of items) cost += lineBuyingPrice(it, products) * keptQty(it, status);
  return cost;
}

/**
 * Admin profit of one order (see ADMIN_PROFIT_HINT).
 * Uses the reseller margin BEFORE the advance settlement — an advance held by the
 * reseller is part of the order value, not extra admin income.
 */
export function adminOrderProfit(o: BizOrder, buyingCost: number) {
  return orderReceived(o) - orderMargin(o) - buyingCost;
}

/* ----------------------------- product report ---------------------------- */

export type ProductRow = {
  key: string;
  name: string;
  code: string;
  image: string | null;
  orders: number;
  qty: number;
  saleQty: number;
  returnedQty: number;
  sellValue: number;
  adminRevenue: number;
  buyCost: number;
  adminProfit: number;
  resellerProfit: number;
};

export function buildProductRows(
  orders: BizOrder[],
  items: BizItem[],
  products: Map<string, BizProduct>,
): ProductRow[] {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const map = new Map<string, ProductRow & { _orders: Set<string> }>();
  for (const it of items) {
    const o = byId.get(it.order_id);
    if (!o) continue;
    const p = it.product_id ? products.get(it.product_id) : undefined;
    const key = it.product_id ?? `name:${it.product_name}`;
    let row = map.get(key);
    if (!row) {
      row = {
        key,
        name: p?.name ?? it.product_name,
        code: p?.product_code ?? "—",
        image: p?.og_image_url ?? null,
        orders: 0,
        qty: 0,
        saleQty: 0,
        returnedQty: 0,
        sellValue: 0,
        adminRevenue: 0,
        buyCost: 0,
        adminProfit: 0,
        resellerProfit: 0,
        _orders: new Set<string>(),
      };
      map.set(key, row);
    }
    const kept = keptQty(it, o.status);
    row._orders.add(it.order_id);
    row.qty += Number(it.quantity);
    row.saleQty += kept;
    row.returnedQty += Math.max(Number(it.quantity) - kept, 0);
    row.sellValue += n(it.line_total);
    row.adminRevenue += n(it.sa_price) * kept;
    row.buyCost += lineBuyingPrice(it, products) * kept;
    if (kept > 0) row.resellerProfit += (n(it.profit) / Math.max(Number(it.quantity), 1)) * kept;
  }
  return Array.from(map.values())
    .map(({ _orders, ...r }) => ({ ...r, orders: _orders.size, adminProfit: r.adminRevenue - r.buyCost }))
    .sort((a, b) => b.saleQty - a.saleQty);
}

/* ---------------------------- reseller report ---------------------------- */

export type ResellerRow = {
  key: string;
  name: string;
  code: string;
  orders: number;
  delivered: number;
  failed: number;
  value: number;
  received: number;
  advance: number;
  resellerProfit: number;
  adminProfit: number;
};

export function buildResellerRows(
  orders: BizOrder[],
  items: BizItem[],
  products: Map<string, BizProduct>,
): ResellerRow[] {
  const itemsByOrder = new Map<string, BizItem[]>();
  for (const it of items) {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push(it);
    itemsByOrder.set(it.order_id, arr);
  }
  const map = new Map<string, ResellerRow>();
  for (const o of orders) {
    const key = o.reseller_id ?? "none";
    const row =
      map.get(key) ??
      ({
        key,
        name: o.resellers?.business_name ?? "Unassigned",
        code: o.resellers?.code ?? "—",
        orders: 0,
        delivered: 0,
        failed: 0,
        value: 0,
        received: 0,
        advance: 0,
        resellerProfit: 0,
        adminProfit: 0,
      } as ResellerRow);
    const myItems = itemsByOrder.get(o.id) ?? [];
    const ord = withKeptCost(o, myItems);
    const buy = orderBuyingCost(myItems, o.status, products);
    row.orders += 1;
    if (isRealizedStatus(o.status)) row.delivered += 1;
    if (isFailedOrder(o)) row.failed += 1;
    row.value += n(o.total);
    row.received += orderReceived(ord);
    row.advance += Math.max(n(o.advance_amount), 0);
    row.resellerProfit += orderProfit(ord);
    row.adminProfit += adminOrderProfit(ord, buy);
    map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => b.orders - a.orders);
}

/* ----------------------------- courier report ---------------------------- */

export type CourierRow = {
  key: string;
  name: string;
  parcels: number;
  delivered: number;
  returned: number;
  value: number;
  received: number;
  courierBill: number;
  adminProfit: number;
};

export const COURIER_LABEL: Record<string, string> = {
  steadfast: "Steadfast",
  pathao: "Pathao",
  carrybee: "Carrybee",
  none: "Not booked yet",
};

export function buildCourierRows(
  orders: BizOrder[],
  items: BizItem[],
  products: Map<string, BizProduct>,
  shipments: { order_id: string; provider: string; cost: number | string | null }[],
): CourierRow[] {
  const itemsByOrder = new Map<string, BizItem[]>();
  for (const it of items) {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push(it);
    itemsByOrder.set(it.order_id, arr);
  }
  const shipByOrder = new Map<string, { provider: string; cost: number }>();
  for (const s of shipments) {
    if (!shipByOrder.has(s.order_id)) shipByOrder.set(s.order_id, { provider: s.provider, cost: n(s.cost) });
  }
  const map = new Map<string, CourierRow>();
  for (const o of orders) {
    const sh = shipByOrder.get(o.id);
    const key = sh?.provider ?? "none";
    const row =
      map.get(key) ??
      ({
        key,
        name: COURIER_LABEL[key] ?? key,
        parcels: 0,
        delivered: 0,
        returned: 0,
        value: 0,
        received: 0,
        courierBill: 0,
        adminProfit: 0,
      } as CourierRow);
    const myItems = itemsByOrder.get(o.id) ?? [];
    const ord = withKeptCost(o, myItems);
    const buy = orderBuyingCost(myItems, o.status, products);
    row.parcels += 1;
    if (isRealizedStatus(o.status)) row.delivered += 1;
    if (isFailedOrder(o)) row.returned += 1;
    row.value += n(o.total);
    row.received += orderReceived(ord);
    row.courierBill += sh ? sh.cost || orderDeliveryCost(o) : 0;
    row.adminProfit += adminOrderProfit(ord, buy);
    map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => b.parcels - a.parcels);
}

/* ------------------------------ profit & loss ---------------------------- */

export type PnL = {
  orders: number;
  value: number;
  received: number;
  advance: number;
  resellerPayout: number;
  buyCost: number;
  grossProfit: number;
  delivery: number;
  packaging: number;
  expenses: number;
  expenseByCategory: { category: string; amount: number }[];
  agentCommission: number;
  netProfit: number;
};

export function buildPnL(
  orders: BizOrder[],
  items: BizItem[],
  products: Map<string, BizProduct>,
  expenses: Expense[],
  agentCommissionTotal = 0,
): PnL {
  const itemsByOrder = new Map<string, BizItem[]>();
  for (const it of items) {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push(it);
    itemsByOrder.set(it.order_id, arr);
  }
  let value = 0;
  let received = 0;
  let advance = 0;
  let resellerPayout = 0;
  let buyCost = 0;
  let delivery = 0;
  let packaging = 0;
  for (const o of orders) {
    const myItems = itemsByOrder.get(o.id) ?? [];
    const ord = withKeptCost(o, myItems);
    const buy = orderBuyingCost(myItems, o.status, products);
    value += n(o.total);
    received += orderReceived(ord);
    advance += Math.max(n(o.advance_amount), 0);
    resellerPayout += orderProfit(ord);
    buyCost += buy;
    delivery += orderDeliveryCost(o);
    packaging += orderPackaging(o);
  }
  const catMap = new Map<string, number>();
  let expenseTotal = 0;
  for (const e of expenses) {
    expenseTotal += n(e.amount);
    catMap.set(e.category, (catMap.get(e.category) ?? 0) + n(e.amount));
  }
  const grossProfit = received - resellerPayout - buyCost;
  return {
    orders: orders.length,
    value,
    received,
    advance,
    resellerPayout,
    buyCost,
    grossProfit,
    delivery,
    packaging,
    expenses: expenseTotal,
    expenseByCategory: Array.from(catMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    agentCommission: agentCommissionTotal,
    netProfit: grossProfit - expenseTotal - agentCommissionTotal,
  };
}

/* ------------------------------ sorting helper --------------------------- */

export type SortDir = "asc" | "desc";

export function sortRows<T>(rows: T[], key: keyof T, dir: SortDir) {
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
    const as = String(av ?? "");
    const bs = String(bv ?? "");
    return dir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
  });
}
