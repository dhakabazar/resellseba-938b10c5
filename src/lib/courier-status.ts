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
  | "delivered"
  | "pending_return"
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
  partial_delivered: { ship: "delivered", order: "delivered", label: "Partial delivered" },
  // courier side return — order waits in Pending Return until admin receives it
  cancelled: { ship: "returned", order: "pending_return", label: "Cancelled / returning" },
  return_requested: { ship: "in_transit", order: "pending_return", label: "Return requested" },
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
  "partial-delivery": { ship: "delivered", order: "delivered", label: "Partial delivery" },
  "delivery-failed": { ship: "in_transit", order: "pending_return", label: "Delivery failed" },
  returned: { ship: "returned", order: "pending_return", label: "Returned (courier)" },
  "paid-return": { ship: "returned", order: "pending_return", label: "Paid return" },
  exchange: { ship: "in_transit", order: "shipped", label: "Exchange" },
  paid: { ship: "delivered", order: "delivered", label: "Paid / invoiced" },
  "returned-at-sorting": { ship: "returned", order: "pending_return", label: "Returned at sorting" },
  "returned-in-transit": { ship: "returned", order: "pending_return", label: "Return in transit" },
  "returned-to-merchant": { ship: "returned", order: "pending_return", label: "Returned to merchant" },
};

export function normalizeCourierStatus(provider: string | null | undefined, raw: string | null | undefined) {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (provider === "carrybee") return key.replace(/^order\./, "");
  return key;
}

export function mapCourierStatus(
  provider: string | null | undefined,
  raw: string | null | undefined,
): StatusMapping {
  const key = normalizeCourierStatus(provider, raw);
  const table = provider === "carrybee" ? CARRYBEE_STATUS_MAP : STEADFAST_STATUS_MAP;
  return (
    table[key] ?? {
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
    (provider === "carrybee" ? CARRYBEE_STATUS_MAP : STEADFAST_STATUS_MAP)[key]?.label ??
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
  | "delivered"
  | "pending_return"
  | "returned"
  | "cancelled";

export const ORDER_TABS: { key: OrderTabKey; label: string; statuses: OrderStatus[] }[] = [
  { key: "all", label: "All Orders", statuses: [] },
  { key: "new", label: "New Order", statuses: ["draft", "pending"] },
  { key: "confirmed", label: "Confirmed", statuses: ["confirmed", "forwarded"] },
  { key: "rts", label: "RTS Order", statuses: ["ready_to_ship"] },
  { key: "courier", label: "To Courier", statuses: ["processing", "shipped"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "pending_return", label: "Pending Return", statuses: ["pending_return"] },
  { key: "returned", label: "Returned", statuses: ["returned"] },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
];

export const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  "pending",
  "confirmed",
  "forwarded",
  "ready_to_ship",
  "processing",
  "shipped",
  "delivered",
  "pending_return",
  "returned",
  "cancelled",
];

export function orderStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export function orderStatusTone(status: string) {
  if (status === "delivered") return "bg-success/15 text-success";
  if (status === "returned" || status === "cancelled") return "bg-destructive/15 text-destructive";
  if (status === "pending_return") return "bg-amber-500/15 text-amber-600";
  if (status === "shipped" || status === "processing") return "bg-blue-500/15 text-blue-600";
  return "bg-primary/15 text-primary";
}
