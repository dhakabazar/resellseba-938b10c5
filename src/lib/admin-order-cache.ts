/** Cache identity includes the signed-in user; never share private rows across accounts. */
export const ADMIN_ORDERS_STALE_MS = 3 * 60 * 1000;

export function adminOrderKey(userId: string, tab: string, from: number | null, to: number | null) {
  return ["admin-order-pages", userId, tab, from, to] as const;
}

export function statusCount(counts: Record<string, number>, statuses: readonly string[]) {
  return statuses.length === 0
    ? Object.values(counts).reduce((sum, count) => sum + Number(count), 0)
    : statuses.reduce((sum, status) => sum + Number(counts[status] ?? 0), 0);
}