import { supabaseAdmin } from "@/integrations/supabase/client.server";

const WORDS = ["shop", "sell", "store", "order", "reseller", "market"];

/** Easy to type/read temporary password, e.g. "shop4821". */
export function easyPassword(): string {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${word}${digits}`;
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
