/**
 * Exchange money split. Total cost = product cost (incl. packaging) + delivery.
 * Customer pays (COD) and admin share are chosen freely; the reseller carries
 * whatever remains (negative = reseller earns from the exchange).
 * Mirrors sync_order_profit: reseller_profit = received − delivery − product cost + admin share.
 */
export function exchangeSplit(x: { productCost: number; delivery: number; customerPays: number; adminShare: number }) {
  const r = (v: number) => Math.round(v * 100) / 100;
  const totalCost = r(x.productCost + x.delivery);
  const resellerShare = r(totalCost - x.customerPays - x.adminShare);
  return { productCost: r(x.productCost), totalCost, customerPays: r(x.customerPays), adminShare: r(x.adminShare), resellerShare };
}
