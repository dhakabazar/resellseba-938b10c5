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
  auto_worker_routes?: boolean;
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
    auto_worker_routes: false,
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
  auto_worker_routes: false,
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

/**
 * Admin config when permitted (settings.manage / domains.manage), or the
 * reseller's own config when they're provisioning their own hostname —
 * cf_config_get() itself allows both cases via current_reseller_id(), so no
 * service-role bypass is needed here.
 */
export async function loadConfigFlexible(supabase: any): Promise<CfConfig> {
  return loadConfigAsCaller(supabase);
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
  const autoRoutes = Boolean(c.auto_worker_routes ?? c.auto_worker_domain);
  return {
    hasToken: token.length > 0,
    tokenHint: token ? `${token.slice(0, 4)}••••${token.slice(-4)}` : "",
    account_id: c.account_id ?? "",
    zone_id: c.zone_id ?? "",
    zone_name: c.zone_name ?? "",
    worker_name: c.worker_name ?? "",
    cname_target: c.cname_target ?? "",
    a_record_ip: c.a_record_ip ?? "",
    auto_worker_domain: autoRoutes,
    auto_worker_routes: autoRoutes,
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
    const status = res.status >= 400 && res.status <= 599 ? res.status : 502;
    throw new Response(msg, { status });
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
  created: boolean;
  sslStatus: string;
  ownershipStatus: string;
  dnsTarget: string;
  txtName: string | null;
  txtValue: string | null;
  active: boolean;
};

function readHostname(c: CfConfig, r: any, created = false): HostnameState {
  const ssl = r?.ssl ?? {};
  const ov = r?.ownership_verification ?? {};
  return {
    id: String(r?.id ?? ""),
    created,
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
  if (Array.isArray(existing) && existing.length > 0) return readHostname(c, existing[0], false);

  const result = await cf(c, `/zones/${c.zone_id}/custom_hostnames`, {
    method: "POST",
    body: JSON.stringify({
      hostname,
      ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" }, wildcard: false },
    }),
  });
  return readHostname(c, result, true);
}

export async function getCustomHostname(c: CfConfig, id: string): Promise<HostnameState> {
  const result = await cf(c, `/zones/${c.zone_id}/custom_hostnames/${id}`);
  return readHostname(c, result);
}

export async function deleteCustomHostname(c: CfConfig, id: string) {
  try {
    await cf(c, `/zones/${c.zone_id}/custom_hostnames/${id}`, { method: "DELETE" });
  } catch (err) {
    // A record that is already gone is the desired end state. Other failures
    // must remain visible so the DB row is retained and cleanup can be retried.
    if (err instanceof Response && err.status === 404) return;
    throw err;
  }
}

/** Attach the hostname to the Worker (Workers Custom Domains). */
export async function attachWorkerDomain(c: CfConfig, hostname: string): Promise<string | null> {
  const accountId = c.account_id?.trim();
  const service = (c.worker_name && c.worker_name.trim()) || "saas-proxy";
  if (!accountId || !c.api_token) return null;

  const payload: any = {
    environment: "production",
    hostname,
    service,
  };
  if (c.zone_id?.trim()) {
    payload.zone_id = c.zone_id.trim();
  }

  try {
    const result = await cf(c, `/accounts/${accountId}/workers/domains`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return result?.id ? String(result.id) : null;
  } catch (err: any) {
    console.warn(`Cloudflare attachWorkerDomain for ${hostname} returned:`, err?.message || err);
    // If it failed with zone_id, retry without zone_id
    if (payload.zone_id) {
      try {
        const retryResult = await cf(c, `/accounts/${accountId}/workers/domains`, {
          method: "PUT",
          body: JSON.stringify({ environment: "production", hostname, service }),
        });
        return retryResult?.id ? String(retryResult.id) : null;
      } catch (retryErr) {
        console.warn(`Cloudflare attachWorkerDomain retry without zone_id for ${hostname}:`, retryErr);
      }
    }
    // If it already exists, query existing domains
    try {
      const existing = await cf(c, `/accounts/${accountId}/workers/domains`);
      if (Array.isArray(existing)) {
        const match = existing.find((d: any) => d.hostname === hostname);
        if (match?.id) return String(match.id);
      }
    } catch {}
    return null;
  }
}

export async function detachWorkerDomain(
  c: CfConfig,
  target: { id?: string | null; hostname?: string } | string,
) {
  const accountId = c.account_id?.trim();
  if (!accountId || !c.api_token) return;

  const id = typeof target === "string" ? target : target?.id;
  const hostname = typeof target === "object" ? target?.hostname : undefined;

  if (id) {
    try {
      await cf(c, `/accounts/${accountId}/workers/domains/${id}`, { method: "DELETE" });
      return;
    } catch (err) {
      if (err instanceof Response && err.status === 404) return;
      console.warn(`Worker domain detach by ID failed (${id}):`, err);
    }
  }

  if (hostname) {
    try {
      const domains = await cf(c, `/accounts/${accountId}/workers/domains`);
      if (Array.isArray(domains)) {
        const matches = domains.filter((d: any) => d.hostname === hostname);
        for (const m of matches) {
          try {
            await cf(c, `/accounts/${accountId}/workers/domains/${m.id}`, { method: "DELETE" });
          } catch (delErr) {
            console.warn(`Failed to delete matched worker domain ${m.id}:`, delErr);
          }
        }
      }
    } catch (err) {
      console.warn(`Could not list/clean worker domains for ${hostname}:`, err);
    }
  }
}

/**
 * Automatically create or sync a Cloudflare Worker Route for a domain.
 * Pattern: `hostname/*` pointing to script `c.worker_name || 'saas-proxy'`
 */
export async function createWorkerRoute(c: CfConfig, hostname: string): Promise<string | null> {
  if (!c.zone_id || !c.api_token) return null;

  const pattern = `${hostname}/*`;
  const scriptName = (c.worker_name && c.worker_name.trim()) || "saas-proxy";

  // Check if a route already exists for this pattern
  try {
    const existing = await cf(c, `/zones/${c.zone_id}/workers/routes`);
    if (Array.isArray(existing)) {
      const match = existing.find((r: any) => r.pattern === pattern);
      if (match?.id) {
        if (match.script !== scriptName) {
          try {
            await cf(c, `/zones/${c.zone_id}/workers/routes/${match.id}`, {
              method: "PUT",
              body: JSON.stringify({ pattern, script: scriptName }),
            });
          } catch (updateErr) {
            console.error(`Failed to update existing worker route ${match.id}:`, updateErr);
          }
        }
        return String(match.id);
      }
    }
  } catch (err) {
    console.warn("Could not list worker routes to check existing:", err);
  }

  try {
    const result = await cf(c, `/zones/${c.zone_id}/workers/routes`, {
      method: "POST",
      body: JSON.stringify({ pattern, script: scriptName }),
    });
    return result?.id ? String(result.id) : null;
  } catch (err: any) {
    console.error(`Cloudflare worker route creation failed for ${pattern}:`, err);
    // If route creation reported duplicate or conflict, try finding it again
    try {
      const existing = await cf(c, `/zones/${c.zone_id}/workers/routes`);
      if (Array.isArray(existing)) {
        const match = existing.find((r: any) => r.pattern === pattern);
        if (match?.id) return String(match.id);
      }
    } catch {}
    return null;
  }
}

/**
 * Delete a Cloudflare Worker Route by route ID or hostname pattern.
 */
export async function deleteWorkerRoute(
  c: CfConfig,
  target: { routeId?: string | null; hostname?: string },
) {
  if (!c.zone_id || !c.api_token) return;

  if (target.routeId) {
    try {
      await cf(c, `/zones/${c.zone_id}/workers/routes/${target.routeId}`, { method: "DELETE" });
      return;
    } catch (err) {
      if (err instanceof Response && err.status === 404) return;
      console.warn(`Worker route delete by ID failed (${target.routeId}):`, err);
    }
  }

  if (target.hostname) {
    try {
      const pattern = `${target.hostname}/*`;
      const routes = await cf(c, `/zones/${c.zone_id}/workers/routes`);
      if (Array.isArray(routes)) {
        const matches = routes.filter((r: any) => r.pattern === pattern);
        for (const m of matches) {
          try {
            await cf(c, `/zones/${c.zone_id}/workers/routes/${m.id}`, { method: "DELETE" });
          } catch (delErr) {
            console.warn(`Failed to delete matched worker route ${m.id}:`, delErr);
          }
        }
      }
    } catch (err) {
      console.warn(`Could not list/clean worker routes for ${target.hostname}:`, err);
    }
  }
}

