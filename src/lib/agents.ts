import { orderProfit, orderReceived, type ProfitOrder } from "@/lib/finance-report";
import type { LedgerRow } from "@/components/ledger-timeline";

export type Agent = {
  id: string;
  user_id: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  sale_target: number;
  commission_rate: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

export type AgentOrder = ProfitOrder & {
  id: string;
  reseller_id: string | null;
  created_at: string;
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
  /** Net profit of settled (delivered / partial / failed) orders — the commission base. */
  commissionBase: number;
  /** rate % of the commission base. */
  commission: number;
};

export const AGENT_SALES_HINT =
  "Sales = money actually received for the orders of this agent's resellers in the selected period. Profit uses the same formula as every report: received amount − delivery charge − product cost − packaging cost.";

export const AGENT_COMMISSION_HINT =
  "Commission = agent rate % × settled net profit of the assigned resellers' orders. Net profit uses the same formula everywhere: final delivered (received) amount − delivery charge − product cost − packaging cost. Returned / cancelled orders reduce the base, so commission is always paid on real delivered money.";

/** rate % of the settled net profit. */
export function agentCommission(base: number, rate: number | string) {
  return (base * (Number(rate ?? 0) || 0)) / 100;
}


/** Aggregate reseller-level and agent-level performance from raw orders. */
export function buildAgentPerformance(
  agent: { id: string; sale_target: number | string },
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
      lastOrderAt: null,
    });
  }

  for (const o of orders) {
    if (!o.reseller_id) continue;
    const row = byReseller.get(o.reseller_id);
    if (!row) continue;
    row.orders += 1;
    if (o.status === "delivered" || o.status === "partial") {
      row.delivered += 1;
      row.sales += orderReceived(o);
      row.profit += orderProfit(o);
    } else if (o.status === "returned" || o.status === "cancelled") {
      row.failed += 1;
      row.profit += orderProfit(o);
    }
    if (!row.lastOrderAt || o.created_at > row.lastOrderAt) row.lastOrderAt = o.created_at;
  }

  const rows = Array.from(byReseller.values()).sort((a, b) => b.sales - a.sales);
  const target = Number(agent.sale_target ?? 0) || 0;
  const sales = rows.reduce((s, r) => s + r.sales, 0);

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
    profit: rows.reduce((s, r) => s + r.profit, 0),
    target,
    achievedPct: target > 0 ? Math.round((sales / target) * 100) : 0,
    gap: Math.max(target - sales, 0),
  };
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
