/**
 * External (courier website) tracking links.
 * Steadfast : https://steadfast.com.bd/t/<tracking_code>
 * Pathao    : https://merchant.pathao.com/tracking?consignment_id=<id>&phone=<customer phone>
 * Carrybee  : https://merchant.carrybee.com/order-track/<id>
 */
export function courierTrackingUrl(
  provider: string | null | undefined,
  shipment: { tracking_id?: string | null; consignment_id?: string | null } | null | undefined,
  customerPhone?: string | null,
): string | null {
  if (!provider || !shipment) return null;
  const tracking = (shipment.tracking_id || "").toString().trim();
  const consignment = (shipment.consignment_id || "").toString().trim();
  const any = tracking || consignment;
  if (!any) return null;

  switch (provider) {
    case "steadfast":
      return `https://steadfast.com.bd/t/${encodeURIComponent(tracking || consignment)}`;
    case "pathao": {
      const id = consignment || tracking;
      const phone = (customerPhone || "").replace(/[^0-9]/g, "");
      const qs = new URLSearchParams({ consignment_id: id });
      if (phone) qs.set("phone", phone);
      return `https://merchant.pathao.com/tracking?${qs.toString()}`;
    }
    case "carrybee": {
      const id = consignment || tracking;
      return `https://merchant.carrybee.com/tracking?consignment_id=${encodeURIComponent(id)}`;
    }
    default:
      return null;
  }
}
