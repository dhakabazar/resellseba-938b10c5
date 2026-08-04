// Shared, browser-safe courier + order status helpers.

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

/**
 * Steadfast delivery statuses (API docs v1) mapped to our shipment + order status.
 * Approval-pending statuses are treated as "pending" states so nothing is
 * marked final before Steadfast approves it.
 */
export const STEADFAST_STATUS_MAP: Record<
  string,
  { ship: ShipmentStatus; order: OrderStatus; label: string }
> = {
  in_review: { ship: "booked", order: "shipped", label: "In review" },
  pending: { ship: "in_transit", order: "shipped", label: "Pending / on the way" },
  hold: { ship: "in_transit", order: "shipped", label: "On hold" },
  delivered_approval_pending: { ship: "in_transit", order: "shipped", label: "Delivered (approval pending)" },
  partial_delivered_approval_pending: { ship: "in_transit", order: "shipped", label: "Partial delivered (approval pending)" },
  cancelled_approval_pending: { ship: "in_transit", order: "pending_return", label: "Cancelled (approval pending)" },
  unknown_approval_pending: { ship: "in_transit", order: "shipped", label: "Unknown (approval pending)" },
  delivered: { ship: "delivered", order: "delivered", label: "Delivered" },
  partial_delivered: { ship: "delivered", order: "delivered", label: "Partial delivered" },
  cancelled: { ship: "returned", order: "returned", label: "Cancelled / returned" },
  unknown: { ship: "in_transit", order: "shipped", label: "Unknown" },
};

export function mapSteadfastStatus(raw: string | null | undefined) {
  const key = String(raw ?? "").trim().toLowerCase();
  return (
    STEADFAST_STATUS_MAP[key] ?? {
      ship: "in_transit" as ShipmentStatus,
      order: "shipped" as OrderStatus,
      label: key || "unknown",
    }
  );
}

export function courierStatusLabel(raw: string | null | undefined) {
  if (!raw) return "—";
  return STEADFAST_STATUS_MAP[raw.toLowerCase()]?.label ?? raw.replace(/_/g, " ");
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
