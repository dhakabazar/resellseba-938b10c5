import { describe, expect, test } from "bun:test";
import { readBodyCategoryItems, selectBodyCategories } from "../src/lib/store-body-categories";

const categories = [{ id: "a" }, { id: "b" }, { id: "c" }];
describe("body category selection", () => {
  test("only selected active categories appear in saved order", () => {
    expect(selectBodyCategories(categories, [{ id: "c", is_active: true }, { id: "b", is_active: false }, { id: "a", is_active: true }])).toEqual([{ id: "c" }, { id: "a" }]);
  });
  test("an intentionally empty selection stays empty", () => {
    expect(selectBodyCategories(categories, readBodyCategoryItems("[]"))).toEqual([]);
  });
  test("unconfigured stores retain their existing categories", () => {
    expect(selectBodyCategories(categories, readBodyCategoryItems(undefined))).toEqual(categories);
  });
  test("removed or globally inactive categories are not resurrected", () => {
    expect(selectBodyCategories(categories, [{ id: "removed", is_active: true }])).toEqual([]);
  });
  test("body selection never modifies header and catalog categories", () => {
    selectBodyCategories(categories, [{ id: "a", is_active: true }]);
    expect(categories).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
  });
});