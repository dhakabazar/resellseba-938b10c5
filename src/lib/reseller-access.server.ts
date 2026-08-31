const WORDS = ["shop", "sell", "store", "order", "reseller", "market"];

/** Easy to type/read temporary password, e.g. "shop4821". */
export function easyPassword(): string {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${word}${digits}`;
}

type DbClient = {
  from: (table: string) => any;
};

/** Keeps legacy/edge-case active reseller accounts from landing on onboarding. */
export async function ensureActiveResellerRole(supabase: DbClient, userId: string) {
  const { data: reseller, error: resellerError } = await supabase
    .from("resellers")
    .select("id,status,business_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (resellerError) throw new Response(resellerError.message, { status: 400 });
  if (!reseller) throw new Response("Reseller profile not found", { status: 404 });
  if (reseller.status !== "active") {
    throw new Response("Only active resellers can be opened", { status: 400 });
  }

  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "reseller" }, { onConflict: "user_id,role" });
  if (error) throw new Response(error.message, { status: 400 });

  return reseller as { id: string; status: string; business_name: string | null };
}

/** Creates temporary email/password credentials the browser can exchange for a reseller session. */
export async function createImpersonationLogin(supabase: any, userId: string) {
  const password = easyPassword();
  // Single permission-checked database function: verifies the caller can
  // impersonate, ensures the reseller role, confirms the email, sets the
  // temporary password and returns the login email. Works for staff that only
  // have `resellers.impersonate` (no full reseller management access).
  const { data, error } = await supabase.rpc("admin_impersonation_login" as any, {
    _user_id: userId,
    _password: password,
  });
  if (error) {
    const message = error.message.replace(/^.*?(?:ERROR|error):\s*/i, "") || "Could not open reseller panel";
    throw new Response(message, { status: /forbidden|not signed in/i.test(message) ? 403 : 400 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  const email = typeof row === "string" ? row : (row?.email as string | null);
  if (!email) throw new Response("Reseller account has no email", { status: 400 });

  return { ok: true as const, email, password };
}

