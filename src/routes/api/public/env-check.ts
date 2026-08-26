import { createFileRoute } from "@tanstack/react-router";

/**
 * Temporary diagnostic: reports only WHICH backend bindings are present
 * (booleans / lengths), never any value. Used to verify the deployed worker
 * receives the managed backend configuration.
 */
export const Route = createFileRoute("/api/public/env-check")({
  server: {
    handlers: {
      GET: async () => {
        const { getRuntimeEnv } = await import("@/lib/env-bridge");
        const keys = [
          "SUPABASE_URL",
          "SUPABASE_PUBLISHABLE_KEY",
          "SUPABASE_ANON_KEY",
          "SUPABASE_SERVICE_ROLE_KEY",
          "SUPABASE_PROJECT_ID",
        ] as const;
        const out: Record<string, unknown> = {};
        for (const k of keys) {
          const v = getRuntimeEnv(k);
          out[k] = v ? { present: true, len: v.length, prefix: v.slice(0, 3) } : { present: false };
        }
        out.processEnvKeys = Object.keys((globalThis as any).process?.env ?? {}).filter((n) =>
          n.startsWith("SUPABASE") || n.startsWith("SB_"),
        );
        return new Response(JSON.stringify(out, null, 2), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
