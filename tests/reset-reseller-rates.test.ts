import { expect, test } from "bun:test";
import { resetResellerRates } from "../src/lib/reset-reseller-rates";

test("Reset removes every override only for the selected reseller, allowing current defaults", async () => {
  let rows = [
    { reseller_id: "selected", product_id: "a", reseller_price: 50, packaging_cost: 5, delivery_mode: "free" },
    { reseller_id: "selected", product_id: "b", reseller_price: 60, packaging_cost: 10, delivery_mode: "flat" },
    { reseller_id: "other", product_id: "a", reseller_price: 70, packaging_cost: 15, delivery_mode: "area" },
  ];
  const client = { from: (table: string) => { expect(table).toBe("reseller_product_prices"); return {
    delete: () => ({ eq: async (column: string, id: string) => {
      expect(column).toBe("reseller_id");
      rows = rows.filter((row) => row.reseller_id !== id);
      return { error: null };
    } }),
  }; } };
  await resetResellerRates(client, "selected");
  expect(rows).toEqual([{ reseller_id: "other", product_id: "a", reseller_price: 70, packaging_cost: 15, delivery_mode: "area" }]);
});

test("Reset without a selected reseller never deletes rates", async () => {
  let touched = false;
  const client = { from: () => { touched = true; throw new Error("Must not delete"); } };
  await expect(resetResellerRates(client, "")).rejects.toThrow("Select a reseller first");
  expect(touched).toBe(false);
});

test("Reset reports deletion failure rather than claiming defaults were restored", async () => {
  const client = { from: () => ({ delete: () => ({ eq: async () => ({ error: { message: "Denied" } }) }) }) };
  await expect(resetResellerRates(client, "selected")).rejects.toThrow("Denied");
});