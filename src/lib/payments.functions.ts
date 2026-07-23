import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Payment gateway initialization. All are public (no auth) but require a real
 * order_number so amounts can be derived server-side and cannot be tampered.
 */

async function loadOrder(orderNumber: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, total, customer_name, customer_phone, customer_email, address_line, city, area, reseller_id, payment_method, payment_status")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!order) throw new Response("Order not found", { status: 404 });
  if (order.payment_status === "paid") throw new Response("Already paid", { status: 400 });
  return { order, supabaseAdmin };
}

async function loadConfig(supabaseAdmin: any, method: string, resellerId: string) {
  // reseller override first, then global
  const { data } = await supabaseAdmin
    .from("payment_configs")
    .select("config, mode, is_active, reseller_id")
    .eq("method", method)
    .or(`reseller_id.eq.${resellerId},reseller_id.is.null`);
  const rows = (data ?? []).filter((r: any) => r.is_active);
  const cfg = rows.find((r: any) => r.reseller_id === resellerId) ?? rows.find((r: any) => r.reseller_id === null);
  if (!cfg) throw new Response(`${method} not configured`, { status: 400 });
  return cfg;
}

function siteOrigin(request?: Request): string {
  if (request) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (host) return `${proto}://${host}`;
  }
  return process.env.SITE_URL || "";
}

/* -------------------- SSLCommerz -------------------- */
export const initSslcommerz = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ orderNumber: z.string(), code: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { order, supabaseAdmin } = await loadOrder(data.orderNumber);
    const cfg = await loadConfig(supabaseAdmin, "sslcommerz", order.reseller_id);
    const c = cfg.config as { store_id?: string; store_password?: string };
    if (!c.store_id || !c.store_password) throw new Response("Missing SSLCommerz credentials", { status: 400 });

    const isLive = cfg.mode === "live";
    const base = isLive ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com";
    const origin = siteOrigin();
    const params = new URLSearchParams({
      store_id: c.store_id,
      store_passwd: c.store_password,
      total_amount: String(Number(order.total)),
      currency: "BDT",
      tran_id: order.order_number,
      success_url: `${origin}/api/public/payment/sslcommerz-ipn`,
      fail_url: `${origin}/s/${data.code}/checkout`,
      cancel_url: `${origin}/s/${data.code}/checkout`,
      ipn_url: `${origin}/api/public/payment/sslcommerz-ipn`,
      cus_name: order.customer_name,
      cus_email: order.customer_email || "noreply@example.com",
      cus_phone: order.customer_phone,
      cus_add1: order.address_line,
      cus_city: order.city || "Dhaka",
      cus_country: "Bangladesh",
      shipping_method: "Courier",
      product_name: `Order ${order.order_number}`,
      product_category: "General",
      product_profile: "general",
    });
    const res = await fetch(`${base}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const body = (await res.json().catch(() => ({}))) as any;
    if (body.status !== "SUCCESS" || !body.GatewayPageURL) {
      throw new Response(body.failedreason || "SSLCommerz init failed", { status: 502 });
    }
    return { redirectUrl: body.GatewayPageURL as string };
  });

/* -------------------- bKash Tokenized Checkout -------------------- */
async function bkashToken(base: string, appKey: string, appSecret: string, username: string, password: string) {
  const res = await fetch(`${base}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json", username, password },
    body: JSON.stringify({ app_key: appKey, app_secret: appSecret }),
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!body.id_token) throw new Response(body.statusMessage || "bKash auth failed", { status: 502 });
  return body.id_token as string;
}

export const initBkash = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ orderNumber: z.string(), code: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { order, supabaseAdmin } = await loadOrder(data.orderNumber);
    const cfg = await loadConfig(supabaseAdmin, "bkash", order.reseller_id);
    const c = cfg.config as { app_key?: string; app_secret?: string; username?: string; password?: string };
    if (!c.app_key || !c.app_secret || !c.username || !c.password) {
      throw new Response("Missing bKash credentials", { status: 400 });
    }
    const isLive = cfg.mode === "live";
    const base = isLive
      ? "https://tokenized.pay.bka.sh/v1.2.0-beta"
      : "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
    const token = await bkashToken(base, c.app_key, c.app_secret, c.username, c.password);
    const origin = siteOrigin();
    const payload = {
      mode: "0011",
      payerReference: order.customer_phone,
      callbackURL: `${origin}/api/public/payment/bkash-callback?order=${encodeURIComponent(order.order_number)}&code=${encodeURIComponent(data.code)}`,
      amount: String(Number(order.total).toFixed(2)),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: order.order_number,
    };
    const res = await fetch(`${base}/tokenized/checkout/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json", authorization: token, "x-app-key": c.app_key },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as any;
    if (!body.bkashURL) throw new Response(body.statusMessage || "bKash init failed", { status: 502 });
    // stash paymentID so callback can execute
    await supabaseAdmin.from("orders").update({ admin_note: `bkash:${body.paymentID}` }).eq("id", order.id);
    return { redirectUrl: body.bkashURL as string };
  });
