/**
 * Exchange calculation — one place for the money of an exchange order.
 *
 *  R (reseller product cost) = Σ sent reseller rate − Σ returned reseller rate
 *  B (admin buying cost)     = Σ sent buying price − Σ returned buying price (only if restocked)
 *  C (customer pays)         = price difference + delivery/packaging the customer carries
 *  S (admin bears)           = delivery/packaging the admin carries
 *
 *  Reseller result = C − delivery − packaging − R + S   (mirrors sync_order_profit)
 *  Admin result    = R − B − S                         (delivery & packaging are paid out of C/R)
 *
 * Same product back + restocked → R = 0 and B = 0, so only delivery/packaging remain.
 */
export type Payer = "customer" | "reseller" | "admin";
export type PackPayer = Payer | "none";

export type CalcLine = { qty: number; resellerCost: number; adminBuy: number; sell: number };

export type ExchangeCalcInput = {
  send: CalcLine[];
  back: CalcLine[];
  restock: boolean;
  delivery: number;
  deliveryBy: Payer;
  packaging: number;
  packagingBy: PackPayer;
  /** Product price difference the customer pays (null = auto). */
  customerDiff?: number | null;
  /** Manual overrides (null = auto from payers). */
  customerPaysOverride?: number | null;
  adminShareOverride?: number | null;
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const sum = (ls: CalcLine[], f: (l: CalcLine) => number) => ls.reduce((s, l) => s + f(l) * (Number(l.qty) || 0), 0);

export function exchangeCalc(x: ExchangeCalcInput) {
  const sendR = sum(x.send, (l) => l.resellerCost);
  const backR = sum(x.back, (l) => l.resellerCost);
  const sendB = sum(x.send, (l) => l.adminBuy);
  const backB = x.restock ? sum(x.back, (l) => l.adminBuy) : 0;
  const sellDiffAuto = Math.max(0, sum(x.send, (l) => l.sell) - sum(x.back, (l) => l.sell));
  const customerDiff = x.customerDiff ?? sellDiffAuto;
  const delivery = Math.max(0, x.delivery || 0);
  const packaging = x.packagingBy === "none" ? 0 : Math.max(0, x.packaging || 0);

  const autoC =
    customerDiff + (x.deliveryBy === "customer" ? delivery : 0) + (x.packagingBy === "customer" ? packaging : 0);
  const autoS = (x.deliveryBy === "admin" ? delivery : 0) + (x.packagingBy === "admin" ? packaging : 0);
  const customerPays = Math.max(0, x.customerPaysOverride ?? autoC);
  const adminShare = Math.max(0, x.adminShareOverride ?? autoS);

  const resellerCost = sendR - backR;
  const adminBuy = sendB - backB;
  const reseller = customerPays - delivery - packaging - resellerCost + adminShare;
  const admin = resellerCost - adminBuy - adminShare;
  return {
    sendR: r2(sendR), backR: r2(backR), sendB: r2(sendB), backB: r2(backB),
    sellDiffAuto: r2(sellDiffAuto), customerDiff: r2(customerDiff),
    delivery: r2(delivery), packaging: r2(packaging),
    customerPays: r2(customerPays), adminShare: r2(adminShare),
    resellerCost: r2(resellerCost), adminBuy: r2(adminBuy),
    reseller: r2(reseller), admin: r2(admin),
  };
}

/** Admin buying cost of an exchange order (null = not an exchange with a saved calc). */
export function exchangeAdminBuy(o: { is_exchange?: boolean | null; exchange_admin_buy?: number | string | null; status?: string | null }) {
  if (!o?.is_exchange || o.exchange_admin_buy == null || o.exchange_admin_buy === "") return null;
  // Failed / cancelled exchange: the new parcel comes back, no product leaves admin.
  if (["cancelled", "returned", "pending_return", "partial_delivery"].includes(String(o.status))) return 0;
  return Number(o.exchange_admin_buy) || 0;
}
