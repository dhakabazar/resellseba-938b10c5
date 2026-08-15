// Server-only helpers for payment gateway server functions.
// Kept out of *.functions.ts so the server-fn split transform can't drop them.
import { getRequest } from "@tanstack/react-start/server";

export async function loadOrder(orderNumber: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select(
      "id, order_number, total, customer_name, customer_phone, customer_email, address_line, city, area, reseller_id, payment_method, payment_status",
    )
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!order) throw new Response("Order not found", { status: 404 });
  if (order.payment_status === "paid") throw new Response("Already paid", { status: 400 });
  return { order, supabaseAdmin };
}

export async function loadConfig(supabaseAdmin: any, method: string, resellerId: string | null) {
  // reseller override first, then global
  const { data } = await supabaseAdmin
    .from("payment_configs")
    .select("config, mode, is_active, reseller_id")
    .eq("method", method)
    .or(resellerId ? `reseller_id.eq.${resellerId},reseller_id.is.null` : `reseller_id.is.null`);
  const rows = (data ?? []).filter((r: any) => r.is_active);
  const cfg =
    rows.find((r: any) => r.reseller_id === resellerId) ??
    rows.find((r: any) => r.reseller_id === null);
  if (!cfg) throw new Response(`${method} not configured`, { status: 400 });
  return cfg;
}

/**
 * Public origin of the current deployment, derived from the incoming request so
 * no SITE_URL env var is needed (works on any host: Lovable, Cloudflare Worker,
 * custom domain). Falls back to SITE_URL only if headers are unavailable.
 */
export function siteOrigin(): string {
  try {
    const request = getRequest();
    const headers = request?.headers;
    if (headers) {
      const host = headers.get("x-forwarded-host") ?? headers.get("host");
      const proto = headers.get("x-forwarded-proto") ?? "https";
      if (host) return `${proto}://${host}`;
    }
    if (request?.url) return new URL(request.url).origin;
  } catch {
    // no request context (e.g. background invocation)
  }
  return process.env.SITE_URL || "";
}

export async function bkashToken(
  base: string,
  appKey: string,
  appSecret: string,
  username: string,
  password: string,
) {
  const res = await fetch(`${base}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json", username, password },
    body: JSON.stringify({ app_key: appKey, app_secret: appSecret }),
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!body.id_token) throw new Response(body.statusMessage || "bKash auth failed", { status: 502 });
  return body.id_token as string;
}
