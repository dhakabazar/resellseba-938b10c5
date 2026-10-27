import { describe, expect, test } from "bun:test";
import { productStockVisible } from "../src/lib/product-stock-visibility";

describe("reseller product stock visibility", () => {
  test("admin toggle off hides stock from reseller product views", () => {
    expect(productStockVisible(false)).toBe(false);
  });
  test("admin toggle on shows stock to resellers", () => {
    expect(productStockVisible(true)).toBe(true);
  });
  test("admin stock stays visible regardless of reseller toggle", () => {
    expect(productStockVisible(false, true)).toBe(true);
  });
  test("stock is not briefly exposed while reseller settings load", () => {
    expect(productStockVisible(true, false, true)).toBe(false);
  });
});