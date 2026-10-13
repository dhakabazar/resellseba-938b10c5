import { describe, expect, it } from "vitest";
import { exchangeSplit } from "@/lib/exchange";
import { isRealizedStatus, orderProfit } from "@/lib/finance-report";

describe("exchange", () => {
  it("reseller carries what customer and admin do not pay", () => {
    const s = exchangeSplit({ productCost: 1000, delivery: 120, customerPays: 60, adminShare: 60 });
    expect(s.resellerShare).toBe(1000);
  });
  it("shared delivery: customer 60, admin 60 of 120 with free product leaves reseller 0", () => {
    expect(exchangeSplit({ productCost: 0, delivery: 120, customerPays: 60, adminShare: 60 }).resellerShare).toBe(0);
  });
  it("exchanged counts as a delivered (realized) order", () => {
    expect(isRealizedStatus("exchanged")).toBe(true);
  });
  it("admin share is credited to reseller profit on exchange orders", () => {
    const o = { status: "exchanged", total: 300, shipping_cost: 0, sa_cost_total: 1000, delivery_cost: 120, received_amount: 300, packaging_total: 0, is_exchange: true, exchange_admin_share: 500 };
    expect(orderProfit(o)).toBe(300 - 1000 - 120 + 500);
  });
  it("returned exchange keeps admin share against the delivery loss", () => {
    const o = { status: "returned", total: 300, shipping_cost: 0, sa_cost_total: 1000, delivery_cost: 120, packaging_total: 20, is_exchange: true, exchange_admin_share: 140 };
    expect(orderProfit(o)).toBe(0);
  });
});
