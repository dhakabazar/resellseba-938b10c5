// Server-only Cloudflare helpers: SaaS custom hostnames + Worker custom domains.
// Credentials live in public.cloudflare_config (service-role only) and never reach the browser.

const CF_API = "https://api.cloudflare.com/client/v4";

export type DomainMode = "cloudflare" | "dns";

export type CfConfig = {
  api_token: string | null;
  account_id: string | null;
  zone_id: string | null;
  zone_name: string | null;
  worker_name: string | null;
  cname_target: string | null;
  a_record_ip: string | null;
  auto_worker_domain: boolean;
  is_active: boolean;
  updated_at: string;
  /** Which setups are allowed: cloudflare only, server DNS only, or both. */
  mode: "cloudflare" | "dns" | "both";
  server_a_ip: string | null;
  server_cname: string | null;
  server_note: string | null;
  dns_active: boolean;
};

export async function loadConfig(db: any): Promise<CfConfig> {
  const { data, error } = await db.from("cloudflare_config").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Response(error.message, { status: 400 });
  return (data ?? {
    api_token: null,
    account_id: null,
    zone_id: null,
    zone_name: null,
    worker_name: null,
    cname_target: null,
    a_record_ip: null,
    auto_worker_domain: false,
    is_active: false,
    updated_at: new Date().toISOString(),
    mode: "both",
    server_a_ip: null,
    server_cname: null,
    server_note: null,
    dns_active: false,
  }) as CfConfig;
}

const EMPTY_CONFIG: CfConfig = {
  api_token: null,
  account_id: null,
  zone_id: null,
  zone_name: null,
  worker_name: null,
  cname_target: null,
  a_record_ip: null,
  auto_worker_domain: false,
  is_active: false,
  updated_at: new Date().toISOString(),
  mode: "both",
  server_a_ip: null,
  server_cname: null,
  server_note: null,
  dns_active: false,
};

/**
 * Load the config through a SECURITY DEFINER RPC using the caller's own client.
 * This keeps custom domains working without a service-role key.
 */
export async function loadConfigAsCaller(supabase: any): Promise<CfConfig> {
  const { data, error } = await supabase.rpc("cf_config_get");
  if (error) throw new Response(error.message, { status: 403 });
  const row = (Array.isArray(data) ? data[0] : data) ?? {};
  return { ...EMPTY_CONFIG, ...row, api_token: row.api_token ?? envToken() } as CfConfig;
}

/** Cloudflare token from a server secret (never reaches the browser). */
function envToken(): string | null {
  const v = process.env["CLOUDFLARE_API_TOKEN"];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Non-secret settings for any signed-in caller (resellers provisioning their own
 * hostname). The token comes from the server secret only.
 */
export async function loadConfigForProvisioning(supabase: any): Promise<CfConfig> {
  const { data, error } = await supabase.rpc("cf_config_settings");
  if (error) throw new Response(error.message, { status: 403 });
  const row = (Array.isArray(data) ? data[0] : data) ?? {};
  return { ...EMPTY_CONFIG, ...row, api_token: envToken() } as CfConfig;
}

/** Admin config when permitted, otherwise the non-secret + env-token config. */
export async function loadConfigFlexible(supabase: any): Promise<CfConfig> {
  try {
    return await loadConfigAsCaller(supabase);
  } catch {
    return loadConfigForProvisioning(supabase);
  }
}

/** Public-safe DNS guide values for any signed-in user. */
export async function loadDnsGuideAsCaller(supabase: any) {
  const { data, error } = await supabase.rpc("cf_dns_guide");
  if (error) throw new Response(error.message, { status: 403 });
  const row = Array.isArray(data) ? data[0] : data;
  return {
    cnameTarget: row?.cname_target ?? "",
    aRecordIp: row?.a_record_ip ?? "",
    zoneName: row?.zone_name ?? "",
    active: !!row?.active,
    mode: (row?.mode ?? "both") as "cloudflare" | "dns" | "both",
    serverIp: row?.server_a_ip ?? "",
    serverCname: row?.server_cname ?? "",
    serverNote: row?.server_note ?? "",
    cfReady: !!row?.cf_ready,
    dnsReady: !!row?.dns_ready,
  };
}

/** Config that is safe to send to the admin UI — token is masked. */
export function maskConfig(c: CfConfig) {
  const token = c.api_token ?? "";
  return {
    hasToken: token.length > 0,
    tokenHint: token ? `${token.slice(0, 4)}••••${token.slice(-4)}` : "",
    account_id: c.account_id ?? "",
    zone_id: c.zone_id ?? "",
    zone_name: c.zone_name ?? "",
    worker_name: c.worker_name ?? "",
    cname_target: c.cname_target ?? "",
    a_record_ip: c.a_record_ip ?? "",
    auto_worker_domain: !!c.auto_worker_domain,
    is_active: !!c.is_active,
    updated_at: c.updated_at,
    mode: c.mode ?? "both",
    server_a_ip: c.server_a_ip ?? "",
    server_cname: c.server_cname ?? "",
    server_note: c.server_note ?? "",
    dns_active: !!c.dns_active,
  };
}
export type MaskedCfConfig = ReturnType<typeof maskConfig>;

/** The server-DNS route is usable (no Cloudflare API needed). */
export function requireDnsConfig(c: CfConfig) {
  if ((c.mode ?? "both") === "cloudflare")
    throw new Response("Server DNS mode is turned off. Enable it in Admin → Custom domains.", { status: 400 });
  if (!c.dns_active) throw new Response("Server DNS mode is turned off. Enable it in Admin → Custom domains.", { status: 400 });
  if (!c.server_a_ip && !c.server_cname)
    throw new Response("Server IP / CNAME target is missing. Set it in Admin → Custom domains.", { status: 400 });
  return c;
}

/** DNS target the reseller must point at, for server-DNS domains. */
export function dnsTargetFor(c: CfConfig) {
  return c.server_cname || c.server_a_ip || "";
}

/** Resolve a hostname over DNS-over-HTTPS and check it points at our server. */
export async function checkDnsPointing(c: CfConfig, hostname: string) {
  const answers: string[] = [];
  for (const type of ["A", "CNAME"]) {
    try {
      const res = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`,
        { headers: { accept: "application/dns-json" } },
      );
      const body: any = await res.json();
      for (const a of body?.Answer ?? []) answers.push(String(a?.data ?? "").replace(/\.$/, "").toLowerCase());
    } catch (err) {
      console.error("DoH lookup failed", err);
    }
  }
  const ip = (c.server_a_ip ?? "").trim().toLowerCase();
  const cname = (c.server_cname ?? "").trim().toLowerCase();
  const ok = answers.some((a) => (ip && a === ip) || (cname && (a === cname || a.endsWith(`.${cname}`))));
  return { ok, answers };
}

export function requireActiveConfig(c: CfConfig) {
  if ((c.mode ?? "both") === "dns")
    throw new Response("Cloudflare mode is turned off. Use server DNS or enable it in Admin → Custom domains.", { status: 400 });
  if (!c.is_active) throw new Response("Cloudflare integration is turned off. Enable it in Admin → Custom domains.", { status: 400 });
  if (!c.api_token) throw new Response("Cloudflare API token is missing. Set it in Admin → Custom domains.", { status: 400 });
  if (!c.zone_id) throw new Response("Cloudflare Zone ID is missing. Set it in Admin → Custom domains.", { status: 400 });
  return c;
}

async function cf(c: CfConfig, path: string, init?: RequestInit) {
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${c.api_token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok || body?.success === false) {
    const msg =
      body?.errors?.map((e: any) => e.message).filter(Boolean).join(", ") ||
      body?.error ||
      `Cloudflare request failed (${res.status})`;
    console.error(`Cloudflare ${path} failed [${res.status}]: ${text.slice(0, 500)}`);
    throw new Response(msg, { status: 502 });
  }
  return body?.result ?? body;
}

/** Normalize + sanity check a hostname coming from the UI. */
export function normalizeHostname(raw: string) {
  const host = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
  if (!/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(host) || host.length > 253)
    throw new Response("Enter a valid domain, e.g. shop.yourbrand.com", { status: 400 });
  if (/(^|\.)(localhost|lovable\.app|lovableproject\.com)$/.test(host))
    throw new Response("This domain cannot be used as a custom domain", { status: 400 });
  return host;
}

/** Token sanity check (also confirms zone + account reachability). */
export async function verifyToken(c: CfConfig) {
  const out: { token: boolean; zone: string | null; account: string | null } = { token: false, zone: null, account: null };
  await cf(c, "/user/tokens/verify");
  out.token = true;
  if (c.zone_id) {
    const zone = await cf(c, `/zones/${c.zone_id}`);
    out.zone = zone?.name ?? null;
  }
  if (c.account_id) {
    const acc = await cf(c, `/accounts/${c.account_id}`);
    out.account = acc?.name ?? null;
  }
  return out;
}

export type HostnameState = {
  id: string;
  sslStatus: string;
  ownershipStatus: string;
  dnsTarget: string;
  txtName: string | null;
  txtValue: string | null;
  active: boolean;
};

function readHostname(c: CfConfig, r: any): HostnameState {
  const ssl = r?.ssl ?? {};
  const ov = r?.ownership_verification ?? {};
  return {
    id: String(r?.id ?? ""),
    sslStatus: String(ssl?.status ?? "pending"),
    ownershipStatus: String(r?.status ?? "pending"),
    dnsTarget: c.cname_target || c.zone_name || "",
    txtName: ov?.name ?? null,
    txtValue: ov?.value ?? null,
    active: String(r?.status ?? "") === "active" && String(ssl?.status ?? "") === "active",
  };
}

export async function createCustomHostname(c: CfConfig, hostname: string): Promise<HostnameState> {
  // Re-use an existing hostname entry when Cloudflare already knows this domain.
  const existing = await cf(c, `/zones/${c.zone_id}/custom_hostnames?hostname=${encodeURIComponent(hostname)}`);
  if (Array.isArray(existing) && existing.length > 0) return readHostname(c, existing[0]);

  const result = await cf(c, `/zones/${c.zone_id}/custom_hostnames`, {
    method: "POST",
    body: JSON.stringify({
      hostname,
      ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" }, wildcard: false },
    }),
  });
  return readHostname(c, result);
}

export async function getCustomHostname(c: CfConfig, id: string): Promise<HostnameState> {
  const result = await cf(c, `/zones/${c.zone_id}/custom_hostnames/${id}`);
  return readHostname(c, result);
}

export async function deleteCustomHostname(c: CfConfig, id: string) {
  try {
    await cf(c, `/zones/${c.zone_id}/custom_hostnames/${id}`, { method: "DELETE" });
  } catch (err) {
    // A hostname deleted on Cloudflare's side must not block removal in our DB.
    console.error("Cloudflare hostname delete failed", err);
  }
}

/** Attach the hostname straight to the Worker (only for domains inside our own zone). */
export async function attachWorkerDomain(c: CfConfig, hostname: string): Promise<string | null> {
  if (!c.auto_worker_domain || !c.account_id || !c.worker_name || !c.zone_id) return null;
  if (c.zone_name && !hostname.endsWith(c.zone_name)) return null;
  const result = await cf(c, `/accounts/${c.account_id}/workers/domains`, {
    method: "PUT",
    body: JSON.stringify({ environment: "production", hostname, service: c.worker_name, zone_id: c.zone_id }),
  });
  return result?.id ? String(result.id) : null;
}

export async function detachWorkerDomain(c: CfConfig, id: string) {
  if (!c.account_id) return;
  try {
    await cf(c, `/accounts/${c.account_id}/workers/domains/${id}`, { method: "DELETE" });
  } catch (err) {
    console.error("Cloudflare worker domain delete failed", err);
  }
}
