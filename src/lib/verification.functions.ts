import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const registerInput = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
  name: z.string().trim().min(2),
  phone: z.string().trim().min(6),
});

/** Server-side reseller registration respecting admin advanced verification toggles. */
export const registerResellerAccount = createServerFn({ method: "POST" })
  .inputValidator((d) => registerInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { mergeAdvanced } = await import("@/lib/advanced-settings");

    // Fetch platform advanced settings to check verification toggles
    const { data: globalRow } = await supabaseAdmin
      .from("global_settings")
      .select("advanced_settings")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const adv = mergeAdvanced(globalRow?.advanced_settings);
    const requiresVerification = adv.verifyEnabled && (adv.verifyEmail || adv.verifySms);
    const needsEmailCode = adv.verifyEnabled && adv.verifyEmail;
    const needsSmsCode = adv.verifyEnabled && adv.verifySms;

    // Create user in Supabase Auth with email confirmed at the auth provider level
    // so the session can be created and they can log in seamlessly
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.name,
        name: data.name,
        phone: data.phone,
      },
    });

    if (createError) {
      if (
        createError.message.toLowerCase().includes("already registered") ||
        createError.message.toLowerCase().includes("already exists") ||
        createError.message.toLowerCase().includes("unique constraint")
      ) {
        return { ok: false, error: "এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট তৈরি করা আছে। দয়া করে লগইন করুন।" };
      }
      return { ok: false, error: createError.message || "রেজিস্ট্রেশন করা সম্ভব হয়নি।" };
    }

    const userId = created.user?.id;
    if (userId) {
      // If verification is NOT required by admin, mark it verified in profile immediately
      const profileUpdates: Record<string, string | null> = {};
      if (!needsEmailCode) {
        profileUpdates.email_verified_at = new Date().toISOString();
      }
      if (!needsSmsCode) {
        profileUpdates.phone_verified_at = new Date().toISOString();
      }

      if (Object.keys(profileUpdates).length > 0) {
        await supabaseAdmin
          .from("profiles")
          .update(profileUpdates as any)
          .eq("id", userId);
      }
    }

    return {
      ok: true,
      requiresVerification,
      verifyEmail: needsEmailCode,
      verifySms: needsSmsCode,
    };
  });

const unlockInput = z.object({
  email: z.string().trim().email(),
});

/** Auto-unlocks email confirmation for users created before or when verification is off. */
export const unlockUnconfirmedUser = createServerFn({ method: "POST" })
  .inputValidator((d) => unlockInput.parse(d))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { mergeAdvanced } = await import("@/lib/advanced-settings");

      const { data: globalRow } = await supabaseAdmin
        .from("global_settings")
        .select("advanced_settings")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const adv = mergeAdvanced(globalRow?.advanced_settings);

      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
      const targetUser = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === data.email.toLowerCase()
      );

      if (targetUser) {
        await supabaseAdmin.auth.admin.updateUserById(targetUser.id, { email_confirm: true });
        if (!adv.verifyEnabled || !adv.verifyEmail) {
          await supabaseAdmin
            .from("profiles")
            .update({ email_verified_at: new Date().toISOString() })
            .eq("id", targetUser.id);
        }
        return { ok: true };
      }
    } catch (err) {
      console.error("[unlockUnconfirmedUser] error", err);
    }
    return { ok: false };
  });

/** Send a fresh 6-digit code to the signed-in user's email or phone. */
export const sendVerificationCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ channel: z.enum(["email", "sms"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { pickConfig, sendSms, sendEmail } = await import("@/lib/notifications.server");
    const { supabase, userId, claims } = context as any;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .maybeSingle();

    const target =
      data.channel === "email"
        ? (claims?.email as string | undefined) ?? ""
        : (profile?.phone as string | undefined) ?? "";
    if (!target) {
      return { ok: false, error: data.channel === "email" ? "No email on this account" : "No phone number on this account" };
    }

    // The platform sender lives on a row a signing-up reseller cannot read, and
    // its credentials must never reach the browser, so it is loaded server-side
    // with elevated access (falling back to the caller's own access for admins).
    let sender = null as Awaited<ReturnType<typeof pickConfig>>;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      sender = await pickConfig(supabaseAdmin, null, data.channel);
    } catch (err) {
      console.error("[verify] elevated sender lookup unavailable", err);
    }
    if (!sender) sender = await pickConfig(supabase, null, data.channel);
    const cfg = sender;
    if (!cfg) {
      return { ok: false, error: `No active ${data.channel} sender is configured yet` };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { error: issueError } = await supabase.rpc("verify_issue", {
      _channel: data.channel,
      _target: target,
      _code: code,
    });
    if (issueError) return { ok: false, error: issueError.message };

    const text = `Your verification code is ${code}. It expires in 15 minutes.`;
    const res =
      data.channel === "sms"
        ? await sendSms(cfg, target, text)
        : await sendEmail(
            cfg,
            target,
            "Your verification code",
            `<p>Hi ${profile?.full_name || ""},</p><p>Your verification code is <b style="font-size:20px">${code}</b>.</p><p>It expires in 15 minutes.</p>`,
          );

    // Platform-level log row (no reseller_id): a reseller cannot insert it, so
    // logging is best effort and never blocks the verification flow.
    const logRow = {
      channel: data.channel,
      recipient: target,
      template: "signup_verification",
      status: res.ok ? "sent" : "failed",
      error: res.error || null,
      payload: null,
    };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("notification_logs").insert(logRow as any);
    } catch {
      await supabase.from("notification_logs").insert(logRow);
    }

    if (!res.ok) return { ok: false, error: res.error || "Could not send the code" };
    return { ok: true, target: maskTarget(data.channel, target) };
  });

function maskTarget(channel: "email" | "sms", value: string) {
  if (channel === "email") {
    const [user, domain] = value.split("@");
    if (!domain) return value;
    return `${user.slice(0, 2)}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
  }
  return `${value.slice(0, 3)}${"*".repeat(Math.max(1, value.length - 6))}${value.slice(-3)}`;
}
