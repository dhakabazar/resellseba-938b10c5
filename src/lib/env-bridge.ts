// Cloudflare Workers pass configuration as per-request bindings (`env`), not as
// `process.env`. Server code (Supabase clients, auth middleware) reads
// `process.env.SUPABASE_*`, so bridge the values over on every request.
//
// Nothing is hardcoded here: values are resolved at runtime from whatever the
// host provides (worker bindings, real process.env, or build-time VITE_* vars)
// and derived from each other where possible, so changing the backend/server
// requires no code change.

const KEYS = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PROJECT_ID",
] as const;

type Key = (typeof KEYS)[number];

// Accepted aliases per key, checked in order.
const ALIASES: Record<Key, string[]> = {
  SUPABASE_URL: ["SUPABASE_URL", "VITE_SUPABASE_URL", "PUBLIC_SUPABASE_URL"],
  SUPABASE_PUBLISHABLE_KEY: [
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
  ],
  SUPABASE_ANON_KEY: [
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
  ],
  SUPABASE_SERVICE_ROLE_KEY: [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SERVICE_ROLE_KEY",
  ],
  SUPABASE_PROJECT_ID: [
    "SUPABASE_PROJECT_ID",
    "VITE_SUPABASE_PROJECT_ID",
    "SUPABASE_PROJECT_REF",
  ],
};

function pick(
  sources: Array<Record<string, unknown> | undefined>,
  names: string[],
): string | undefined {
  for (const name of names) {
    for (const source of sources) {
      const value = source?.[name];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return undefined;
}

export function bridgeWorkerEnv(env: unknown): void {
  const target = (globalThis as any).process?.env as
    | Record<string, string>
    | undefined;
  if (!target) return;

  const binding = (env ?? {}) as Record<string, unknown>;
  // Build-time inlined public values (never secrets) act as the last fallback.
  const buildTime = import.meta.env as unknown as Record<string, unknown>;
  const sources = [binding, target as Record<string, unknown>, buildTime];

  for (const key of KEYS) {
    const value = pick(sources, ALIASES[key]);
    if (value) target[key] = value;
  }

  // Derive whichever half of the URL/project-ref pair is missing.
  if (!target.SUPABASE_URL && target.SUPABASE_PROJECT_ID) {
    target.SUPABASE_URL = `https://${target.SUPABASE_PROJECT_ID}.supabase.co`;
  }
  if (!target.SUPABASE_PROJECT_ID && target.SUPABASE_URL) {
    try {
      const host = new URL(target.SUPABASE_URL).hostname;
      const ref = host.split(".")[0];
      if (ref) target.SUPABASE_PROJECT_ID = ref;
    } catch {
      // ignore malformed URL
    }
  }

  for (const key of KEYS) if (!target[key]) delete target[key];
}
