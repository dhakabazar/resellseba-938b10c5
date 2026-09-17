import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SHIPMENT_SELECT = "id, order_id, provider, consignment_id, tracking_id, orders(order_number)";

/**
 * Ask the courier for the live status of one or many orders and apply the
 * automatic status flow (To Courier → Delivered / Pending Partial / Pending Return).
 * Used by the single order view and by the bulk "Check courier status" action.
 */
export const recheckOrdersStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderIds: z.array(z.string().uuid()).min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("@/lib/couriers.server");
    const { recheckShipment } = await import("@/lib/courier-recheck.server");
    await assertAdmin(supabase, userId);

    const { data: shipments } = await supabase
      .from("shipments")
      .select(SHIPMENT_SELECT)
      .in("order_id", data.orderIds)
      .order("booked_at", { ascending: false });

    const seen = new Set<string>();
    const results: { orderId: string; courierStatus?: string; orderStatus?: string | null; error?: string }[] = [];

    for (const sh of (shipments ?? []) as any[]) {
      if (seen.has(sh.order_id)) continue;
      seen.add(sh.order_id);
      try {
        const { courierStatus, result } = await recheckShipment(supabase, sh);
        results.push({
          orderId: sh.order_id,
          courierStatus,
          orderStatus: result.matched ? (result.orderStatus ?? null) : null,
        });
      } catch (e) {
        const { bookingErrorText } = await import("@/lib/couriers.server");
        results.push({ orderId: sh.order_id, error: await bookingErrorText(e) });
      }
    }

    const notBooked = data.orderIds.filter((id) => !seen.has(id));
    return {
      checked: results.filter((r) => !r.error).length,
      failed: results.filter((r) => r.error).length,
      notBooked: notBooked.length,
      updated: results.filter((r) => r.orderStatus).length,
      results,
    };
  });
