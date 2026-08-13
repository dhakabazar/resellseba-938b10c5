// Cloudflare Workers pass configuration as per-request bindings (`env`), not as
// `process.env`. Server code (Supabase clients, auth middleware) reads
// `process.env.SUPABASE_*`, so bridge the values over on every request.
// Also falls back to the build-time VITE_* values for the non-secret pair,
// so a deploy that only has VITE_SUPABASE_* configured still works.

const KEYS = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PROJECT_ID",
] as const;

let bridged = false;

export function bridgeWorkerEnv(env: unknown): void {
  const target = (globalThis as any).process?.env;
  if (!target) return;

  const source = (env ?? {}) as Record<string, unknown>;

  for (const key of KEYS) {
    if (!target[key]) {
      const fromBinding = source[key] ?? source[`VITE_${key}`];
      if (typeof fromBinding === "string" && fromBinding) target[key] = fromBinding;
    }
  }

  if (!bridged) {
    bridged = true;
    // Build-time inlined public values (never secrets).
    target.SUPABASE_URL ||= import.meta.env.VITE_SUPABASE_URL ?? "";
    target.SUPABASE_PUBLISHABLE_KEY ||=
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
    target.SUPABASE_PROJECT_ID ||= import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "";
    for (const key of KEYS) if (!target[key]) delete target[key];
  }
}
