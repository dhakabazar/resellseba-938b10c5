import { supabaseAdmin } from "@/integrations/supabase/client.server";

const WORDS = ["shop", "sell", "store", "order", "reseller", "market"];

/** Easy to type/read temporary password, e.g. "shop4821". */
export function easyPassword(): string {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${word}${digits}`;
}

/** Keeps legacy/edge-case active reseller accounts from landing on onboarding. */
export async function ensureActiveResellerRole(userId: string) {
  const { data: reseller, error: resellerError } = await supabaseAdmin
    .from("resellers")
    .select("id,status")
    .eq("user_id", userId)
    .maybeSingle();
  if (resellerError) throw new Response(resellerError.message, { status: 400 });
  if (!reseller) throw new Response("Reseller profile not found", { status: 404 });
  if (reseller.status !== "active") {
    throw new Response("Only active resellers can be opened", { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "reseller" }, { onConflict: "user_id,role" });
  if (error) throw new Response(error.message, { status: 400 });
}

/** Creates a one-time token hash that the browser can exchange for the reseller session. */
export async function mintImpersonationToken(userId: string) {
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userErr || !userRes?.user?.email) {
    throw new Response(userErr?.message ?? "Reseller account has no email", { status: 400 });
  }
  const email = userRes.user.email;

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Response(error.message, { status: 400 });

  const tokenHash = (data as any)?.properties?.hashed_token as string | undefined;
  if (!tokenHash) throw new Response("Could not create login token", { status: 400 });

  return { ok: true as const, email, tokenHash };
}
