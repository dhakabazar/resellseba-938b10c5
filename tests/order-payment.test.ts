import { expect, test } from "bun:test";
import { orderCodDue, paymentStatusFor, prepaidAmount, fullDeliveryCollection } from "../src/lib/order-payment";
import { orderReceived, orderProfit, orderMargin, orderDeliveryCost, orderPackaging } from "../src/lib/finance-report";
const base = { total: 1500, shipping_cost: 100, delivery_cost: 100, sa_cost_total: 900, packaging_total: 20 };

test("COD subtracts confirmed advance for every payment method and counts its mirrored paid amount only once", () => {
  expect(orderCodDue({ total: 1500, advance_amount: 500, paid_amount: 500 })).toBe(1000);
  expect(prepaidAmount({ total: 1500, advance_amount: 500, paid_amount: 500 })).toBe(500);
  expect(orderCodDue({ total: 1500, advance_amount: 1500 })).toBe(0);
  expect(orderCodDue({ total: 1500 })).toBe(1500);
});
test("payment status follows confirmed collection, never merely the delivered label", () => {
  expect(paymentStatusFor({ total: 1500, advance_amount: 500 })).toBe("partial");
  expect(paymentStatusFor({ total: 1500, advance_amount: 1500 })).toBe("paid");
  expect(paymentStatusFor({ total: 1500, status: "delivered" })).toBe("unpaid");
  expect(paymentStatusFor({ total: 1500, advance_amount: 500, received_amount: 1000, status: "delivered" })).toBe("paid");
  expect(paymentStatusFor({ total: 1500, advance_amount: 500, received_amount: 600, status: "partial_full" })).toBe("partial");
});
test("manual full delivery defaults exclude advance and preserve actual courier collection", () => {
  expect(fullDeliveryCollection({ total: 1500, advance_amount: 500 })).toBe(1000);
  expect(fullDeliveryCollection({ total: 1500, advance_amount: 500, received_amount: 600 })).toBe(600);
});
test("admin-owned vs reseller-owned prepaid money changes payout, not margin", () => {
  const o = { ...base, status: "delivered", received_amount: 1000, advance_amount: 500 };
  expect(orderReceived(o)).toBe(1500);
  expect(orderProfit({ ...o, advance_by: "admin" })).toBe(500);
  expect(orderProfit({ ...o, advance_by: "reseller" })).toBe(0);
  expect(orderMargin({ ...o, advance_by: "reseller" })).toBe(500);
});
test("cancelled advance stays with its original owner and is never erased or automatically refunded", () => {
  const o = { ...base, status: "cancelled", advance_amount: 500, received_amount: 1000 };
  expect(orderReceived(o)).toBe(500);
  expect(orderProfit({ ...o, advance_by: "admin" })).toBe(0);
  expect(orderProfit({ ...o, advance_by: "reseller" })).toBe(0);
  expect(paymentStatusFor(o)).toBe("partial");
  expect(orderDeliveryCost(o)).toBe(0);
  expect(orderPackaging(o)).toBe(0);
});
test("returned orders retain advance, with delivery and packaging loss charged once", () => {
  const o = { ...base, status: "returned", advance_amount: 500, received_amount: 0 };
  expect(orderReceived(o)).toBe(500);
  expect(orderProfit({ ...o, advance_by: "admin" })).toBe(380);
  expect(orderProfit({ ...o, advance_by: "reseller" })).toBe(-120);
});
test("partial delivery adds courier money to advance once and uses only kept costs", () => {
  expect(orderProfit({ ...base, status: "partial_full", received_amount: 600, advance_amount: 500, advance_by: "admin" })).toBe(100);
  expect(orderProfit({ ...base, status: "partial_item", kept_product_cost: 440, received_amount: 600, advance_amount: 500, advance_by: "admin" })).toBe(540);
  expect(orderProfit({ ...base, status: "partial_delivery", received_amount: 50, advance_amount: 50, advance_by: "admin" })).toBe(-20);
});