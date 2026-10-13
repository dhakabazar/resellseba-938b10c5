import { describe, expect, test } from "bun:test";
import { adminOrderKey, statusCount } from "../src/lib/admin-order-cache";

describe("admin order cache", () => {
  test("switching back to a status reuses the same cache identity", () => {
    expect(adminOrderKey("admin", "delivered", null, null)).toEqual(adminOrderKey("admin", "delivered", null, null));
    expect(adminOrderKey("admin", "delivered", null, null)).not.toEqual(adminOrderKey("admin", "forwarded", null, null));
  });
  test("private rows are isolated by account and date range", () => {
    const key = adminOrderKey("admin", "all", 100, 200);
    expect(key).not.toEqual(adminOrderKey("staff", "all", 100, 200));
    expect(key).not.toEqual(adminOrderKey("admin", "all", 100, 300));
  });
  test("combined status tabs and all-order totals use exact counts without allocating rows", () => {
    const counts = { draft: 20, pending: 50, delivered: 100 };
    expect(statusCount(counts, ["draft", "pending"])).toBe(70);
    expect(statusCount(counts, [])).toBe(170);
    expect(statusCount(counts, ["cancelled"])).toBe(0);
  });
});