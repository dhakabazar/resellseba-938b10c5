import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type NotifCfg = {
  id: string;
  channel: string;
  provider: string;
  is_active: boolean;
  config: Record<string, string>;
  from_name: string | null;
  from_value: string | null;
};

async function pickConfig(supabase: any, resellerId: string | null, channel: "sms" | "email"): Promise<NotifCfg | null> {
  if (resellerId) {
    const { data } = await supabase.from("notification_configs").select("*")
      .eq("reseller_id", resellerId).eq("channel", channel).eq("is_active", true).maybeSingle();
    if (data) return data as NotifCfg;
  }
  const { data } = await supabase.from("notification_configs").select("*")
    .is("reseller_id", null).eq("channel", channel).eq("is_active", true).maybeSingle();
  return (data as NotifCfg) ?? null;
}

async function sendSms(cfg: NotifCfg, to: string, message: string): Promise<{ ok: boolean; error?: string; raw?: unknown }> {
  const c = cfg.config || {};
  try {
    if (cfg.provider === "bulksmsbd") {
      const url = "http://bulksmsbd.net/api/smsapi";
      const params = new URLSearchParams({
        api_key: c.api_key || "",
        type: "text",
        number: to,
        senderid: c.sender_id || cfg.from_value || "",
        message,
      });
      const res = await fetch(`${url}?${params.toString()}`);
      const text = await res.text();
      return { ok: res.ok, raw: text };
    }
    if (cfg.provider === "sslsms") {
      const res = await fetch("https://smsplus.sslwireless.com/api/v3/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_token: c.api_token,
          sid: c.sid,
          msisdn: to,
          sms: message,
          csms_id: `msg_${Date.now()}`,
        }),
      });
      const j = await res.json();
      return { ok: res.ok, raw: j };
    }
    return { ok: false, error: `Unsupported provider: ${cfg.provider}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function sendEmail(cfg: NotifCfg, to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string; raw?: unknown }> {
  const c = cfg.config || {};
  try {
    if (cfg.provider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.api_key || ""}` },
        body: JSON.stringify({
          from: `${cfg.from_name || "Store"} <${cfg.from_value || "onboarding@resend.dev"}>`,
          to: [to], subject, html,
        }),
      });
      const j = await res.json();
      return { ok: res.ok, raw: j };
    }
    return { ok: false, error: `Unsupported provider: ${cfg.provider}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

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
