// Server-only shared plumbing for the automatic payment gateways.
// Never imported by client code (filename is server-guarded).
import { getRequest } from "@tanstack/react-start/server";
import { gatewayByProvider } from "./registry";

export type GatewayCreds = {
  provider: string;
  api_key: string;
  api_secret: string;
  merchant_id: string;
  config: Record<string, any>;
  is_sandbox: boolean;
  base: string;
};

export type GatewayOrder = {
  id: string;
  order_number: string;
  total: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  address_line: string;
  city: string | null;
  reseller_id: string | null;
  payment_status: string;
  paid_amount: number | null;
  transaction_id: string | null;
};

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Credential loader — reseller row wins over the platform row. */
export async function getCredentials(
  provider: string,
  resellerId: string | null,
): Promise<GatewayCreds | null> {
  const db = await admin();
  const q = db
    .from("payment_gateway_configs")
    .select("provider,api_key,api_secret,merchant_id,config,is_active,reseller_id")
    .eq("provider", provider);
  const { data } = resellerId
    ? await q.or(`reseller_id.eq.${resellerId},reseller_id.is.null`)
    : await q.is("reseller_id", null);
  const rows = (data ?? []).filter((r: any) => r.is_active);
  const row =
    rows.find((r: any) => r.reseller_id === resellerId) ?? rows.find((r: any) => r.reseller_id === null);
  if (!row) return null;
  const config = (row.config ?? {}) as Record<string, any>;
  const is_sandbox = config.is_sandbox !== false;
  const spec = gatewayByProvider(provider);
  return {
    provider,
    api_key: row.api_key ?? "",
    api_secret: row.api_secret ?? "",
    merchant_id: row.merchant_id ?? "",
    config,
    is_sandbox,
    base: is_sandbox ? (spec?.hosts.sandbox ?? "") : (spec?.hosts.live ?? ""),
  };
}

/** Same shape from a raw admin form, for the "Test connection" action. */
export function credsFromRaw(provider: string, raw: Record<string, any>): GatewayCreds {
  const config = (raw.config ?? {}) as Record<string, any>;
  const is_sandbox = config.is_sandbox !== false;
  const spec = gatewayByProvider(provider);
  return {
    provider,
    api_key: String(raw.api_key ?? ""),
    api_secret: String(raw.api_secret ?? ""),
    merchant_id: String(raw.merchant_id ?? ""),
    config,
    is_sandbox,
    base: is_sandbox ? (spec?.hosts.sandbox ?? "") : (spec?.hosts.live ?? ""),
  };
}

export async function loadOrder(orderNumber: string): Promise<GatewayOrder> {
  const db = await admin();
  const { data } = await db
    .from("orders")
    .select(
      "id,order_number,total,customer_name,customer_phone,customer_email,address_line,city,reseller_id,payment_status,paid_amount,transaction_id",
    )
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!data) throw new Error("Order not found");
  return data as unknown as GatewayOrder;
}

/** Public origin of this deployment, derived from the request (nothing hardcoded). */
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
    /* no request context */
  }
  return process.env.SITE_URL || "";
}

/** Every outbound create call is capped so a slow gateway can't hang checkout. */
export async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms = 10_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("Gateway timeout");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function jsonPost(url: string, body: unknown, headers: Record<string, string> = {}, signal?: AbortSignal) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
  });
  return parseBody(res);
}

export async function formPost(url: string, body: URLSearchParams, signal?: AbortSignal) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: body.toString(),
    signal,
  });
  return parseBody(res);
}

export async function getJson(url: string, headers: Record<string, string> = {}, signal?: AbortSignal) {
  const res = await fetch(url, { headers: { accept: "application/json", ...headers }, signal });
  return parseBody(res);
}

async function parseBody(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { __raw: text, __status: res.status };
  }
}

/** Success/cancel URLs on the storefront (SPA), used as the final redirect. */
export function spaUrls(origin: string, code: string, orderNumber: string) {
  return {
    success: `${origin}/s/${encodeURIComponent(code)}/thanks?n=${encodeURIComponent(orderNumber)}`,
    cancel: `${origin}/s/${encodeURIComponent(code)}/thanks?n=${encodeURIComponent(orderNumber)}`,
  };
}

/** Return-URL base every gateway is pointed at (never the SPA directly). */
export function returnUrl(
  origin: string,
  provider: string,
  params: Record<string, string>,
): string {
  const qs = new URLSearchParams(params).toString();
  return `${origin}/api/public/payment/${provider}/return?${qs}`;
}

/**
 * Marks an order paid. Idempotent, and refuses to trust the gateway redirect:
 * the caller must pass a server-verified amount.
 */
export async function settlePayment(opts: {
  order: GatewayOrder;
  provider: string;
  paid: boolean;
  amount: number;
  txnId: string;
}): Promise<"paid" | "mismatch" | "unpaid" | "already"> {
  const db = await admin();
  if (opts.order.payment_status === "paid") return "already";
  if (!opts.paid) {
    await db.from("orders").update({ payment_provider: opts.provider, transaction_id: opts.txnId || null }).eq("id", opts.order.id);
    return "unpaid";
  }
  const expected = Number(opts.order.total);
  const mismatch = Math.abs(opts.amount - expected) >= 1;
  if (mismatch) {
    await db
      .from("orders")
      .update({
        payment_status: "unpaid",
        payment_provider: opts.provider,
        transaction_id: opts.txnId || null,
        paid_amount: opts.amount,
        admin_note: `AMOUNT MISMATCH: gateway ${opts.provider} reported ${opts.amount}, order total ${expected} (txn ${opts.txnId || "-"})`,
      })
      .eq("id", opts.order.id);
    return "mismatch";
  }
  await db
    .from("orders")
    .update({
      payment_status: "paid",
      payment_provider: opts.provider,
      transaction_id: opts.txnId || null,
      paid_amount: opts.amount,
      paid_at: new Date().toISOString(),
      received_amount: opts.amount,
    })
    .eq("id", opts.order.id);
  return "paid";
}

/** Gateways form-POST the return URL, so redirect with HTML, not a 302. */
export function htmlRedirect(target: string): Response {
  const safe = target.replace(/"/g, "&quot;");
  return new Response(
    `<!doctype html><meta http-equiv="refresh" content="0;url=${safe}">` +
      `<script>location.replace(${JSON.stringify(target)})</script>` +
      `<p>Redirecting…</p>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export function appendFlag(url: string, flag: string, status: string, txnId?: string) {
  const sep = url.includes("?") ? "&" : "?";
  const extra = txnId ? `&txn=${encodeURIComponent(txnId)}` : "";
  return `${url}${sep}${flag}=1&pay=${encodeURIComponent(status)}${extra}`;
}
