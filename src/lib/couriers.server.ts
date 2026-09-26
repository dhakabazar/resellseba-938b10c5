import { canAutoApplyStatus, mapCourierStatus, normalizeCourierStatus } from "@/lib/courier-status";

export type Cfg = Record<string, string>;

export async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_any_permission", {
    _user_id: userId,
    _permissions: ["couriers.manage", "orders.ship", "orders.status", "orders.edit"],
  });
  if (error || !data) throw new Response("Forbidden", { status: 403 });
}

/**
 * Courier credentials live in `courier_configs`, readable only by
 * `couriers.manage` holders. Booking/sync flows are permission-gated already,
 * so the config is fetched through the `courier_config_get` database function,
 * which re-checks the caller's permissions server-side. No service-role key is
 * needed, so this also works on custom domains where that key is absent.
 */
export async function getCourierConfig(supabase: any, provider: string): Promise<Cfg> {
  const { data, error } = await supabase.rpc("courier_config_get", { _provider: provider });
  if (error)
    throw new Response(`Cannot read ${provider} settings: ${error.message}`, { status: 403 });
  if (!data) throw new Response(`${provider} not configured`, { status: 400 });
  return (data ?? {}) as Cfg;
}

/** Persist partial config changes (e.g. cached Pathao tokens) via the same gate. */
export async function patchCourierConfig(supabase: any, provider: string, patch: any) {
  await supabase.rpc("courier_config_patch", { _provider: provider, _patch: patch });
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
    signal: init?.signal ?? AbortSignal.timeout(8_000),
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

/** A courier tracking-log entry replayed into the order timeline. */
export type CourierLogEntry = { status: string; at?: string | null; note?: string | null };

/**
 * Pull a tracking log out of whatever shape the provider returned, so the
 * in-between steps (picked → sorted → in transit → delivered) stay visible in
 * the order timeline even when the status is only checked once at the end.
 */
export function extractCourierLogs(payload: unknown): CourierLogEntry[] {
  const root: any = payload ?? {};
  const candidates = [
    root?.logs,
    root?.log,
    root?.tracking,
    root?.trackings,
    root?.timeline,
    root?.histories,
    root?.history,
    root?.order_logs,
    root?.status_log,
    root?.data?.logs,
    root?.data?.tracking,
    root?.data?.timeline,
    root?.data?.histories,
    root?.data?.order_logs,
    root?.data?.status_log,
  ];
  const list = candidates.find((c) => Array.isArray(c) && c.length > 0) as any[] | undefined;
  if (!list) return [];
  return list
    .map((row: any) => {
      const status = row?.status ?? row?.order_status ?? row?.event ?? row?.transfer_status ?? row?.state;
      if (!status) return null;
      return {
        status: String(status),
        at: row?.updated_at ?? row?.created_at ?? row?.event_at ?? row?.time ?? row?.date ?? null,
        note: row?.reason ?? row?.remarks ?? row?.note ?? row?.message ?? null,
      } as CourierLogEntry;
    })
    .filter(Boolean) as CourierLogEntry[];
}

/**
 * Persist a courier status update: append a courier event, update the shipment
 * and move the order status accordingly. Used by both manual sync and webhook.
 *
 * Automatic status movement is deliberately narrow (see canAutoApplyStatus):
 * Courier Handover / To Courier are the only starting points, and the only
 * automatic destinations are To Courier, Delivered, Pending Partial and
 * Pending Return. Every other courier event is only logged.
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
    /** Provider tracking log replayed so intermediate steps stay visible. */
    logs?: CourierLogEntry[];
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

  // Replay the provider tracking log first (oldest → newest) so the timeline
  // keeps the middle steps, skipping the ones already stored.
  if (args.logs?.length) {
    const { data: seen } = await db
      .from("courier_events")
      .select("courier_status")
      .eq("order_id", orderId);
    const known = new Set<string>((seen ?? []).map((r: any) => String(r.courier_status)));
    const ordered = [...args.logs].sort(
      (a, b) => new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime(),
    );
    for (const entry of ordered) {
      const key = normalizeCourierStatus(provider, entry.status);
      if (!key || key === statusKey || known.has(key)) continue;
      known.add(key);
      const at = entry.at ? new Date(entry.at) : null;
      await db.from("courier_events").insert({
        order_id: orderId,
        shipment_id: shipment?.id ?? null,
        provider,
        source: args.source,
        notification_type: "tracking_log",
        courier_status: key,
        consignment_id: args.consignmentId ? String(args.consignmentId) : null,
        tracking_code: args.trackingCode ? String(args.trackingCode) : null,
        note: entry.note ?? null,
        payload: entry as any,
        event_at: at && !Number.isNaN(at.getTime()) ? at.toISOString() : nowIso,
      });
    }
  }

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

  const { data: order } = await db
    .from("orders")
    .select("status, rider_assigned_at")
    .eq("id", orderId)
    .maybeSingle();
  // "returned" and "cancelled" are final, manually-confirmed states — courier
  // events must never overwrite them.
  const finalStates = ["returned", "cancelled"];
  const isLocked = order && finalStates.includes(order.status) && !args.bypassFinalLock;

  // Courier-collected money (partial delivery / paid return = less than the
  // order total). Stored on the order so profit/loss uses what was really received.
  if (
    order &&
    !isLocked &&
    args.codAmount != null &&
    (mapped.order === "delivered" || mapped.order === "pending_partial")
  ) {
    await db.from("orders").update({ received_amount: args.codAmount }).eq("id", orderId);
  }

  const orderPatch: Record<string, unknown> = {};
  // Rider Followup: parcel handed to a rider — remembered with the moment it happened.
  if (mapped.rider) {
    orderPatch["rider_status"] = mapped.label;
    if (!order?.rider_assigned_at) orderPatch["rider_assigned_at"] = nowIso;
  } else if (
    order?.rider_assigned_at &&
    (mapped.order === "delivered" || mapped.order === "pending_partial" || mapped.order === "pending_return")
  ) {
    orderPatch["rider_assigned_at"] = null;
    orderPatch["rider_status"] = null;
  }

  const nextStatus =
    order && !isLocked && canAutoApplyStatus(order.status, mapped.order) ? mapped.order : null;
  if (nextStatus) orderPatch["status"] = nextStatus;

  if (order && !isLocked && Object.keys(orderPatch).length > 0) {
    await db.from("orders").update(orderPatch).eq("id", orderId);
  }

  // Every courier event is written to the timeline — even when the order status
  // stays put — so the whole journey is visible, not just the final state.
  if (order && !isLocked) {
    await db.from("order_status_history").insert({
      order_id: orderId,
      status: nextStatus ?? order.status,
      note: `${provider} ${mapped.label} (${args.source})${nextStatus ? "" : " · status unchanged"}${
        args.bypassFinalLock && nextStatus ? " (Admin Override)" : ""
      }`,
    });
  }

  return {
    matched: true as const,
    orderId,
    shipmentId: shipment?.id ?? null,
    mapped,
    orderStatus: nextStatus,
  };
}


/**
 * Turns anything thrown inside a booking handler into a readable message.
 * Thrown Response objects carry the real reason in their body, which the
 * client never sees — so we read it here and return it as data instead.
 */
export async function bookingErrorText(e: unknown): Promise<string> {
  if (e instanceof Response) {
    try {
      const text = await e.clone().text();
      return text?.trim() || `Request failed (${e.status})`;
    } catch {
      return `Request failed (${e.status})`;
    }
  }
  const msg = (e as { message?: string } | null)?.message;
  return msg || String(e ?? "Unknown error");
}
