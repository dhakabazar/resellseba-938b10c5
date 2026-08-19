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

type StatusMapping = { ship: ShipmentStatus; order: OrderStatus; label: string };

/** Steadfast delivery statuses (API v1). */
export const STEADFAST_STATUS_MAP: Record<string, StatusMapping> = {
  in_review: { ship: "booked", order: "shipped", label: "In review" },
  pending: { ship: "in_transit", order: "shipped", label: "Pending / on the way" },
  hold: { ship: "in_transit", order: "shipped", label: "On hold" },
  delivered_approval_pending: { ship: "in_transit", order: "shipped", label: "Delivered (approval pending)" },
  partial_delivered_approval_pending: {
    ship: "in_transit",
    order: "shipped",
    label: "Partial delivered (approval pending)",
  },
  cancelled_approval_pending: { ship: "in_transit", order: "pending_return", label: "Cancelled (approval pending)" },
  unknown_approval_pending: { ship: "in_transit", order: "shipped", label: "Unknown (approval pending)" },
  delivered: { ship: "delivered", order: "delivered", label: "Delivered" },
  partial_delivered: { ship: "delivered", order: "pending_partial", label: "Partial delivered" },
  // courier side return — order waits in Pending Return until admin receives it
  cancelled: { ship: "returned", order: "pending_return", label: "Cancelled / returning" },
  return_requested: { ship: "returned", order: "pending_return", label: "Return requested" },
  unknown: { ship: "in_transit", order: "shipped", label: "Unknown" },
};

/** Carrybee webhook events (`order.*`), keyed without the `order.` prefix. */
export const CARRYBEE_STATUS_MAP: Record<string, StatusMapping> = {
  created: { ship: "booked", order: "shipped", label: "Order created" },
  "create-failed": { ship: "failed", order: "ready_to_ship", label: "Create failed" },
  updated: { ship: "booked", order: "shipped", label: "Order updated" },
  "pickup-requested": { ship: "booked", order: "shipped", label: "Pickup requested" },
  "assigned-for-pickup": { ship: "booked", order: "shipped", label: "Assigned for pickup" },
  picked: { ship: "in_transit", order: "shipped", label: "Picked" },
  "pickup-failed": { ship: "booked", order: "shipped", label: "Pickup failed" },
  "pickup-cancelled": { ship: "cancelled", order: "ready_to_ship", label: "Pickup cancelled" },
  "at-the-sorting-hub": { ship: "in_transit", order: "shipped", label: "At sorting hub" },
  "on-the-way-to-central-warehouse": { ship: "in_transit", order: "shipped", label: "On the way to central warehouse" },
  "at-central-warehouse": { ship: "in_transit", order: "shipped", label: "At central warehouse" },
  "in-transit": { ship: "in_transit", order: "shipped", label: "In transit" },
  "received-at-last-mile-hub": { ship: "in_transit", order: "shipped", label: "Received at last mile hub" },
  "assigned-for-delivery": { ship: "in_transit", order: "shipped", label: "Assigned for delivery" },
  "delivery-on-hold": { ship: "in_transit", order: "shipped", label: "Delivery on hold" },
  delivered: { ship: "delivered", order: "delivered", label: "Delivered" },
  "partial-delivery": { ship: "delivered", order: "pending_partial", label: "Partial delivered" },
  "delivery-failed": { ship: "in_transit", order: "pending_return", label: "Delivery failed" },
  returned: { ship: "returned", order: "pending_return", label: "Returned (courier)" },
  "paid-return": { ship: "returned", order: "pending_return", label: "Paid return" },
  exchange: { ship: "in_transit", order: "shipped", label: "Exchange" },
  paid: { ship: "delivered", order: "delivered", label: "Paid / invoiced" },
  "returned-at-sorting": { ship: "returned", order: "pending_return", label: "Returned at sorting" },
  "returned-in-transit": { ship: "returned", order: "pending_return", label: "Return in transit" },
  "returned-to-merchant": { ship: "returned", order: "pending_return", label: "Returned to merchant" },
};

/**
 * Pathao webhook events (`order.*` / `store.*`) and API `order_status_slug`
 * values, keyed without the prefix and with `_`/spaces normalized to `-`.
 */
export const PATHAO_STATUS_MAP: Record<string, StatusMapping> = {
  created: { ship: "booked", order: "shipped", label: "Order created" },
  pending: { ship: "booked", order: "shipped", label: "Pending" },
  updated: { ship: "booked", order: "shipped", label: "Order updated" },
  "pickup-requested": { ship: "booked", order: "shipped", label: "Pickup requested" },
  "assigned-for-pickup": { ship: "booked", order: "shipped", label: "Assigned for pickup" },
  picked: { ship: "in_transit", order: "shipped", label: "Picked" },
  "pickup-failed": { ship: "booked", order: "shipped", label: "Pickup failed" },
  "pickup-cancelled": { ship: "cancelled", order: "ready_to_ship", label: "Pickup cancelled" },
  "at-the-sorting-hub": { ship: "in_transit", order: "shipped", label: "At sorting hub" },
  "at-sorting-hub": { ship: "in_transit", order: "shipped", label: "At sorting hub" },
  "in-transit": { ship: "in_transit", order: "shipped", label: "In transit" },
  "received-at-last-mile-hub": { ship: "in_transit", order: "shipped", label: "Received at last mile hub" },
  "assigned-for-delivery": { ship: "in_transit", order: "shipped", label: "Assigned for delivery" },
  delivered: { ship: "delivered", order: "delivered", label: "Delivered" },
  "partial-delivery": { ship: "delivered", order: "pending_partial", label: "Partial delivered" },
  "delivery-failed": { ship: "in_transit", order: "pending_return", label: "Delivery failed" },
  "on-hold": { ship: "in_transit", order: "shipped", label: "On hold" },
  paid: { ship: "delivered", order: "delivered", label: "Paid / invoiced" },
  exchanged: { ship: "in_transit", order: "shipped", label: "Exchanged" },
  exchange: { ship: "in_transit", order: "shipped", label: "Exchange" },
  // courier-side return family — order waits in Pending Return until admin receives it
  returned: { ship: "returned", order: "pending_return", label: "Returned (courier)" },
  return: { ship: "returned", order: "pending_return", label: "Returned (courier)" },
  "paid-return": { ship: "returned", order: "pending_return", label: "Paid return" },
  "return-id-created": { ship: "returned", order: "pending_return", label: "Return id created" },
  "return-in-transit": { ship: "returned", order: "pending_return", label: "Return in transit" },
  "returned-to-merchant": { ship: "returned", order: "pending_return", label: "Returned to merchant" },
};

export function normalizeCourierStatus(provider: string | null | undefined, raw: string | null | undefined) {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (provider === "carrybee") return key.replace(/^order\./, "");
  if (provider === "pathao")
    return key
      .replace(/^(order|store)\./, "")
      .replace(/[\s_]+/g, "-");
  return key;
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
      order: "shipped" as OrderStatus,
      label: key ? key.replace(/[-_]/g, " ") : "unknown",
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
    key.replace(/[-_]/g, " ")
  );
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
  { key: "partial_full", label: "Partial (Full item)", statuses: ["partial_full", "partial"] },
  { key: "partial_item", label: "Partial (Item)", statuses: ["partial_item"] },
  { key: "partial_delivery", label: "Partial (Delivery Charge)", statuses: ["partial_delivery"] },
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

/** Statuses that need admin settlement input (amount / returned items). */
export const SETTLEMENT_STATUSES: OrderStatus[] = [
  "delivered",
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
  partial: "Partial (Full item)",
  partial_full: "Partial (Full item)",
  partial_item: "Partial (Item)",
  partial_delivery: "Partial (Delivery Charge)",
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

/** Tailwind classes for a tab in its group. */
export function orderTabClasses(key: OrderTabKey, active: boolean) {
  const group = orderTabGroup(key);
  if (active) {
    if (group === "delivered") return "bg-emerald-600 text-white border-emerald-600 shadow-sm";
    if (group === "partial") return "bg-amber-500 text-white border-amber-500 shadow-sm";
    if (group === "terminal") return "bg-rose-600 text-white border-rose-600 shadow-sm";
    return "bg-primary text-primary-foreground border-primary shadow-sm";
  }
  if (group === "delivered") return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
  if (group === "partial") return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100";
  if (group === "terminal") return "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100";
  return "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
}
