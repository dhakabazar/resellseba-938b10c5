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
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const latestShipments = ((shipments ?? []) as any[]).filter((sh) => {
      if (seen.has(sh.order_id)) return false;
      seen.add(sh.order_id);
      return true;
    });
    const configCache = new Map<string, Promise<Record<string, string>>>();

    async function checkOne(sh: any) {

      // Couriers rate-limit / time out on rapid back-to-back calls, which made
      // some orders fail in bulk even though a single check worked. Retry a few
      // times with a growing pause before giving up on an order.
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { courierStatus, result } = await recheckShipment(supabase, sh, configCache);
          results.push({
            orderId: sh.order_id,
            courierStatus,
            orderStatus: result.matched ? (result.orderStatus ?? null) : null,
          });
          lastError = null;
          break;
        } catch (e) {
          lastError = e;
          // Permanent problems (not booked / bad credentials) are not worth retrying.
          const status = e instanceof Response ? e.status : 0;
          if (status === 400 || status === 401 || status === 403) break;
          if (attempt < 2) await sleep(600 * (attempt + 1));
        }
      }
      if (lastError) {
        const { bookingErrorText } = await import("@/lib/couriers.server");
        results.push({ orderId: sh.order_id, error: await bookingErrorText(lastError) });
      }
    }

    // Four workers keep a large selection fast without flooding courier APIs.
    // A slow or failed parcel no longer blocks every order behind it.
    let cursor = 0;
    const workerCount = Math.min(4, latestShipments.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (cursor < latestShipments.length) {
          const index = cursor++;
          const shipment = latestShipments[index];
          if (!shipment) continue;
          await checkOne(shipment);
          await sleep(100);
        }
      }),
    );

    const notBooked = data.orderIds.filter((id) => !seen.has(id));
    return {
      checked: results.filter((r) => !r.error).length,
      failed: results.filter((r) => r.error).length,
      notBooked: notBooked.length,
      updated: results.filter((r) => r.orderStatus).length,
      results,
    };
  });
