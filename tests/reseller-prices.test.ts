import { describe, expect, mock, test } from "bun:test";

const requests: string[] = [];
mock.module("@/integrations/supabase/client", () => ({ supabase: { from: () => {
  requests.push("query");
  const query = { select: () => query, eq: (_key: string, id: string) => { requests.push(id); return query; }, range: async () => ({ data: [], error: null }) };
  return query;
} } }));
const { wholesalePrice, withResellerRates, fetchResellerPriceMap } = await import("../src/lib/reseller-prices");
const master = { id: "product", reseller_price: 370, packaging_cost: 15, delivery_mode: "area", delivery_flat: 0, delivery_inside: 60, delivery_sub: 90, delivery_outside: 130 };
const rate = { reseller_price: 350, packaging_cost: 25, delivery_mode: "flat", delivery_flat: 80, delivery_inside: null, delivery_sub: null, delivery_outside: null };

describe("reseller-specific rates", () => {
  test("custom product price is applied instead of master price", () => {
    expect(wholesalePrice(master, new Map([[master.id, rate]]))).toBe(350);
  });
  test("custom packaging applies without mutating master product or old snapshots", () => {
    expect(withResellerRates(master, new Map([[master.id, rate]])).packaging_cost).toBe(25);
    expect(master.packaging_cost).toBe(15);
  });
  test("custom flat delivery replaces master area delivery", () => {
    const result = withResellerRates(master, new Map([[master.id, rate]]));
    expect(result.delivery_mode).toBe("flat");
    expect(result.delivery_flat).toBe(80);
    expect(result.delivery_inside).toBe(0);
  });
  test("price-only customization retains master packaging and delivery", () => {
    const result = withResellerRates(master, new Map([[master.id, { ...rate, packaging_cost: null, delivery_mode: null }]]));
    expect(result.reseller_price).toBe(350);
    expect(result.packaging_cost).toBe(15);
    expect(result.delivery_outside).toBe(130);
  });
  test("zero custom packaging and free delivery are not mistaken for missing rates", () => {
    const result = withResellerRates(master, new Map([[master.id, { ...rate, packaging_cost: 0, delivery_mode: "free", delivery_flat: null }]]));
    expect(result.packaging_cost).toBe(0);
    expect(result.delivery_mode).toBe("free");
    expect(result.delivery_flat).toBe(0);
  });
  test("missing sub-area override falls back to reseller outside rate", () => {
    const result = withResellerRates(master, new Map([[master.id, { ...rate, delivery_mode: "area", delivery_inside: 40, delivery_outside: 100 }]]));
    expect(result.delivery_sub).toBe(100);
  });
  test("removing custom rates restores all master values", () => {
    expect(withResellerRates(master, new Map())).toEqual(master);
    expect(wholesalePrice(master, new Map())).toBe(370);
  });
  test("admin direct order without reseller never queries other reseller rates", async () => {
    requests.length = 0;
    expect((await fetchResellerPriceMap(null)).size).toBe(0);
    expect(requests).toEqual([]);
  });
  test("specified reseller rates query is scoped to that reseller", async () => {
    requests.length = 0;
    await fetchResellerPriceMap("selected-reseller");
    expect(requests).toEqual(["query", "selected-reseller"]);
  });
});