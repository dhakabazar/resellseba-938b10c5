import { describe, expect, it } from "vitest";
import { exchangeAdminBuy, exchangeCalc } from "@/lib/exchange";

const A = { qty: 1, resellerCost: 90, adminBuy: 60, sell: 300 };

describe("exchangeCalc", () => {
  it("same product back and restocked: no product profit or loss for anyone", () => {
    const c = exchangeCalc({ send: [A], back: [A], restock: true, delivery: 140, deliveryBy: "customer", packaging: 25, packagingBy: "reseller" });
    expect(c.resellerCost).toBe(0);
    expect(c.adminBuy).toBe(0);
    expect(c.admin).toBe(0);
    expect(c.customerPays).toBe(140);
    expect(c.reseller).toBe(-25); // reseller carries packaging only
  });

  it("no new packaging: reseller has no loss", () => {
    const c = exchangeCalc({ send: [A], back: [A], restock: true, delivery: 140, deliveryBy: "customer", packaging: 25, packagingBy: "none" });
    expect(c.reseller).toBe(0);
    expect(c.packaging).toBe(0);
  });

  it("admin carries packaging and delivery", () => {
    const c = exchangeCalc({ send: [A], back: [A], restock: true, delivery: 140, deliveryBy: "admin", packaging: 25, packagingBy: "admin" });
    expect(c.adminShare).toBe(165);
    expect(c.admin).toBe(-165);
    expect(c.reseller).toBe(0);
  });

  it("damaged return (not restocked): admin loses the buying price", () => {
    const c = exchangeCalc({ send: [A], back: [A], restock: false, delivery: 140, deliveryBy: "customer", packaging: 0, packagingBy: "none" });
    expect(c.admin).toBe(-60);
  });

  it("different, costlier product: customer pays the difference, both earn margin", () => {
    const B = { qty: 1, resellerCost: 150, adminBuy: 100, sell: 450 };
    const c = exchangeCalc({ send: [B], back: [A], restock: true, delivery: 140, deliveryBy: "customer", packaging: 0, packagingBy: "none" });
    expect(c.customerPays).toBe(290); // 150 diff + 140 delivery
    expect(c.resellerCost).toBe(60);
    expect(c.reseller).toBe(90);
    expect(c.admin).toBe(20);
  });

  it("cheaper product: reseller gets a credit", () => {
    const B = { qty: 1, resellerCost: 50, adminBuy: 30, sell: 200 };
    const c = exchangeCalc({ send: [B], back: [A], restock: true, delivery: 140, deliveryBy: "customer", packaging: 0, packagingBy: "none" });
    expect(c.resellerCost).toBe(-40);
    expect(c.reseller).toBe(40);
    expect(c.admin).toBe(-10);
  });

  it("failed exchange has no admin buying cost", () => {
    expect(exchangeAdminBuy({ is_exchange: true, exchange_admin_buy: 40, status: "returned" })).toBe(0);
    expect(exchangeAdminBuy({ is_exchange: true, exchange_admin_buy: 40, status: "exchanged" })).toBe(40);
    expect(exchangeAdminBuy({ is_exchange: false, exchange_admin_buy: 40, status: "delivered" })).toBeNull();
  });
});
