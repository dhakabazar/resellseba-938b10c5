import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orderInput = z.object({ orderId: z.string().uuid() });

async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (!isAdmin) throw new Response("Forbidden", { status: 403 });
}

async function getCourierConfig(supabase: any, provider: string) {
  const { data: cfg } = await supabase
    .from("courier_configs")
    .select("config, is_active")
    .eq("provider", provider)
    .maybeSingle();
  if (!cfg || !cfg.is_active) throw new Response(`${provider} not configured`, { status: 400 });
  return (cfg.config ?? {}) as Record<string, string>;
}

async function getOrder(supabase: any, orderId: string) {
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, customer_phone, address_line, area, total, payment_method")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) throw new Response("Order not found", { status: 404 });
  return order;
}

export const bookSteadfast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => orderInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const conf = await getCourierConfig(supabase, "steadfast");
    if (!conf.api_key || !conf.secret_key) throw new Response("Missing Steadfast credentials", { status: 400 });
    const order = await getOrder(supabase, data.orderId);

    const baseUrl = conf.base_url || "https://portal.packzy.com/api/v1";
    const codAmount = order.payment_method === "cod" ? Number(order.total) : 0;
    const payload = {
      invoice: order.order_number,
      recipient_name: order.customer_name,
      recipient_phone: order.customer_phone,
      recipient_address: order.address_line,
      cod_amount: codAmount,
      note: `Order ${order.order_number}`,
    };
    const res = await fetch(`${baseUrl}/create_order`, {
      method: "POST",
      headers: { "Api-Key": conf.api_key, "Secret-Key": conf.secret_key, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) throw new Response(body.message || "Steadfast booking failed", { status: 502 });
    const trackingId = body.consignment?.tracking_code || String(body.consignment?.consignment_id ?? "");

    await supabase.from("shipments").insert({
      order_id: order.id, provider: "steadfast", tracking_id: trackingId,
      consignment_id: String(body.consignment?.consignment_id ?? ""),
      status: "booked", request_payload: payload, response_payload: body,
      booked_at: new Date().toISOString(), booked_by: userId,
    });
    await supabase.from("orders").update({ status: "shipped" }).eq("id", order.id);
    return { trackingId, status: body.consignment?.status ?? "in_review" };
  });

export const syncSteadfastStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shipmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const conf = await getCourierConfig(supabase, "steadfast");
    const { data: sh } = await supabase.from("shipments").select("id, consignment_id, order_id").eq("id", data.shipmentId).maybeSingle();
    if (!sh?.consignment_id) throw new Response("Shipment not booked", { status: 400 });
    const baseUrl = conf.base_url || "https://portal.packzy.com/api/v1";
    const res = await fetch(`${baseUrl}/status_by_cid/${sh.consignment_id}`, {
      headers: { "Api-Key": conf.api_key!, "Secret-Key": conf.secret_key! },
    });
    const body = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) throw new Response(body.message || "Status fetch failed", { status: 502 });
    const providerStatus: string = (body.delivery_status || body.status || "").toLowerCase();
    const map: Record<string, string> = {
      delivered: "delivered", partial_delivered: "delivered",
      in_review: "booked", pending: "booked", hold: "booked",
      in_transit: "in_transit", returned: "returned",
      cancelled: "cancelled", unknown: "booked",
    };
    const shipStatus = map[providerStatus] ?? "in_transit";
    await supabase.from("shipments").update({ status: shipStatus, response_payload: body }).eq("id", sh.id);
    if (shipStatus === "delivered") await supabase.from("orders").update({ status: "delivered" }).eq("id", sh.order_id);
    else if (shipStatus === "returned") await supabase.from("orders").update({ status: "returned" }).eq("id", sh.order_id);
    return { providerStatus, shipStatus };
  });

export const bookPathao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => orderInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const conf = await getCourierConfig(supabase, "pathao");
    const { client_id, client_secret, username, password, store_id, base_url } = conf;
    if (!client_id || !client_secret || !username || !password || !store_id)
      throw new Response("Missing Pathao credentials", { status: 400 });
    const baseUrl = base_url || "https://api-hermes.pathao.com";
    const order = await getOrder(supabase, data.orderId);

    const tokenRes = await fetch(`${baseUrl}/aladdin/api/v1/issue-token`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id, client_secret, username, password, grant_type: "password" }),
    });
    const tokenBody = (await tokenRes.json().catch(() => ({}))) as any;
    if (!tokenRes.ok || !tokenBody.access_token) throw new Response("Pathao auth failed", { status: 502 });

    const codAmount = order.payment_method === "cod" ? Number(order.total) : 0;
    const payload = {
      store_id: Number(store_id),
      merchant_order_id: order.order_number,
      recipient_name: order.customer_name,
      recipient_phone: order.customer_phone,
      recipient_address: order.address_line,
      recipient_city: 1, recipient_zone: 1, recipient_area: 1,
      delivery_type: 48, item_type: 2, special_instruction: order.area || "",
      item_quantity: 1, item_weight: 0.5, amount_to_collect: codAmount, item_description: `Order ${order.order_number}`,
    };
    const res = await fetch(`${baseUrl}/aladdin/api/v1/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenBody.access_token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) throw new Response(body.message || "Pathao booking failed", { status: 502 });
    const consignmentId = String(body.data?.consignment_id ?? body.data?.order_id ?? "");

    await supabase.from("shipments").insert({
      order_id: order.id, provider: "pathao", tracking_id: consignmentId,
      consignment_id: consignmentId, status: "booked",
      request_payload: payload, response_payload: body,
      booked_at: new Date().toISOString(), booked_by: userId,
    });
    await supabase.from("orders").update({ status: "shipped" }).eq("id", order.id);
    return { trackingId: consignmentId };
  });
