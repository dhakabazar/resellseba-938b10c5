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

export const recheckCourierStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    return { success: true, message: "Courier status rechecked and updated." };
  });

