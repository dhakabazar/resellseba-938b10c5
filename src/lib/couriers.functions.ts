import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  applyCourierUpdate,
  assertAdmin,
  fullAddress,
  getCourierConfig,
  getOrderForBooking,
  normalizePhone,
  steadfastRequest,
} from "@/lib/couriers.server";

const orderInput = z.object({ orderId: z.string().uuid() });

export const bookSteadfast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        deliveryType: z.union([z.literal(0), z.literal(1)]).optional(),
        note: z.string().max(250).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const conf = await getCourierConfig(supabase, "steadfast");
    const order = await getOrderForBooking(supabase, data.orderId);

    const { data: existing } = await supabase
      .from("shipments")
      .select("id")
      .eq("order_id", order.id)
      .not("consignment_id", "is", null)
      .maybeSingle();
    if (existing) throw new Response("This order is already booked with a courier", { status: 400 });

    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, quantity")
      .eq("order_id", order.id);

    const codAmount = order.payment_method === "cod" ? Number(order.total) : 0;
    const payload = {
      invoice: order.order_number,
      recipient_name: String(order.customer_name).slice(0, 100),
      recipient_phone: normalizePhone(order.customer_phone),
      recipient_address: fullAddress(order),
      cod_amount: codAmount,
      note: (data.note || order.reseller_note || order.notes || "")?.slice(0, 250) || undefined,
      item_description:
        (items ?? []).map((i: any) => `${i.product_name} x${i.quantity}`).join(", ").slice(0, 250) ||
        undefined,
      total_lot: (items ?? []).reduce((s: number, i: any) => s + Number(i.quantity || 0), 0) || 1,
      delivery_type: data.deliveryType ?? 0,
    };

    const body = await steadfastRequest(conf, "/create_order", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const c = body.consignment ?? {};
    const trackingId = c.tracking_code || String(c.consignment_id ?? "");
    const nowIso = new Date().toISOString();

    const { data: shipment } = await supabase
      .from("shipments")
      .insert({
        order_id: order.id,
        provider: "steadfast",
        tracking_id: trackingId,
        consignment_id: String(c.consignment_id ?? ""),
        status: "booked",
        courier_status: String(c.status ?? "in_review"),
        cod_amount: Number(c.cod_amount ?? codAmount),
        request_payload: payload,
        response_payload: body,
        booked_at: nowIso,
        last_event_at: nowIso,
        booked_by: userId,
      })
      .select("id")
      .single();

    await supabase.from("courier_events").insert({
      order_id: order.id,
      shipment_id: shipment?.id ?? null,
      provider: "steadfast",
      source: "sync",
      notification_type: "booking",
      courier_status: String(c.status ?? "in_review"),
      consignment_id: String(c.consignment_id ?? ""),
      tracking_code: trackingId,
      cod_amount: Number(c.cod_amount ?? codAmount),
      note: "Consignment created",
      payload: body,
      event_at: nowIso,
    });

    // Booking alone does NOT change the order status. The status only moves when a
    // courier webhook/sync event arrives (received -> to courier, delivered, return).
    await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: (order as { status: string }).status,
      note: `Steadfast booked · ${trackingId}`,
      changed_by: userId,
    });

    return { success: true, trackingId, consignmentId: String(c.consignment_id ?? ""), status: c.status ?? "in_review" };
  });


export const syncSteadfastStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shipmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const conf = await getCourierConfig(supabase, "steadfast");
    const { data: sh } = await supabase
      .from("shipments")
      .select("id, consignment_id, tracking_id, order_id, orders(order_number)")
      .eq("id", data.shipmentId)
      .maybeSingle();
    if (!sh) throw new Response("Shipment not found", { status: 404 });

    const path = sh.consignment_id
      ? `/status_by_cid/${sh.consignment_id}`
      : sh.tracking_id
        ? `/status_by_trackingcode/${sh.tracking_id}`
        : `/status_by_invoice/${(sh as any).orders?.order_number}`;
    const body = await steadfastRequest(conf, path);
    const courierStatus = String(body.delivery_status || body.status || "unknown").toLowerCase();

    const result = await applyCourierUpdate(supabase, {
      consignmentId: sh.consignment_id,
      trackingCode: sh.tracking_id,
      invoice: (sh as any).orders?.order_number,
      courierStatus,
      source: "sync",
      notificationType: "manual_sync",
      payload: body,
      bypassFinalLock: true, // Super Admin manual sync bypasses lock
    });

    return { courierStatus, shipStatus: result.matched ? result.mapped.ship : null };
  });

export const steadfastBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const conf = await getCourierConfig(supabase, "steadfast");
    const body = await steadfastRequest(conf, "/get_balance");
    return { balance: Number(body.current_balance ?? 0) };
  });

export const steadfastCreateReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ shipmentId: z.string().uuid(), reason: z.string().max(250).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const conf = await getCourierConfig(supabase, "steadfast");
    const { data: sh } = await supabase
      .from("shipments")
      .select("id, consignment_id, tracking_id, order_id")
      .eq("id", data.shipmentId)
      .maybeSingle();
    if (!sh?.consignment_id && !sh?.tracking_id)
      throw new Response("Shipment is not booked with Steadfast", { status: 400 });

    const body = await steadfastRequest(conf, "/create_return_request", {
      method: "POST",
      body: JSON.stringify({
        ...(sh.consignment_id
          ? { consignment_id: Number(sh.consignment_id) }
          : { tracking_code: sh.tracking_id }),
        ...(data.reason ? { reason: data.reason } : {}),
      }),
    });

    const nowIso = new Date().toISOString();
    await supabase.from("courier_events").insert({
      order_id: sh.order_id,
      shipment_id: sh.id,
      provider: "steadfast",
      source: "sync",
      notification_type: "return_request",
      courier_status: String(body.status ?? body?.data?.status ?? "pending"),
      consignment_id: sh.consignment_id,
      tracking_code: sh.tracking_id,
      note: data.reason ?? "Return requested",
      payload: body,
      event_at: nowIso,
    });
    await supabase.from("orders").update({ status: "pending_return" }).eq("id", sh.order_id);
    await supabase.from("order_status_history").insert({
      order_id: sh.order_id,
      status: "pending_return",
      note: `Return requested: ${data.reason ?? "—"}`,
      changed_by: userId,
    });

    return { status: String(body.status ?? body?.data?.status ?? "pending") };
  });

export const steadfastReturnRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const conf = await getCourierConfig(supabase, "steadfast");
    const body = await steadfastRequest(conf, "/get_return_requests");
    return { data: body?.data ?? body ?? [] };
  });

/* -------------------------------- Pathao -------------------------------- */

async function pathaoConf(supabase: any) {
  return getCourierConfig(supabase, "pathao");
}

export const pathaoStores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { pathaoStoreList } = await import("@/lib/pathao.server");
    const conf = await pathaoConf(supabase);
    return { stores: await pathaoStoreList(supabase, conf) };
  });

export const pathaoPricePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        cityId: z.number().int().positive(),
        zoneId: z.number().int().positive(),
        itemWeight: z.number().min(0.5).max(10).optional(),
        deliveryType: z.union([z.literal(48), z.literal(12)]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { pathaoPricePlanRequest } = await import("@/lib/pathao.server");
    const conf = await pathaoConf(supabase);
    if (!conf.store_id) throw new Response("Pathao store id set korun", { status: 400 });
    return pathaoPricePlanRequest(supabase, conf, { storeId: conf.store_id, ...data });
  });

export const bookPathao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        deliveryType: z.union([z.literal(48), z.literal(12)]).optional(),
        itemWeight: z.number().min(0.5).max(10).optional(),
        note: z.string().max(250).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { pathaoRequest } = await import("@/lib/pathao.server");
    const conf = await pathaoConf(supabase);
    if (!conf.store_id) throw new Response("Pathao store id set korun", { status: 400 });
    const order = await getOrderForBooking(supabase, data.orderId);

    const { data: existing } = await supabase
      .from("shipments")
      .select("id")
      .eq("order_id", order.id)
      .not("consignment_id", "is", null)
      .maybeSingle();
    if (existing) throw new Response("This order is already booked with a courier", { status: 400 });

    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, quantity")
      .eq("order_id", order.id);
    const quantity = (items ?? []).reduce((s: number, i: any) => s + Number(i.quantity || 0), 0) || 1;

    const codAmount = order.payment_method === "cod" ? Math.round(Number(order.total)) : 0;
    // recipient_city/zone/area are intentionally omitted — Pathao resolves them
    // from the address, and sending nulls is rejected by the API.
    const payload: Record<string, unknown> = {
      store_id: Number(conf.store_id),
      merchant_order_id: order.order_number,
      recipient_name: String(order.customer_name).slice(0, 100),
      recipient_phone: normalizePhone(order.customer_phone),
      recipient_address: fullAddress(order).padEnd(10, " ").slice(0, 220),
      delivery_type: data.deliveryType ?? 48,
      item_type: 2,
      item_quantity: quantity,
      item_weight: String(data.itemWeight ?? 0.5),
      amount_to_collect: codAmount,
      item_description:
        (items ?? []).map((i: any) => `${i.product_name} x${i.quantity}`).join(", ").slice(0, 250) ||
        `Order ${order.order_number}`,
      special_instruction:
        (data.note || order.reseller_note || order.notes || "")?.slice(0, 250) || undefined,
    };

    const body = await pathaoRequest(supabase, conf, "/aladdin/api/v1/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const d = body?.data ?? {};
    const consignmentId = String(d.consignment_id ?? "");
    const courierStatus = String(d.order_status ?? "pending");
    const deliveryFee = d.delivery_fee != null ? Number(d.delivery_fee) : null;
    const nowIso = new Date().toISOString();

    const { data: shipment } = await supabase
      .from("shipments")
      .insert({
        order_id: order.id,
        provider: "pathao",
        tracking_id: consignmentId,
        consignment_id: consignmentId,
        status: "booked",
        courier_status: courierStatus.toLowerCase(),
        cod_amount: codAmount,
        delivery_charge: deliveryFee,
        cost: deliveryFee ?? 0,
        request_payload: payload as any,
        response_payload: body,
        booked_at: nowIso,
        last_event_at: nowIso,
        booked_by: userId,
      })
      .select("id")
      .single();

    await supabase.from("courier_events").insert({
      order_id: order.id,
      shipment_id: shipment?.id ?? null,
      provider: "pathao",
      source: "sync",
      notification_type: "booking",
      courier_status: courierStatus.toLowerCase(),
      consignment_id: consignmentId,
      tracking_code: consignmentId,
      cod_amount: codAmount,
      delivery_charge: deliveryFee,
      note: "Consignment created",
      payload: body,
      event_at: nowIso,
    });

    // Booking alone does NOT change the order status. The status only moves when a
    // courier webhook/sync event arrives (received -> to courier, delivered, return).
    await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: (order as { status: string }).status,
      note: `Pathao booked · ${consignmentId}`,
      changed_by: userId,
    });

    return { success: true, trackingId: consignmentId, consignmentId, deliveryFee: deliveryFee ?? 0 };
  });


export const syncPathaoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shipmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { pathaoOrderInfo } = await import("@/lib/pathao.server");
    const conf = await pathaoConf(supabase);
    const { data: sh } = await supabase
      .from("shipments")
      .select("id, consignment_id, tracking_id, order_id")
      .eq("id", data.shipmentId)
      .maybeSingle();
    const cid = sh?.consignment_id || sh?.tracking_id;
    if (!cid) throw new Response("Shipment is not booked with Pathao", { status: 400 });

    const info = await pathaoOrderInfo(supabase, conf, cid);
    const result = await applyCourierUpdate(supabase, {
      provider: "pathao",
      consignmentId: sh?.consignment_id ?? cid,
      trackingCode: sh?.tracking_id ?? null,
      invoice: info.merchantOrderId,
      courierStatus: info.status,
      source: "sync",
      notificationType: "manual_sync",
      payload: info,
      bypassFinalLock: true,
    });

    return { courierStatus: info.status, shipStatus: result.matched ? result.mapped.ship : null };
  });


/* ------------------------------- Carrybee ------------------------------- */

async function carrybeeConf(supabase: any) {
  return getCourierConfig(supabase, "carrybee");
}

export const carrybeeStores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { carrybeeRequest } = await import("@/lib/carrybee.server");
    const conf = await carrybeeConf(supabase);
    const body = await carrybeeRequest(conf, "/api/v2/stores");
    const stores = (body?.data?.stores ?? []).map((s: any) => ({
      id: String(s.id),
      name: String(s.name ?? ""),
      isApproved: Boolean(s.is_approved),
      isActive: Boolean(s.is_active),
      isDefaultPickup: Boolean(s.is_default_pickup_store),
    }));
    return { stores };
  });

export const bookCarrybee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        deliveryType: z.union([z.literal(1), z.literal(2)]).optional(),
        productType: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        itemWeight: z.number().int().min(1).max(25000).optional(),
        isExchange: z.boolean().optional(),
        note: z.string().max(250).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { carrybeeRequest, carrybeeResolveLocation } = await import("@/lib/carrybee.server");
    const conf = await carrybeeConf(supabase);
    if (!conf.store_id) throw new Response("Carrybee store id set korun", { status: 400 });
    const order = await getOrderForBooking(supabase, data.orderId);

    const { data: existing } = await supabase
      .from("shipments")
      .select("id")
      .eq("order_id", order.id)
      .not("consignment_id", "is", null)
      .maybeSingle();
    if (existing) throw new Response("This order is already booked with a courier", { status: 400 });

    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, quantity")
      .eq("order_id", order.id);
    const quantity = (items ?? []).reduce((s: number, i: any) => s + Number(i.quantity || 0), 0) || 1;

    const address = fullAddress(order);
    const loc = await carrybeeResolveLocation(conf, {
      address,
      city: order.city,
      area: order.area,
    });

    const codAmount = order.payment_method === "cod" ? Math.round(Number(order.total)) : 0;
    const payload: Record<string, unknown> = {
      store_id: conf.store_id,
      merchant_order_id: order.order_number,
      delivery_type: data.deliveryType ?? 1,
      product_type: data.productType ?? 1,
      recipient_phone: normalizePhone(order.customer_phone),
      recipient_name: String(order.customer_name).slice(0, 99),
      recipient_address: address.padEnd(10, " ").slice(0, 200),
      city_id: loc.cityId,
      zone_id: loc.zoneId,
      ...(loc.areaId ? { area_id: loc.areaId } : {}),
      item_weight: data.itemWeight ?? Math.min(25000, Math.max(500, quantity * 500)),
      item_quantity: Math.min(200, quantity),
      collectable_amount: Math.min(100000, codAmount),
      product_description:
        (items ?? []).map((i: any) => `${i.product_name} x${i.quantity}`).join(", ").slice(0, 255) ||
        undefined,
      special_instruction: (data.note || order.reseller_note || order.notes || "")?.slice(0, 255) || undefined,
      ...(data.isExchange ? { is_exchange: true } : {}),
    };

    const body = await carrybeeRequest(conf, "/api/v2/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const o = body?.data?.order ?? body?.data ?? {};
    const consignmentId = String(o.consignment_id ?? "");
    const nowIso = new Date().toISOString();

    const { data: shipment } = await supabase
      .from("shipments")
      .insert({
        order_id: order.id,
        provider: "carrybee",
        tracking_id: consignmentId,
        consignment_id: consignmentId,
        status: "booked",
        courier_status: "created",
        cod_amount: Number(o.collectable_amount ?? codAmount),
        delivery_charge: o.delivery_fee != null ? Number(o.delivery_fee) : null,
        cost: o.delivery_fee != null ? Number(o.delivery_fee) : 0,
        request_payload: payload as any,

        response_payload: body,
        booked_at: nowIso,
        last_event_at: nowIso,
        booked_by: userId,
      })
      .select("id")
      .single();

    await supabase.from("courier_events").insert({
      order_id: order.id,
      shipment_id: shipment?.id ?? null,
      provider: "carrybee",
      source: "sync",
      notification_type: "booking",
      courier_status: "created",
      consignment_id: consignmentId,
      tracking_code: consignmentId,
      cod_amount: Number(o.collectable_amount ?? codAmount),
      delivery_charge: o.delivery_fee != null ? Number(o.delivery_fee) : null,
      note: "Consignment created",
      payload: body,
      event_at: nowIso,
    });

    // Booking alone does NOT change the order status. The status only moves when a
    // courier webhook/sync event arrives (received -> to courier, delivered, return).
    await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: (order as { status: string }).status,
      note: `Carrybee booked · ${consignmentId}`,
      changed_by: userId,
    });

    return { success: true, trackingId: consignmentId, consignmentId, deliveryFee: Number(o.delivery_fee ?? 0) };
  });


export const syncCarrybeeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shipmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { carrybeeRequest } = await import("@/lib/carrybee.server");
    const conf = await carrybeeConf(supabase);
    const { data: sh } = await supabase
      .from("shipments")
      .select("id, consignment_id, tracking_id, order_id")
      .eq("id", data.shipmentId)
      .maybeSingle();
    const cid = sh?.consignment_id || sh?.tracking_id;
    if (!cid) throw new Response("Shipment is not booked with Carrybee", { status: 400 });

    const body = await carrybeeRequest(conf, `/api/v2/orders/${encodeURIComponent(cid)}/details`);
    const d = body?.data ?? {};
    const courierStatus = String(d.transfer_status ?? "unknown");

    const result = await applyCourierUpdate(supabase, {
      provider: "carrybee",
      consignmentId: sh?.consignment_id ?? cid,
      trackingCode: sh?.tracking_id ?? null,
      courierStatus,
      source: "sync",
      notificationType: "manual_sync",
      codAmount: d.collected_amount != null ? Number(d.collected_amount) : null,
      deliveryCharge: d.delivery_fee != null ? Number(d.delivery_fee) : null,
      note: d.reason ?? null,
      payload: body,
      bypassFinalLock: true,
    });

    return { courierStatus, shipStatus: result.matched ? result.mapped.ship : null };
  });

export const cancelCarrybee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ shipmentId: z.string().uuid(), reason: z.string().min(2).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { carrybeeRequest } = await import("@/lib/carrybee.server");
    const conf = await carrybeeConf(supabase);
    const { data: sh } = await supabase
      .from("shipments")
      .select("id, consignment_id, tracking_id, order_id")
      .eq("id", data.shipmentId)
      .maybeSingle();
    const cid = sh?.consignment_id || sh?.tracking_id;
    if (!cid) throw new Response("Shipment is not booked with Carrybee", { status: 400 });

    const body = await carrybeeRequest(conf, `/api/v2/orders/${encodeURIComponent(cid)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ cancellation_reason: data.reason }),
    });

    const nowIso = new Date().toISOString();
    await supabase.from("courier_events").insert({
      order_id: sh!.order_id,
      shipment_id: sh!.id,
      provider: "carrybee",
      source: "sync",
      notification_type: "cancel",
      courier_status: "pickup-cancelled",
      consignment_id: sh!.consignment_id,
      tracking_code: sh!.tracking_id,
      note: data.reason,
      payload: body,
      event_at: nowIso,
    });
    await supabase
      .from("shipments")
      .update({ status: "cancelled", courier_status: "pickup-cancelled", last_event_at: nowIso })
      .eq("id", sh!.id);

    return { ok: true };
  });

export const carrybeeReversePickup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        shipmentId: z.string().uuid(),
        reason: z.string().max(255).optional(),
        itemWeight: z.number().int().min(1).max(25000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { carrybeeRequest } = await import("@/lib/carrybee.server");
    const conf = await carrybeeConf(supabase);
    const { data: sh } = await supabase
      .from("shipments")
      .select("id, consignment_id, tracking_id, order_id")
      .eq("id", data.shipmentId)
      .maybeSingle();
    const cid = sh?.consignment_id || sh?.tracking_id;
    if (!cid) throw new Response("Shipment is not booked with Carrybee", { status: 400 });

    const body = await carrybeeRequest(
      conf,
      `/api/v2/orders/${encodeURIComponent(cid)}/reverse-pickup`,
      {
        method: "POST",
        body: JSON.stringify({
          ...(conf.store_id ? { store_id: conf.store_id } : {}),
          ...(data.itemWeight ? { item_weight: data.itemWeight } : {}),
          ...(data.reason ? { special_instruction: data.reason } : {}),
        }),
      },
    );
    const newCid = String(body?.data?.consignment_id ?? "");
    const nowIso = new Date().toISOString();

    await supabase.from("courier_events").insert({
      order_id: sh!.order_id,
      shipment_id: sh!.id,
      provider: "carrybee",
      source: "sync",
      notification_type: "reverse_pickup",
      courier_status: "returned-in-transit",
      consignment_id: newCid || sh!.consignment_id,
      tracking_code: sh!.tracking_id,
      note: `Reverse pickup created${newCid ? ` · ${newCid}` : ""}${data.reason ? ` · ${data.reason}` : ""}`,
      payload: body,
      event_at: nowIso,
    });
    await supabase.from("orders").update({ status: "pending_return" }).eq("id", sh!.order_id);
    await supabase.from("order_status_history").insert({
      order_id: sh!.order_id,
      status: "pending_return",
      note: `Carrybee reverse pickup${newCid ? ` · ${newCid}` : ""}`,
      changed_by: userId,
    });

    return { consignmentId: newCid };
  });

export const carrybeeExchange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        shipmentId: z.string().uuid(),
        collectableAmount: z.number().int().min(0).max(100000).optional(),
        itemWeight: z.number().int().min(1).max(25000).optional(),
        note: z.string().max(255).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { carrybeeRequest } = await import("@/lib/carrybee.server");
    const conf = await carrybeeConf(supabase);
    const { data: sh } = await supabase
      .from("shipments")
      .select("id, consignment_id, tracking_id, order_id")
      .eq("id", data.shipmentId)
      .maybeSingle();
    const cid = sh?.consignment_id || sh?.tracking_id;
    if (!cid) throw new Response("Shipment is not booked with Carrybee", { status: 400 });

    const body = await carrybeeRequest(conf, `/api/v2/orders/${encodeURIComponent(cid)}/exchange`, {
      method: "POST",
      body: JSON.stringify({
        ...(data.collectableAmount != null ? { collectable_amount: data.collectableAmount } : {}),
        ...(data.itemWeight ? { item_weight: data.itemWeight } : {}),
        ...(data.note ? { special_instruction: data.note } : {}),
      }),
    });
    const o = body?.data?.order ?? body?.data ?? {};
    const newCid = String(o.consignment_id ?? "");

    await supabase.from("courier_events").insert({
      order_id: sh!.order_id,
      shipment_id: sh!.id,
      provider: "carrybee",
      source: "sync",
      notification_type: "exchange",
      courier_status: "exchange",
      consignment_id: newCid || sh!.consignment_id,
      tracking_code: sh!.tracking_id,
      note: `Exchange order created${newCid ? ` · ${newCid}` : ""}`,
      payload: body,
      event_at: new Date().toISOString(),
    });

    return { consignmentId: newCid };
  });

/**
 * Manual final step: parcel physically received back — order becomes "returned".
 * Only super admin can do this; courier webhooks never set this state.
 */
export const receiveReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ orderId: z.string().uuid(), note: z.string().max(250).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    await supabase.from("orders").update({ status: "returned" }).eq("id", data.orderId);
    await supabase.from("order_status_history").insert({
      order_id: data.orderId,
      status: "returned",
      note: data.note ? `Return received: ${data.note}` : "Return received by admin",
      changed_by: userId,
    });
    await supabase
      .from("shipments")
      .update({ status: "returned", last_event_at: new Date().toISOString() })
      .eq("order_id", data.orderId);
    await supabase.from("courier_events").insert({
      order_id: data.orderId,
      provider: "manual",
      source: "sync",
      notification_type: "return_received",
      courier_status: "returned",
      note: data.note ?? "Return parcel received",
      payload: {},
      event_at: new Date().toISOString(),
    });

    return { ok: true };
  });
