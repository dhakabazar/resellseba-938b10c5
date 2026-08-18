// Server-only cleanup helpers: purge junk rows that don't need to live in the DB.
export { CLEANUP_TARGETS, type CleanupTarget } from "./maintenance-targets";

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

/** Cutoff per target — null means "delete everything". */
export function cutoffFor(key: string): string | null {
  if (key === "store_visits") return daysAgo(30);
  if (key === "courier_events" || key === "notification_logs") return daysAgo(60);
  return null;
}

export async function countTarget(db: any, key: string) {
  const cutoff = cutoffFor(key);
  let q = db.from(key).select("*", { count: "exact", head: true });
  if (cutoff) q = q.lt("created_at", cutoff);
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

export async function purgeTarget(db: any, key: string) {
  const cutoff = cutoffFor(key);
  const before = await countTarget(db, key);
  let q = db.from(key).delete();
  q = cutoff ? q.lt("created_at", cutoff) : q.not("id", "is", null);
  const { error } = await q;
  if (error) throw new Response(error.message, { status: 400 });
  return before;
}
