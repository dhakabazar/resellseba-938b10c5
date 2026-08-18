// Server-only cleanup helpers: purge junk rows that don't need to live in the DB.
export type CleanupTarget = {
  key: string;
  label: string;
  hint: string;
};

export const CLEANUP_TARGETS: CleanupTarget[] = [
  { key: "audit_log", label: "Audit / action log", hint: "Every stored audit event — not used anywhere in the app." },
  { key: "store_visits", label: "Old store visits", hint: "Visit rows older than 30 days (report only keeps 30 days)." },
  { key: "courier_events", label: "Old courier webhook events", hint: "Courier callback payloads older than 60 days." },
  { key: "notification_logs", label: "Old notification logs", hint: "SMS / email / WhatsApp send logs older than 60 days." },
];

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
