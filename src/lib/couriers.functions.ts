import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({ orderId: z.string().uuid() });

export const bookSteadfast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user_id: userId });
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const { data: cfg } = await supabase
      .from("courier_configs")
      .select("config, is_active")
      .eq("provider", "steadfast")
      .maybeSingle();
    if (!cfg || !cfg.is_active) throw new Response("Steadfast not configured", { status: 400 });
    const conf = (cfg.config ?? {}) as { api_key?: string; secret_key?: string; base_url?: string };
    if (!conf.api_key || !conf.secret_key) throw new Response("Missing Steadfast credentials", { status: 400 });

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_phone, address_line, total, payment_method")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order) throw new Response("Order not found", { status: 404 });

    const baseUrl = conf.base_url || "https://portal.packzy.com/api/v1";
    const codAmount = order.payment_method === "cod" ? Number(order.total) : 0;

    const payload = {
      invoice: order.order_number,
      recipient_name: order.customer_name,
      recipient_phone: order.customer_phone,
      recipient_address: order.address_line,
      cod_amount: codAmount,
      note: `Order ${order.order_number}`,
    };

    const res = await fetch(`${baseUrl}/create_order`, {
      method: "POST",
      headers: {
        "Api-Key": conf.api_key,
        "Secret-Key": conf.secret_key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as {
      consignment?: { consignment_id?: string | number; tracking_code?: string; status?: string };
      message?: string;
    };
    if (!res.ok) throw new Response(body.message || "Steadfast booking failed", { status: 502 });

    const trackingId = body.consignment?.tracking_code || String(body.consignment?.consignment_id ?? "");

    await supabase.from("shipments").insert({
      order_id: order.id,
      provider: "steadfast",
      tracking_id: trackingId,
      consignment_id: String(body.consignment?.consignment_id ?? ""),
      status: "booked",
      request_payload: payload,
      response_payload: body,
      booked_at: new Date().toISOString(),
      booked_by: userId,
    });
    await supabase.from("orders").update({ status: "shipped" }).eq("id", order.id);

    return { trackingId, status: body.consignment?.status ?? "in_review" };
  });
