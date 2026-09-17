import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOrderDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { orderId } = data;
    const { supabase } = context;
    
    const [orderRes, itemsRes, shipmentsRes, eventsRes] = await Promise.all([
      supabase.from("orders").select("*, resellers(business_name, code, contact_phone, agents(display_name))").eq("id", orderId).maybeSingle(),
      supabase.from("order_items").select("*").eq("order_id", orderId),
      supabase.from("shipments").select("*").eq("order_id", orderId),
      supabase.from("courier_events").select("*").eq("order_id", orderId).order("event_at", { ascending: false })
    ]);


    if (orderRes.error) {
      console.error("[getOrderDetails] Order error:", orderRes.error);
    }

    return {
      order: orderRes.data,
      items: itemsRes.data || [],
      shipments: shipmentsRes.data || [],
      events: eventsRes.data || []
    };
  });

/**
 * Live courier status check for one order. Records every courier step and
 * applies the automatic flow (To Courier → Delivered / Pending Partial /
 * Pending Return) — nothing else moves automatically.
 */
export const recheckCourierStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertAdmin, bookingErrorText } = await import("@/lib/couriers.server");
    const { recheckShipment } = await import("@/lib/courier-recheck.server");
    await assertAdmin(supabase, userId);

    const { data: sh } = await supabase
      .from("shipments")
      .select("id, order_id, provider, consignment_id, tracking_id, orders(order_number)")
      .eq("order_id", data.orderId)
      .order("booked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sh) return { success: false as const, message: "This order is not booked with a courier yet." };

    try {
      const { courierStatus, result } = await recheckShipment(supabase, sh as any);
      const orderStatus = result.matched ? (result.orderStatus ?? null) : null;
      return {
        success: true as const,
        courierStatus,
        orderStatus,
        message: orderStatus ? "Courier status updated." : "Courier status checked — no status change needed.",
      };
    } catch (e) {
      return { success: false as const, message: await bookingErrorText(e) };
    }
  });


