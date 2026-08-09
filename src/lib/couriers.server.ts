import { mapCourierStatus, normalizeCourierStatus } from "@/lib/courier-status";

export type Cfg = Record<string, string>;

export async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (!isAdmin) throw new Response("Forbidden", { status: 403 });
}

export async function getCourierConfig(supabase: any, provider: string): Promise<Cfg> {
  const { data: cfg } = await supabase
    .from("courier_configs")
    .select("config, is_active")
    .eq("provider", provider)
    .maybeSingle();
  if (!cfg || !cfg.is_active) throw new Response(`${provider} not configured`, { status: 400 });
  return (cfg.config ?? {}) as Cfg;
}

export function steadfastBase(conf: Cfg) {
  return (conf.base_url || "https://portal.packzy.com/api/v1").replace(/\/+$/, "");
}

export function steadfastHeaders(conf: Cfg) {
  if (!conf.api_key || !conf.secret_key)
    throw new Response("Missing Steadfast credentials", { status: 400 });
  return {
    "Api-Key": conf.api_key,
    "Secret-Key": conf.secret_key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function steadfastRequest(conf: Cfg, path: string, init?: RequestInit) {
  const res = await fetch(`${steadfastBase(conf)}${path}`, {
    ...init,
    headers: { ...steadfastHeaders(conf), ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    console.error(`Steadfast ${path} failed [${res.status}]: ${text}`);
    throw new Response(body?.message || `Steadfast request failed (${res.status})`, { status: 502 });
  }
  return body;
}

export async function getOrderForBooking(supabase: any, orderId: string) {
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, customer_name, customer_phone, address_line, city, area, landmark, total, payment_method, notes, reseller_note",
    )

    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) throw new Response("Order not found", { status: 404 });
  return order;
}

export function normalizePhone(phone: string) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("880")) return digits.slice(2);
  if (digits.length === 10 && digits.startsWith("1")) return `0${digits}`;
  return digits;
}

export function fullAddress(order: {
  address_line: string;
  city?: string | null;
  area?: string | null;
  landmark?: string | null;
}) {
  const parts = [order.address_line, order.landmark, order.city, (order.area ?? "").replace(/_/g, " ")]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  return parts.join(", ").slice(0, 250);
}

/**
 * Persist a courier status update: append a courier event, update the shipment
 * and move the order status accordingly. Used by both manual sync and webhook.
 */
export async function applyCourierUpdate(
  db: any,
  args: {
    provider?: string | null;
    consignmentId?: string | null;
    trackingCode?: string | null;
    invoice?: string | null;
    courierStatus: string;
    source: "webhook" | "sync";
    notificationType?: string | null;
    codAmount?: number | null;
    deliveryCharge?: number | null;
    note?: string | null;
    payload?: unknown;
    bypassFinalLock?: boolean;
  },
) {
  let shipment: any = null;
  if (args.consignmentId) {
    const { data } = await db
      .from("shipments")
      .select("id, order_id, provider")
      .eq("consignment_id", String(args.consignmentId))
      .maybeSingle();
    shipment = data ?? null;
  }
  if (!shipment && args.trackingCode) {
    const { data } = await db
      .from("shipments")
      .select("id, order_id, provider")
      .eq("tracking_id", String(args.trackingCode))
      .maybeSingle();
    shipment = data ?? null;
  }
  let orderId: string | null = shipment?.order_id ?? null;
  if (!orderId && args.invoice) {
    const { data } = await db
      .from("orders")
      .select("id")
      .eq("order_number", args.invoice)
      .maybeSingle();
    orderId = data?.id ?? null;
  }
  if (!orderId) return { matched: false as const };

  const provider = shipment?.provider ?? args.provider ?? "steadfast";
  const statusKey = normalizeCourierStatus(provider, args.courierStatus) || "unknown";
  const mapped = mapCourierStatus(provider, args.courierStatus);
  const nowIso = new Date().toISOString();

  await db.from("courier_events").insert({
    order_id: orderId,
    shipment_id: shipment?.id ?? null,
    provider,
    source: args.source,
    notification_type: args.notificationType ?? null,
    courier_status: statusKey,
    consignment_id: args.consignmentId ? String(args.consignmentId) : null,
    tracking_code: args.trackingCode ? String(args.trackingCode) : null,
    cod_amount: args.codAmount ?? null,
    delivery_charge: args.deliveryCharge ?? null,
    note: args.note ?? null,
    payload: (args.payload ?? {}) as any,
    event_at: nowIso,
  });

  if (shipment?.id) {
    await db
      .from("shipments")
      .update({
        status: mapped.ship,
        courier_status: statusKey,
        cod_amount: args.codAmount ?? undefined,
        delivery_charge: args.deliveryCharge ?? undefined,
        courier_note: args.note ?? undefined,
        last_event_at: nowIso,
        last_synced_at: nowIso,
        response_payload: (args.payload ?? {}) as any,
      })
      .eq("id", shipment.id);
  }

  const { data: order } = await db.from("orders").select("status").eq("id", orderId).maybeSingle();
  // "returned" and "cancelled" are final, manually-confirmed states — courier
  // events must never overwrite them.
  const finalStates = ["returned", "cancelled"];
  const isLocked = order && finalStates.includes(order.status) && !args.bypassFinalLock;
  
  if (order && order.status !== mapped.order && !isLocked) {
    await db.from("orders").update({ status: mapped.order }).eq("id", orderId);
    await db.from("order_status_history").insert({
      order_id: orderId,
      status: mapped.order,
      note: `${provider} update (${args.source}): ${statusKey}${args.bypassFinalLock ? " (Admin Override)" : ""}`,
    });
  }

  return { matched: true as const, orderId, shipmentId: shipment?.id ?? null, mapped };
}

