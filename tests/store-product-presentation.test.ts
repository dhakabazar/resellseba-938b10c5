import { describe, expect, test } from "bun:test";
import { productDiscount, validPreviousPrice, soldRange, randomSoldCount } from "../src/lib/store-product-presentation";

describe("storefront product presentation", () => {
  test("1000 regular and 800 selling displays 200 savings and 20 percent without changing payable price", () => {
    const sell = 800;
    expect(productDiscount(sell, 1000)).toEqual({ regular: 1000, saving: 200, percent: 20 });
    expect(sell * 2).toBe(1600);
  });
  test("bulk and existing listings without a previous price have no discount", () => {
    expect(productDiscount(800, null)).toBeNull();
  });
  test("previous price must exceed selling price or be left empty", () => {
    expect(validPreviousPrice("1000", 800)).toBe(true);
    expect(validPreviousPrice("800", 800)).toBe(false);
    expect(validPreviousPrice("700", 800)).toBe(false);
    expect(validPreviousPrice("", 800)).toBe(true);
  });
  test("random sold count includes both ends of configured range", () => {
    expect(randomSoldCount(100, 200, 0)).toBe(100);
    expect(randomSoldCount(100, 200, 1)).toBe(200);
    expect(randomSoldCount(100, 200, 0.5)).toBe(150);
  });
  test("range normalizes reversed and negative bounds", () => {
    expect(soldRange("200", "100")).toEqual([100, 200]);
    expect(soldRange("-2", "5")).toEqual([0, 5]);
  });
});