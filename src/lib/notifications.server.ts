// Server-only helpers for notification server functions.
export type NotifCfg = {
  id: string;
  channel: string;
  provider: string;
  is_active: boolean;
  config: Record<string, string>;
  from_name: string | null;
  from_value: string | null;
};

export async function pickConfig(
  supabase: any,
  resellerId: string | null,
  channel: "sms" | "email",
): Promise<NotifCfg | null> {
  if (resellerId) {
    const { data } = await supabase.from("notification_configs").select("*")
      .eq("reseller_id", resellerId).eq("channel", channel).eq("is_active", true).maybeSingle();
    if (data) return data as NotifCfg;
  }
  const { data } = await supabase.from("notification_configs").select("*")
    .is("reseller_id", null).eq("channel", channel).eq("is_active", true).maybeSingle();
  return (data as NotifCfg) ?? null;
}

export async function sendSms(
  cfg: NotifCfg,
  to: string,
  message: string,
): Promise<{ ok: boolean; error?: string; raw?: unknown }> {
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

export async function sendEmail(
  cfg: NotifCfg,
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string; raw?: unknown }> {
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
