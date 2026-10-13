/** Pre-delivery cash is one amount: paid_amount mirrors advance_amount, never add them. */
export type PaymentOrder = {
  total: number | string;
  advance_amount?: number | string | null;
  paid_amount?: number | string | null;
  received_amount?: number | string | null;
  status?: string | null;
  payment_status?: string | null;
};
const money = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.max(n, 0) : 0;
};
export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function prepaidAmount(order: PaymentOrder) {
  return roundMoney(Math.max(money(order.advance_amount), money(order.paid_amount)));
}
/** Method names do not prove payment. Even wallet orders can have outstanding COD. */
export function orderCodDue(order: PaymentOrder) {
  return roundMoney(Math.max(money(order.total) - prepaidAmount(order), 0));
}
export function confirmedCustomerPayment(order: PaymentOrder) {
  const collected = order.status === "cancelled" || order.status === "returned" || order.status === "pending_return"
    ? 0 : money(order.received_amount);
  return roundMoney(prepaidAmount(order) + collected);
}
export function paymentStatusFor(order: PaymentOrder): "paid" | "partial" | "unpaid" | "refunded" {
  if (order.payment_status === "refunded") return "refunded";
  const amount = confirmedCustomerPayment(order);
  if (amount <= 0) return "unpaid";
  return amount >= roundMoney(money(order.total)) ? "paid" : "partial";
}

/** Safe default when an admin marks a full delivery; keeps actual collection if already known. */
export function fullDeliveryCollection(order: PaymentOrder) {
  return order.received_amount == null ? orderCodDue(order) : roundMoney(money(order.received_amount));
}