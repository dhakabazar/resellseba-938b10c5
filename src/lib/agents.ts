import { orderProfit, orderReceived, type ProfitOrder } from "@/lib/finance-report";
import type { LedgerRow } from "@/components/ledger-timeline";

/** How an agent earns: a % of settled net profit, or a flat amount per delivered product unit. */
export type CommissionMode = "percent" | "per_product";

export type Agent = {
  id: string;
  user_id: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  sale_target: number;
  commission_rate: number;
  commission_mode: CommissionMode;
  commission_per_unit: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

/** Only the commission settings — enough for every money helper below. */
export type CommissionPlan = {
  commission_rate?: number | string | null;
  commission_mode?: string | null;
  commission_per_unit?: number | string | null;
};

export type AgentOrder = ProfitOrder & {
  id: string;
  reseller_id: string | null;
  created_at: string;
  /** Product units the customer actually kept (from agent_order_units). */
  units?: number | null;
};


export type AgentPayout = {
  id: string;
  agent_id: string;
  amount: number | string;
  kind: string; // payment | advance
  status: string; // pending | approved | paid | rejected
  method: string | null;
  reference: string | null;
  note: string | null;
  admin_note: string | null;
  period_from: string | null;
  period_to: string | null;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
};

/** Only these settled statuses earn agent commission: full delivery, or partial where items were kept. */
export const COMMISSION_STATUSES = ["delivered", "partial", "partial_full", "partial_item"] as const;

/** True when the order earns agent commission (returned / partial_delivery / damaged / cancelled do not). */
export function isCommissionOrder(status: string | null | undefined) {
  return (COMMISSION_STATUSES as readonly string[]).includes(String(status ?? ""));
}

export type AgentResellerRow = {
  reseller_id: string;
  business_name: string;
  code: string;
  phone: string | null;
  status: string;
  orders: number;
  delivered: number;
  failed: number;
  sales: number;
  profit: number;
  /** Net profit of commission-eligible orders only — the percent-mode base. */
  commissionProfit: number;
  /** Product units the customers kept — the per-product commission base. */
  units: number;
  lastOrderAt: string | null;
};


export type AgentPerformance = {
  agentId: string;
  resellers: AgentResellerRow[];
  resellerCount: number;
  activeResellers: number;
  /** Resellers with at least one order in the selected range. */
  sellingResellers: number;
  orders: number;
  delivered: number;
  failed: number;
  sales: number;
  profit: number;
  target: number;
  achievedPct: number;
  gap: number;
  /** Commission percentage configured for this agent. */
  rate: number;
  /** How this agent is paid. */
  mode: CommissionMode;
  /** Flat amount per delivered product unit (per-product mode). */
  perUnit: number;
  /** Net profit of settled (delivered / partial / failed) orders — the percent-mode base. */
  commissionBase: number;
  /** Delivered product units — the per-product-mode base. */
  units: number;
  /** Earned commission for the selected period, using the agent's mode. */
  commission: number;
};

export const AGENT_SALES_HINT =
  "Sales = money actually received for the orders of this agent's resellers in the selected period. Profit uses the same formula as every report: received amount − delivery charge − product cost − packaging cost.";

export const AGENT_COMMISSION_HINT =
  "Each agent is paid one of two ways. Percent of profit: rate % × settled net profit of the assigned resellers' orders (received amount − delivery charge − product cost − packaging cost), so returned / cancelled orders reduce the base. Per product: a flat amount × the number of product units customers actually kept in delivered or partial orders (returned units are not counted).";

export function commissionMode(plan: CommissionPlan): CommissionMode {
  return plan.commission_mode === "per_product" ? "per_product" : "percent";
}

/** rate % of the settled net profit. */
export function agentCommission(base: number, rate: number | string) {
  return (base * (Number(rate ?? 0) || 0)) / 100;
}

/** Commission for the agent's configured mode. */
export function agentCommissionFor(plan: CommissionPlan, base: number, units: number) {
  return commissionMode(plan) === "per_product"
    ? units * (Number(plan.commission_per_unit ?? 0) || 0)
    : agentCommission(base, plan.commission_rate ?? 0);
}

/** Product units the customer kept — 0 unless the order is commission-eligible. */
export function orderUnits(o: AgentOrder) {
  if (!isCommissionOrder(o.status)) return 0;
  return Math.max(Number(o.units ?? 0) || 0, 0);
}

/** Aggregate reseller-level and agent-level performance from raw orders. */
export function buildAgentPerformance(
  agent: { id: string; sale_target: number | string } & CommissionPlan,
  resellers: Array<{ id: string; business_name: string; code: string; contact_phone: string | null; status: string }>,
  orders: AgentOrder[],
): AgentPerformance {
  const byReseller = new Map<string, AgentResellerRow>();
  for (const r of resellers) {
    byReseller.set(r.id, {
      reseller_id: r.id,
      business_name: r.business_name,
      code: r.code,
      phone: r.contact_phone,
      status: r.status,
      orders: 0,
      delivered: 0,
      failed: 0,
      sales: 0,
      profit: 0,
      commissionProfit: 0,
      units: 0,
      lastOrderAt: null,
    });
  }

  for (const o of orders) {
    if (!o.reseller_id) continue;
    const row = byReseller.get(o.reseller_id);
    if (!row) continue;
    row.orders += 1;
    if (isCommissionOrder(o.status)) {
      row.delivered += 1;
      row.sales += orderReceived(o);
      row.profit += orderProfit(o);
      row.commissionProfit += orderProfit(o);
    } else if (["returned", "cancelled", "partial_delivery", "damaged"].includes(String(o.status))) {
      row.failed += 1;
      row.profit += orderProfit(o);
    }
    row.units += orderUnits(o);
    if (!row.lastOrderAt || o.created_at > row.lastOrderAt) row.lastOrderAt = o.created_at;
  }

  const rows = Array.from(byReseller.values()).sort((a, b) => b.sales - a.sales);
  const target = Number(agent.sale_target ?? 0) || 0;
  const sales = rows.reduce((s, r) => s + r.sales, 0);
  const rate = Number(agent.commission_rate ?? 0) || 0;
  const commissionBase = rows.reduce((s, r) => s + r.commissionProfit, 0);
  const units = rows.reduce((s, r) => s + r.units, 0);


  return {
    agentId: agent.id,
    resellers: rows,
    resellerCount: rows.length,
    activeResellers: rows.filter((r) => r.status === "active").length,
    sellingResellers: rows.filter((r) => r.orders > 0).length,
    orders: rows.reduce((s, r) => s + r.orders, 0),
    delivered: rows.reduce((s, r) => s + r.delivered, 0),
    failed: rows.reduce((s, r) => s + r.failed, 0),
    sales,
    profit: commissionBase,
    target,
    achievedPct: target > 0 ? Math.round((sales / target) * 100) : 0,
    gap: Math.max(target - sales, 0),
    rate,
    mode: commissionMode(agent),
    perUnit: Number(agent.commission_per_unit ?? 0) || 0,
    commissionBase,
    units,
    commission: agentCommissionFor(agent, commissionBase, units),
  };
}


/** Money summary for one agent: earned commission vs what admin already paid. */
export type AgentSettlement = {
  earned: number;
  pending: number; // requested, not approved yet
  approved: number; // approved, not paid yet
  paid: number; // money actually handed over (includes advances)
  advance: number; // paid amount beyond earned commission
  balance: number; // earned − paid (negative = advance given)
  payable: number; // balance minus approved-but-unpaid, floored at 0
};

const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

export function buildAgentSettlement(earned: number, payouts: AgentPayout[]): AgentSettlement {
  const sum = (s: string) => payouts.filter((p) => p.status === s).reduce((t, p) => t + num(p.amount), 0);
  const paid = sum("paid");
  const approved = sum("approved");
  const pending = sum("pending");
  const balance = earned - paid;
  return {
    earned,
    pending,
    approved,
    paid,
    advance: Math.max(paid - earned, 0),
    balance,
    payable: Math.max(balance - approved, 0),
  };
}

/** Commission earned per month, from settled orders of the assigned resellers. */
export function agentCommissionMonths(orders: AgentOrder[], plan: CommissionPlan) {
  const map = new Map<string, { key: string; base: number; units: number; commission: number; orders: number }>();
  for (const o of orders) {
    if (!["delivered", "partial", "returned", "cancelled"].includes(String(o.status))) continue;
    const d = new Date(o.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const row = map.get(key) ?? { key, base: 0, units: 0, commission: 0, orders: 0 };
    row.base += orderProfit(o);
    row.units += orderUnits(o);
    row.orders += 1;
    row.commission = agentCommissionFor(plan, row.base, row.units);
    map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
}

const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" });

/**
 * Same timeline format as the reseller money ledger:
 * commission earned = money in, admin payments = money out, rejected = void.
 */
export function buildAgentLedger(orders: AgentOrder[], plan: CommissionPlan, payouts: AgentPayout[]): LedgerRow[] {
  const rows: Omit<LedgerRow, "running">[] = [];
  const perUnit = Number(plan.commission_per_unit ?? 0) || 0;
  const rate = Number(plan.commission_rate ?? 0) || 0;

  for (const m of agentCommissionMonths(orders, plan)) {
    if (m.commission === 0) continue;
    rows.push({
      at: `${m.key}-28T23:59:00`,
      kind: "commission",
      direction: m.commission >= 0 ? "in" : "out",
      label: `Commission earned · ${monthLabel(m.key)}`,
      reference:
        commissionMode(plan) === "per_product"
          ? `${m.orders} settled order(s) · ${m.units} product unit(s) × ৳${perUnit.toLocaleString()}`
          : `${m.orders} settled order(s) · net profit ৳${Math.round(m.base).toLocaleString()} × ${rate}%`,
      status: "earned",
      amount: Math.abs(m.commission),
    });
  }


  for (const p of payouts) {
    const advance = p.kind === "advance";
    rows.push({
      at: p.paid_at ?? p.approved_at ?? p.created_at,
      kind: "payout",
      direction: p.status === "rejected" ? "void" : "out",
      label: advance ? "Advance payment" : p.status === "paid" ? "Commission paid" : `Payment ${p.status}`,
      reference: [p.method, p.reference, p.note, p.admin_note].filter(Boolean).join(" · ") || null,
      status: p.status,
      amount: num(p.amount),
    });
  }

  rows.sort((a, b) => (a.at < b.at ? -1 : 1));
  let running = 0;
  const ordered: LedgerRow[] = rows.map((r) => {
    if (r.direction === "in") running += r.amount;
    else if (r.direction === "out" && r.status === "paid") running -= r.amount;
    return { ...r, running };
  });
  return ordered.reverse();
}


export function bdt(v: number) {
  return `৳${Math.round(v).toLocaleString()}`;
}

/** WhatsApp-safe Bangladeshi number. */
export function waNumber(phone: string) {
  let d = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (d.startsWith("0")) d = "88" + d.slice(1);
  if (d.startsWith("1") && d.length === 10) d = "880" + d;
  return d;
}
