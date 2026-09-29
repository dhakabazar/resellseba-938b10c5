// Shared, browser-safe courier + order status helpers.
// Rule for every provider (Steadfast, Carrybee, Pathao):
//  - courier events NEVER auto-finalize an order as "returned" or "cancelled".
//  - all courier-side return states land on "pending_return".
//  - final "returned" happens manually when admin receives the parcel back.

export type ShipmentStatus =
  | "pending"
  | "booked"
  | "in_transit"
  | "delivered"
  | "returned"
  | "failed"
  | "cancelled";

export type OrderStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "forwarded"
  | "ready_to_ship"
  | "processing"
  | "shipped"
  | "packaging"
  | "delivered"
  | "partial"
  | "pending_partial"
  | "partial_full"
  | "partial_item"
  | "partial_delivery"
  | "pending_return"
  | "damaged"
  | "returned"
  | "cancelled";

export type CourierProvider = "steadfast" | "pathao" | "carrybee" | "manual";

/**
 * `order: null` means the courier event is recorded but the order status is NOT
 * touched — only the four courier-driven states below ever move an order:
 *   To Courier · Delivered · Pending Partial · Pending Return
 * `rider: true` marks the rider-assignment phase (Rider Followup menu).
 */
type StatusMapping = {
  ship: ShipmentStatus;
  order: OrderStatus | null;
  label: string;
  rider?: boolean;
};

/** Steadfast delivery statuses (API v1). */
export const STEADFAST_STATUS_MAP: Record<string, StatusMapping> = {
  // Booking-only phase: the parcel is still with the merchant, so the order
  // status is never touched (same rule as Carrybee/Pathao "created/pending").
  "in-review": { ship: "booked", order: null, label: "In review" },
  pending: { ship: "booked", order: null, label: "Pending (booked, not picked)" },
  "pickup-pending": { ship: "booked", order: null, label: "Pickup pending" },
  "pickup-requested": { ship: "booked", order: null, label: "Pickup requested" },
  // Parcel actually moving with the courier -> To Courier
  picked: { ship: "in_transit", order: "shipped", label: "Picked" },
  "picked-up": { ship: "in_transit", order: "shipped", label: "Picked" },
  "in-transit": { ship: "in_transit", order: "shipped", label: "In transit" },
  "on-the-way": { ship: "in_transit", order: "shipped", label: "On the way" },
  "at-sorting-hub": { ship: "in_transit", order: "shipped", label: "At sorting hub" },
  hold: { ship: "in_transit", order: null, label: "On hold" },
  "delivered-approval-pending": { ship: "in_transit", order: null, label: "Delivered (approval pending)" },
  "partial-delivered-approval-pending": {
    ship: "in_transit",
    order: null,
    label: "Partial delivered (approval pending)",
  },
  "cancelled-approval-pending": { ship: "in_transit", order: null, label: "Cancelled (approval pending)" },
  "unknown-approval-pending": { ship: "in_transit", order: null, label: "Unknown (approval pending)" },
  "assigned-for-delivery": { ship: "in_transit", order: "shipped", label: "Assigned For Delivery", rider: true },
  "assigned-to-rider": { ship: "in_transit", order: "shipped", label: "Assigned to rider", rider: true },
  "ready-for-delivery": { ship: "in_transit", order: "shipped", label: "Ready For Delivery", rider: true },
  delivered: { ship: "delivered", order: "delivered", label: "Delivered" },
  // money changed but the parcel is not coming back -> Pending Partial
  "partial-delivered": { ship: "delivered", order: "pending_partial", label: "Partial delivered" },
  "paid-return": { ship: "in_transit", order: "pending_partial", label: "Paid return" },
  // courier side return — order waits in Pending Return until admin receives it
  cancelled: { ship: "returned", order: "pending_return", label: "Cancelled / returning" },
  "return-requested": { ship: "returned", order: "pending_return", label: "Return requested" },
  returned: { ship: "returned", order: "pending_return", label: "Returned (courier)" },
  unknown: { ship: "in_transit", order: null, label: "Unknown" },
};

/** Carrybee webhook events (`order.*`), keyed without the `order.` prefix. */
export const CARRYBEE_STATUS_MAP: Record<string, StatusMapping> = {
  created: { ship: "booked", order: null, label: "Order created" },
  "create-failed": { ship: "failed", order: null, label: "Create failed" },
  updated: { ship: "booked", order: null, label: "Order updated" },
  "pickup-requested": { ship: "booked", order: null, label: "Pickup requested" },
  "assigned-for-pickup": { ship: "booked", order: null, label: "Assigned for pickup" },
  picked: { ship: "in_transit", order: "shipped", label: "Picked" },
  sorted: { ship: "in_transit", order: "shipped", label: "Sorted" },
  "pickup-failed": { ship: "booked", order: null, label: "Pickup failed" },
  "pickup-cancelled": { ship: "cancelled", order: null, label: "Pickup cancelled" },
  "at-the-sorting-hub": { ship: "in_transit", order: "shipped", label: "At sorting hub" },
  "on-the-way-to-central-warehouse": { ship: "in_transit", order: "shipped", label: "On the way to central warehouse" },
  "at-central-warehouse": { ship: "in_transit", order: "shipped", label: "At central warehouse" },
  "in-transit": { ship: "in_transit", order: "shipped", label: "In Transit" },
  "received-at-last-mile-hub": { ship: "in_transit", order: "shipped", label: "Received at last mile hub" },
  "assigned-for-delivery": { ship: "in_transit", order: "shipped", label: "Assigned For Delivery", rider: true },
  "assigned-to-rider": { ship: "in_transit", order: "shipped", label: "Assigned to rider", rider: true },
  "ready-for-delivery": { ship: "in_transit", order: "shipped", label: "Ready For Delivery", rider: true },
  "delivery-on-hold": { ship: "in_transit", order: null, label: "Delivery on hold" },
  delivered: { ship: "delivered", order: "delivered", label: "Delivered" },
  "partial-delivery": { ship: "delivered", order: "pending_partial", label: "Partial delivered" },
  "paid-return": { ship: "in_transit", order: "pending_partial", label: "Paid Return" },
  "delivery-failed": { ship: "in_transit", order: null, label: "Delivery failed" },
  returned: { ship: "returned", order: "pending_return", label: "Return" },
  exchange: { ship: "in_transit", order: null, label: "Exchange" },
  paid: { ship: "delivered", order: null, label: "Paid / invoiced" },
  "returned-at-sorting": { ship: "returned", order: "pending_return", label: "Returned at sorting" },
  "returned-in-transit": { ship: "returned", order: "pending_return", label: "Return in transit" },
  "returned-to-merchant": { ship: "returned", order: "pending_return", label: "Returned to merchant" },
};

/**
 * Pathao webhook events (`order.*` / `store.*`) and API `order_status_slug`
 * values, keyed without the prefix and with `_`/spaces normalized to `-`.
 */
export const PATHAO_STATUS_MAP: Record<string, StatusMapping> = {
  created: { ship: "booked", order: null, label: "Order created" },
  pending: { ship: "booked", order: null, label: "Pending" },
  updated: { ship: "booked", order: null, label: "Order updated" },
  "pickup-requested": { ship: "booked", order: null, label: "Pickup requested" },
  "assigned-for-pickup": { ship: "booked", order: null, label: "Assigned for pickup" },
  picked: { ship: "in_transit", order: "shipped", label: "Picked" },
  "pickup-failed": { ship: "booked", order: null, label: "Pickup failed" },
  "pickup-cancelled": { ship: "cancelled", order: null, label: "Pickup cancelled" },
  "at-the-sorting-hub": { ship: "in_transit", order: "shipped", label: "At sorting hub" },
  "at-sorting-hub": { ship: "in_transit", order: "shipped", label: "At sorting hub" },
  "in-transit": { ship: "in_transit", order: "shipped", label: "In-Transit" },
  "received-at-last-mile-hub": { ship: "in_transit", order: "shipped", label: "Received at last mile hub" },
  "assigned-for-delivery": { ship: "in_transit", order: "shipped", label: "Assigned For Delivery", rider: true },
  "assigned-to-rider": { ship: "in_transit", order: "shipped", label: "Assigned to rider", rider: true },
  "ready-for-delivery": { ship: "in_transit", order: "shipped", label: "Ready For Delivery", rider: true },
  "delivery-man-assigned": { ship: "in_transit", order: "shipped", label: "Assigned to rider", rider: true },
  delivered: { ship: "delivered", order: "delivered", label: "Delivered" },
  "partial-delivery": { ship: "delivered", order: "pending_partial", label: "Partial delivered" },
  "paid-return": { ship: "in_transit", order: "pending_partial", label: "Paid Return" },
  "delivery-failed": { ship: "in_transit", order: null, label: "Delivery failed" },
  "on-hold": { ship: "in_transit", order: null, label: "On hold" },
  paid: { ship: "delivered", order: null, label: "Paid / invoiced" },
  exchanged: { ship: "in_transit", order: null, label: "Exchanged" },
  exchange: { ship: "in_transit", order: null, label: "Exchange" },
  // courier-side return family — order waits in Pending Return until admin receives it
  returned: { ship: "returned", order: "pending_return", label: "Return" },
  return: { ship: "returned", order: "pending_return", label: "Return" },
  "return-initiated": { ship: "returned", order: "pending_return", label: "Return initiated" },
  "return-id-created": { ship: "returned", order: "pending_return", label: "Return id created" },
  "return-in-transit": { ship: "returned", order: "pending_return", label: "Return in transit" },
  "returned-to-merchant": { ship: "returned", order: "pending_return", label: "Returned to merchant" },
};

/**
 * Provider statuses arrive in every shape: `order.paid-return`, `Paid Return`,
 * `partial_delivered`. Everything is lowercased and reduced to dashes so one
 * key matches them all.
 */
export function normalizeCourierStatus(provider: string | null | undefined, raw: string | null | undefined) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^(order|store|shipment)\./, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

function statusTable(provider: string | null | undefined) {
  if (provider === "carrybee") return CARRYBEE_STATUS_MAP;
  if (provider === "pathao") return PATHAO_STATUS_MAP;
  return STEADFAST_STATUS_MAP;
}

export function mapCourierStatus(
  provider: string | null | undefined,
  raw: string | null | undefined,
): StatusMapping {
  const key = normalizeCourierStatus(provider, raw);
  return (
    statusTable(provider)[key] ?? {
      ship: "in_transit" as ShipmentStatus,
      order: null,
      label: key ? key.replace(/-/g, " ") : "unknown",
    }
  );
}

/** Back-compat helper (Steadfast). */
export function mapSteadfastStatus(raw: string | null | undefined) {
  return mapCourierStatus("steadfast", raw);
}

export function courierStatusLabel(raw: string | null | undefined, provider?: string | null) {
  if (!raw) return "—";
  const key = normalizeCourierStatus(provider, raw);
  return (
    statusTable(provider)[key]?.label ??
    PATHAO_STATUS_MAP[key]?.label ??
    CARRYBEE_STATUS_MAP[key]?.label ??
    STEADFAST_STATUS_MAP[key]?.label ??
    key.replace(/-/g, " ")
  );
}

/**
 * Automatic status flow guard.
 * Once a parcel is booked with a courier, the order does not need to sit in
 * Courier Handover for the courier events to move it. Any pre-delivery status
 * (new / send to admin / confirmed / packaging / handover / to courier) can
 * jump straight to To Courier · Delivered · Pending Partial · Pending Return —
 * so a skipped middle step never leaves the order stuck.
 * Settled states (partial family, returned, damaged, cancelled) stay manual.
 */
const AUTO_FROM_STATUSES: string[] = [
  "draft",
  "pending",
  "forwarded",
  "confirmed",
  "packaging",
  "ready_to_ship",
  "processing",
  "shipped",
  "pending_return",
  "pending_partial",
];

export function canAutoApplyStatus(current: string, target: OrderStatus | null): boolean {
  if (!target) return false;
  if (current === target) return false;
  if (!AUTO_FROM_STATUSES.includes(current)) return false;
  // Pending Partial / Pending Return are already courier end-states — they only
  // move on to a real delivery/partial result, never back to To Courier.
  if ((current === "pending_partial" || current === "pending_return") && target === "shipped") return false;
  return ["shipped", "delivered", "pending_partial", "pending_return"].includes(target);
}


/** Rider-assignment phase (Rider Followup). */
export function isRiderCourierStatus(provider: string | null | undefined, raw: string | null | undefined) {
  return mapCourierStatus(provider, raw).rider === true;
}


export type OrderTabKey =
  | "all"
  | "new"
  | "forwarded"
  | "confirmed"
  | "packaging"
  | "handover"
  | "courier"
  | "delivered"
  | "pending_partial"
  | "partial_full"
  | "partial_item"
  | "partial_delivery"
  | "pending_return"
  | "returned"
  | "damaged"
  | "cancelled";

/** Single source of truth for the order flow — tabs, modals and report filters. */
export const ORDER_TABS: { key: OrderTabKey; label: string; statuses: OrderStatus[] }[] = [
  { key: "all", label: "All Orders", statuses: [] },
  { key: "new", label: "New Order", statuses: ["draft", "pending"] },
  { key: "forwarded", label: "Send To admin", statuses: ["forwarded"] },
  { key: "confirmed", label: "Confirmed", statuses: ["confirmed"] },
  { key: "packaging", label: "Packaging", statuses: ["packaging"] },
  { key: "handover", label: "Courier Handover", statuses: ["ready_to_ship"] },
  { key: "courier", label: "To Courier", statuses: ["shipped", "processing"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "pending_partial", label: "Pending Partial", statuses: ["pending_partial"] },
  { key: "partial_full", label: "Partial (Full Received)", statuses: ["partial_full", "partial"] },
  { key: "partial_item", label: "Partial (Item Received)", statuses: ["partial_item"] },
  { key: "partial_delivery", label: "Partial (Delivery Charge Only)", statuses: ["partial_delivery"] },
  { key: "pending_return", label: "Pending Return", statuses: ["pending_return"] },
  { key: "returned", label: "Returned", statuses: ["returned"] },
  { key: "damaged", label: "Damaged", statuses: ["damaged"] },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
];

/** Flow order for status pickers — mirrors ORDER_TABS exactly. */
export const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  "pending",
  "forwarded",
  "confirmed",
  "packaging",
  "ready_to_ship",
  "shipped",
  "delivered",
  "pending_partial",
  "partial_full",
  "partial_item",
  "partial_delivery",
  "pending_return",
  "returned",
  "damaged",
  "cancelled",
];

/**
 * Partial family — every partial status is settled one order at a time
 * (amount / kept items differ per order), so bulk status change is blocked.
 */
export const PARTIAL_STATUSES: OrderStatus[] = [
  "pending_partial",
  "partial",
  "partial_full",
  "partial_item",
  "partial_delivery",
];

export function isPartialStatus(status: string): boolean {
  return (PARTIAL_STATUSES as string[]).includes(status);
}

/**
 * Statuses that need admin settlement input (amount / returned items).
 * "delivered" is intentionally excluded: a full delivery means nothing changed,
 * so the full order total is collected and no settlement popup is needed.
 */
export const SETTLEMENT_STATUSES: OrderStatus[] = [
  "partial_full",
  "partial_item",
  "partial_delivery",
  "returned",
  "damaged",
];

/** Courier already has the parcel — reseller can no longer touch the order. */
export const RESELLER_LOCKED_STATUSES: OrderStatus[] = [
  "confirmed",
  "packaging",
  "ready_to_ship",
  "processing",
  "shipped",
  "delivered",
  "pending_partial",
  "partial",
  "partial_full",
  "partial_item",
  "partial_delivery",
  "pending_return",
  "returned",
  "damaged",
];

/** Reseller can edit / delete / change status only while the order sits in these states. */
export const RESELLER_ACTION_STATUSES: OrderStatus[] = ["draft", "pending", "forwarded", "cancelled"];

export function resellerCanAct(status: string): boolean {
  return (RESELLER_ACTION_STATUSES as string[]).includes(status);
}

/**
 * Allowed next statuses.
 *  · reseller: pending ↔ send to admin ↔ cancelled only
 *  · admin/staff: full flow, but the settlement statuses go through the settle modal
 */
export function nextStatuses(current: string, role: "reseller" | "admin"): OrderStatus[] {
  if (role === "reseller") {
    switch (current) {
      case "draft":
      case "pending":
        return ["forwarded", "cancelled"];
      case "forwarded":
        return ["pending", "cancelled"];
      case "cancelled":
        return ["pending", "forwarded"];
      default:
        return [];
    }
  }
  switch (current) {
    case "draft":
    case "pending":
      return ["forwarded", "confirmed", "cancelled"];
    case "forwarded":
      return ["confirmed", "cancelled"];
    case "confirmed":
      return ["packaging", "ready_to_ship", "cancelled"];
    case "packaging":
      return ["ready_to_ship", "cancelled"];
    case "ready_to_ship":
      return ["shipped", "cancelled"];
    case "processing":
    case "shipped":
      return ["delivered", "pending_partial", "pending_return"];
    case "pending_partial":
      return ["partial_full", "partial_item", "partial_delivery", "damaged"];
    case "pending_return":
      return ["returned", "damaged"];
    case "delivered":
    case "partial":
    case "partial_full":
    case "partial_item":
    case "partial_delivery":
    case "returned":
      return ["damaged"];
    default:
      return [];
  }
}

/** Labels match the ORDER_TABS flow wording everywhere (lists, modals, reports). */
const STATUS_LABELS: Record<string, string> = {
  draft: "New Order",
  pending: "New Order",
  forwarded: "Send To admin",
  confirmed: "Confirmed",
  packaging: "Packaging",
  ready_to_ship: "Courier Handover",
  processing: "To Courier",
  shipped: "To Courier",
  delivered: "Delivered",
  pending_partial: "Pending Partial",
  partial: "Partial (Full Received)",
  partial_full: "Partial (Full Received)",
  partial_item: "Partial (Item Received)",
  partial_delivery: "Partial (Delivery Charge Only)",
  pending_return: "Pending Return",
  returned: "Returned",
  damaged: "Damaged",
  cancelled: "Cancelled",
};

export function orderStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function orderStatusTone(status: string) {
  if (status === "delivered") return "bg-success/15 text-success";
  if (status === "returned" || status === "cancelled" || status === "damaged")
    return "bg-destructive/15 text-destructive";
  if (status === "partial" || status === "partial_full" || status === "partial_item" || status === "partial_delivery")
    return "bg-emerald-500/15 text-emerald-600";
  if (status === "pending_return" || status === "pending_partial") return "bg-amber-500/15 text-amber-600";
  if (status === "shipped" || status === "processing") return "bg-blue-500/15 text-blue-600";
  if (status === "packaging") return "bg-violet-500/15 text-violet-600";
  return "bg-primary/15 text-primary";
}

export type OrderTabGroup = "processing" | "delivered" | "partial" | "terminal";

/** Visual grouping for order list tabs. */
export function orderTabGroup(key: OrderTabKey): OrderTabGroup {
  switch (key) {
    case "delivered":
      return "delivered";
    case "pending_partial":
    case "partial_full":
    case "partial_item":
    case "partial_delivery":
      return "partial";
    case "pending_return":
    case "returned":
    case "damaged":
    case "cancelled":
      return "terminal";
    default:
      return "processing";
  }
}

/** Tailwind classes for a tab in its group — light tint highlight for active. */
export function orderTabClasses(key: OrderTabKey, active: boolean) {
  const group = orderTabGroup(key);
  if (active) {
    if (group === "delivered") return "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold";
    if (group === "partial") return "bg-amber-100 text-amber-800 border-amber-300 font-semibold";
    if (group === "terminal") return "bg-rose-100 text-rose-800 border-rose-300 font-semibold";
    return "bg-primary/15 text-primary border-primary/30 font-semibold";
  }
  if (group === "delivered") return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
  if (group === "partial") return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100";
  if (group === "terminal") return "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100";
  return "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
}
