import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getRuntimeEnv } from "@/lib/env-bridge";

function serviceFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    if (key.startsWith("sb_secret_") && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

/**
 * Payment callbacks run on reseller Cloudflare hostnames as well as the main
 * Lovable hostname. Read the per-request Worker binding captured by server.ts;
 * process.env alone is not reliable on custom-hostname requests.
 */
export function gatewayDatabase() {
  const url = getRuntimeEnv("SUPABASE_URL");
  const key = getRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Payment backend configuration is unavailable. Please retry shortly.");
  }

  return createClient<Database>(url, key, {
    global: { fetch: serviceFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}