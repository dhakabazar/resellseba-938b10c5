import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pickConfig, sendSms, sendEmail, type NotifCfg } from "@/lib/notifications.server";

export const notifyOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid(), template: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: order, error } = await supabase.from("orders")
      .select("id, order_number, status, customer_name, customer_phone, customer_email, reseller_id, total, resellers(store_name)")
      .eq("id", data.orderId).maybeSingle();
    if (error || !order) throw new Error("Order not found");

    const storeName = (order as any).resellers?.store_name || "Store";
    const template = data.template || `status_${order.status}`;
    const message = `${storeName}: Order #${order.order_number} status - ${order.status}. Total: ৳${order.total}. Thank you!`;

    const results: Array<{ channel: string; ok: boolean; error?: string }> = [];

    if (order.customer_phone) {
      const cfg = await pickConfig(supabase, order.reseller_id, "sms");
      if (cfg) {
        const r = await sendSms(cfg, order.customer_phone, message);
        await supabase.from("notification_logs").insert({
          reseller_id: order.reseller_id, order_id: order.id, channel: "sms",
          recipient: order.customer_phone, template, status: r.ok ? "sent" : "failed",
          error: r.error || null, payload: (r.raw as any) ?? null,
        });
        results.push({ channel: "sms", ok: r.ok, error: r.error });
      }
    }

    if (order.customer_email) {
      const cfg = await pickConfig(supabase, order.reseller_id, "email");
      if (cfg) {
        const html = `<p>Hi ${order.customer_name || ""},</p><p>${message}</p>`;
        const r = await sendEmail(cfg, order.customer_email, `Order #${order.order_number} - ${order.status}`, html);
        await supabase.from("notification_logs").insert({
          reseller_id: order.reseller_id, order_id: order.id, channel: "email",
          recipient: order.customer_email, template, status: r.ok ? "sent" : "failed",
          error: r.error || null, payload: (r.raw as any) ?? null,
        });
        results.push({ channel: "email", ok: r.ok, error: r.error });
      }
    }

    return { results };
  });

export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    configId: z.string().uuid(),
    to: z.string().min(3),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cfg, error } = await supabase.from("notification_configs").select("*").eq("id", data.configId).maybeSingle();
    if (error || !cfg) throw new Error("Config not found");
    const msg = "Test message from your reseller platform.";
    const r = cfg.channel === "sms"
      ? await sendSms(cfg as NotifCfg, data.to, msg)
      : await sendEmail(cfg as NotifCfg, data.to, "Test", `<p>${msg}</p>`);
    await supabase.from("notification_logs").insert({
      reseller_id: cfg.reseller_id, channel: cfg.channel, recipient: data.to,
      template: "test", status: r.ok ? "sent" : "failed", error: r.error || null, payload: (r.raw as any) ?? null,
    });
    if (!r.ok) throw new Error(r.error || "Send failed");
    return { ok: true };
  });
