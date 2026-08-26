// Server-only helpers that let payment flows work on BOTH hostnames:
//
// - the platform's own hosted origin, where the managed backend injects the
//   privileged (service-role) binding, and
// - reseller / brand custom domains served through Cloudflare, where only the
//   public backend bindings are injected.
//
// On a custom domain the privileged binding is simply absent, so any payment
// step that needs it is forwarded once, server-to-server, to the platform's
// hosted origin. That origin is configuration (global_settings.callback_base_url),
// never hardcoded.
import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import { getRuntimeEnv } from "@/lib/env-bridge";

/** True when this request runs somewhere the privileged backend key exists. */
export function hasPrivilegedDb(): boolean {
  return Boolean(getRuntimeEnv("SUPABASE_URL") && getRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

function publicDb() {
  const url = getRuntimeEnv("SUPABASE_URL");
  const key = getRuntimeEnv("SUPABASE_PUBLISHABLE_KEY") ?? getRuntimeEnv("SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * The origin that owns the privileged backend binding — gateways are pointed at
 * it for return/IPN callbacks, and custom-domain requests forward to it.
 * Falls back to the current origin when unset.
 */
export async function platformOrigin(fallback: string): Promise<string> {
  const db = publicDb();
  if (!db) return fallback;
  try {
    const { data } = await db
      .from("global_settings")
      .select("callback_base_url")
      .eq("id", 1)
      .maybeSingle();
    const base = String((data as { callback_base_url?: string } | null)?.callback_base_url ?? "")
      .trim()
      .replace(/\/+$/, "");
    return base || fallback;
  } catch {
    return fallback;
  }
}

/** Forward one payment operation to the platform origin and return its JSON. */
export async function forwardToPlatform<T>(
  op: string,
  payload: Record<string, unknown>,
  authorization?: string | null,
): Promise<T> {
  const { siteOrigin } = await import("./core.server");
  const here = siteOrigin();
  const base = await platformOrigin("");
  if (!base || base === here) {
    throw new Response(
      "Online payments are not configured for this domain yet. Please set the payment callback address in settings.",
      { status: 503 },
    );
  }

  const res = await fetch(`${base}/api/public/payment/bridge`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify({ op, ...payload, origin: here }),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? text;
    } catch {
      /* plain text */
    }
    throw new Response(message || "Payment could not be started", { status: res.status });
  }
  return JSON.parse(text) as T;
}

/** The caller's bearer token, so a forwarded request keeps the same identity. */
export function incomingAuthorization(): string | null {
  try {
    return getRequest()?.headers.get("authorization") ?? null;
  } catch {
    return null;
  }
}
