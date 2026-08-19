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
  | "confirmed"
  | "rts"
  | "courier"
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

export const ORDER_TABS: { key: OrderTabKey; label: string; statuses: OrderStatus[] }[] = [
  { key: "all", label: "All Orders", statuses: [] },
  { key: "new", label: "New Order", statuses: ["draft", "pending"] },
  { key: "confirmed", label: "Confirmed", statuses: ["confirmed"] },
  { key: "forwarded", label: "Forwarded", statuses: ["forwarded"] },
  { key: "packaging", label: "Packaging", statuses: ["packaging"] },
  { key: "rts", label: "RTS Order", statuses: ["ready_to_ship"] },
  { key: "processing", label: "Processing", statuses: ["processing"] },
  { key: "courier", label: "To Courier", statuses: ["shipped"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "pending_partial", label: "Pending Partial", statuses: ["pending_partial"] },
  { key: "partial_full", label: "Partial (Full item)", statuses: ["partial_full"] },
  { key: "partial_item", label: "Partial (Item)", statuses: ["partial_item"] },
  { key: "partial_delivery", label: "Partial (Delivery)", statuses: ["partial_delivery"] },
  { key: "pending_return", label: "Pending Return", statuses: ["pending_return"] },
  { key: "returned", label: "Returned", statuses: ["returned"] },
  { key: "damaged", label: "Damaged", statuses: ["damaged"] },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
];

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

/**
 * Allowed next statuses.
 *  · reseller: only `pending` → "send to admin" (forwarded) or cancel
 *  · admin/staff: full flow, but the settlement statuses go through the settle modal
 */
export function nextStatuses(current: string, role: "reseller" | "admin"): OrderStatus[] {
  if (role === "reseller") {
    return current === "pending" || current === "draft" ? ["forwarded", "cancelled"] : [];
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

const STATUS_LABELS: Record<string, string> = {
  forwarded: "Send to admin",
  pending_partial: "Pending partial",
  partial: "Partial delivery",
  partial_full: "Partial delivery (full item)",
  partial_item: "Partial delivery (item partial)",
  partial_delivery: "Partial (delivery charge only)",
  pending_return: "Pending return",
  returned: "Return received",
  damaged: "Damaged / missing",
  ready_to_ship: "Ready to ship",
  shipped: "To courier",
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
