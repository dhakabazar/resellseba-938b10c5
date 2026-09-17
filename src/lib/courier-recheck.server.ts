import {
  applyCourierUpdate,
  extractCourierLogs,
  getCourierConfig,
  steadfastRequest,
} from "@/lib/couriers.server";

export type RecheckShipment = {
  id: string;
  order_id: string;
  provider: string | null;
  consignment_id: string | null;
  tracking_id: string | null;
  orders?: { order_number?: string | null } | null;
};

/**
 * Ask the courier for the current status of one shipment and store it.
 * The provider tracking log (when it sends one) is replayed too, so the order
 * timeline shows every step instead of jumping straight to the last one.
 */
export async function recheckShipment(supabase: any, sh: RecheckShipment) {
  const provider = sh.provider ?? "steadfast";
  const cid = sh.consignment_id || sh.tracking_id;
  const invoice = sh.orders?.order_number ?? null;

  if (provider === "steadfast") {
    const conf = await getCourierConfig(supabase, "steadfast");
    const path = sh.consignment_id
      ? `/status_by_cid/${sh.consignment_id}`
      : sh.tracking_id
        ? `/status_by_trackingcode/${sh.tracking_id}`
        : `/status_by_invoice/${invoice}`;
    const body = await steadfastRequest(conf, path);
    const courierStatus = String(body.delivery_status || body.status || "unknown");
    const result = await applyCourierUpdate(supabase, {
      provider,
      consignmentId: sh.consignment_id,
      trackingCode: sh.tracking_id,
      invoice,
      courierStatus,
      source: "sync",
      notificationType: "manual_sync",
      payload: body,
      logs: extractCourierLogs(body),
      bypassFinalLock: true,
    });
    return { courierStatus, result };
  }

  if (provider === "pathao") {
    if (!cid) throw new Response("Shipment is not booked with Pathao", { status: 400 });
    const { pathaoRequest } = await import("@/lib/pathao.server");
    const conf = await getCourierConfig(supabase, "pathao");
    const body = await pathaoRequest(
      supabase,
      conf,
      `/aladdin/api/v1/orders/${encodeURIComponent(cid)}/info`,
    );
    const d = body?.data ?? {};
    const courierStatus = String(d.order_status_slug ?? d.order_status ?? "unknown");
    const result = await applyCourierUpdate(supabase, {
      provider,
      consignmentId: sh.consignment_id ?? cid,
      trackingCode: sh.tracking_id,
      invoice: d.merchant_order_id ? String(d.merchant_order_id) : invoice,
      courierStatus,
      source: "sync",
      notificationType: "manual_sync",
      codAmount: d.amount_to_collect != null ? Number(d.amount_to_collect) : null,
      deliveryCharge: d.delivery_fee != null ? Number(d.delivery_fee) : null,
      payload: body,
      logs: extractCourierLogs(body),
      bypassFinalLock: true,
    });
    return { courierStatus, result };
  }

  if (provider === "carrybee") {
    if (!cid) throw new Response("Shipment is not booked with Carrybee", { status: 400 });
    const { carrybeeRequest } = await import("@/lib/carrybee.server");
    const conf = await getCourierConfig(supabase, "carrybee");
    const body = await carrybeeRequest(conf, `/api/v2/orders/${encodeURIComponent(cid)}/details`);
    const d = body?.data ?? {};
    const courierStatus = String(d.transfer_status ?? d.status ?? "unknown");
    const result = await applyCourierUpdate(supabase, {
      provider,
      consignmentId: sh.consignment_id ?? cid,
      trackingCode: sh.tracking_id,
      invoice,
      courierStatus,
      source: "sync",
      notificationType: "manual_sync",
      codAmount: d.collected_amount != null ? Number(d.collected_amount) : null,
      deliveryCharge: d.delivery_fee != null ? Number(d.delivery_fee) : null,
      note: d.reason ?? null,
      payload: body,
      logs: extractCourierLogs(body),
      bypassFinalLock: true,
    });
    return { courierStatus, result };
  }

  throw new Response("This order is not booked with an automatic courier", { status: 400 });
}
