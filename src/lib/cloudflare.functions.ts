import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchAll, fetchAllIn } from "@/lib/fetch-all";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MaskedCfConfig } from "@/lib/cloudflare.server";

export type DomainMode = "cloudflare" | "dns";

export type DomainRow = {
  id: string;
  mode: DomainMode;
  reseller_id: string;
  reseller_name: string | null;
  reseller_code: string | null;
  hostname: string;
  is_primary: boolean;
  ssl_status: string;
  ownership_status: string | null;
  dns_target: string | null;
  verification_txt_name: string | null;
  verification_txt_value: string | null;
  cloudflare_hostname_id: string | null;
  worker_domain_id: string | null;
  worker_route_id: string | null;
  last_error: string | null;
  last_checked_at: string | null;
  verified_at: string | null;
  created_at: string;
};

export type DnsGuide = {
  cnameTarget: string;
  aRecordIp: string;
  zoneName: string;
  active: boolean;
  mode: "cloudflare" | "dns" | "both";
  serverIp: string;
  serverCname: string;
  serverNote: string;
  cfReady: boolean;
  dnsReady: boolean;
};

/** Masked Cloudflare credentials for the admin settings screen. */
export const getCloudflareConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MaskedCfConfig> => {
    const { assertAnyPermission } = await import("@/lib/admin-users.server");
    await assertAnyPermission(context.supabase, context.userId, ["settings.manage", "domains.manage"]);
    const { loadConfigAsCaller, maskConfig } = await import("@/lib/cloudflare.server");
    return maskConfig(await loadConfigAsCaller(context.supabase));
  });

/** Save credentials. An empty token keeps the stored one. */
export const saveCloudflareConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        api_token: z.string().max(300).optional(),
        account_id: z.string().max(120).default(""),
        zone_id: z.string().max(120).default(""),
        zone_name: z.string().max(253).default(""),
        worker_name: z.string().max(120).default(""),
        cname_target: z.string().max(253).default(""),
        a_record_ip: z.string().max(64).default(""),
        auto_worker_domain: z.boolean().default(false),
        auto_worker_routes: z.boolean().optional(),
        is_active: z.boolean().default(false),
        mode: z.enum(["cloudflare", "dns", "both"]).default("both"),
        server_a_ip: z.string().max(64).default(""),
        server_cname: z.string().max(253).default(""),
        server_note: z.string().max(2000).default(""),
        dns_active: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<MaskedCfConfig> => {
    const { assertAnyPermission } = await import("@/lib/admin-users.server");
    await assertAnyPermission(context.supabase, context.userId, ["settings.manage", "domains.manage"]);
    const { loadConfigAsCaller, maskConfig } = await import("@/lib/cloudflare.server");

    const autoRoutes = Boolean(data.auto_worker_routes ?? data.auto_worker_domain);

    const { error } = await context.supabase.rpc("cf_config_save", {
      _api_token: (data.api_token ?? "").trim(),
      _account_id: data.account_id.trim(),
      _zone_id: data.zone_id.trim(),
      _zone_name: data.zone_name.trim(),
      _worker_name: data.worker_name.trim(),
      _cname_target: data.cname_target.trim(),
      _a_record_ip: data.a_record_ip.trim(),
      _auto_worker_domain: autoRoutes,
      _is_active: data.is_active,
      _mode: data.mode,
      _server_a_ip: data.server_a_ip.trim(),
      _server_cname: data.server_cname.trim(),
      _server_note: data.server_note.trim(),
      _dns_active: data.dns_active,
    });
    if (error) throw new Response(error.message, { status: 400 });
    return maskConfig(await loadConfigAsCaller(context.supabase));
  });

/** Check the stored token / zone / account against Cloudflare. */
export const testCloudflareConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ token: boolean; zone: string | null; account: string | null }> => {
    const { assertAnyPermission } = await import("@/lib/admin-users.server");
    await assertAnyPermission(context.supabase, context.userId, ["settings.manage", "domains.manage"]);
    const { loadConfigAsCaller, requireActiveConfig, verifyToken } = await import("@/lib/cloudflare.server");
    const conf = await loadConfigAsCaller(context.supabase);
    if (!conf.api_token) throw new Response("Save an API token first", { status: 400 });
    requireActiveConfig({ ...conf, is_active: true });
    return verifyToken(conf);
  });

/** Public-safe DNS instructions for the reseller panel. */
export const getDnsGuide = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DnsGuide> => {
    const { loadDnsGuideAsCaller } = await import("@/lib/cloudflare.server");
    return loadDnsGuideAsCaller(context.supabase);
  });

type Ctx = { supabase: any; userId: string };

async function isAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_any_permission", {
    _user_id: ctx.userId,
    _permissions: ["settings.manage", "domains.manage", "resellers.manage"],
  });
  return !!data;
}

/** The reseller store the caller belongs to (owner or active staff member). */
async function callerResellerId(ctx: Ctx): Promise<string | null> {
  const { data: own } = await ctx.supabase.from("resellers").select("id").eq("user_id", ctx.userId).maybeSingle();
  if (own?.id) return own.id as string;
  const { data: viaRpc } = await ctx.supabase.rpc("current_reseller_id");
  const id = Array.isArray(viaRpc) ? viaRpc[0] : viaRpc;
  return (typeof id === "string" && id) || null;
}

/** Which reseller the caller may act on. */
async function resolveReseller(ctx: Ctx, resellerId?: string) {
  const own = await callerResellerId(ctx);
  if (resellerId && own === resellerId) return resellerId;
  if (resellerId) {
    if (!(await isAdmin(ctx))) throw new Response("Forbidden", { status: 403 });
    return resellerId;
  }
  if (!own) throw new Response("No reseller store found for this account", { status: 400 });
  return own;
}

async function loadDomainForCaller(ctx: Ctx, id: string) {
  const { data: row, error } = await ctx.supabase.from("reseller_domains").select("*").eq("id", id).maybeSingle();
  if (error) throw new Response(error.message, { status: 400 });
  if (!row) throw new Response("Domain not found", { status: 404 });
  const own = await callerResellerId(ctx);
  if (own !== row.reseller_id && !(await isAdmin(ctx))) throw new Response("Forbidden", { status: 403 });
  return row as any;
}


function mapRow(row: any, reseller?: { business_name?: string | null; code?: string | null } | null): DomainRow {
  return {
    id: row.id,
    mode: (row.mode === "dns" ? "dns" : "cloudflare") as DomainMode,
    reseller_id: row.reseller_id,
    reseller_name: reseller?.business_name ?? null,
    reseller_code: reseller?.code ?? null,
    hostname: row.hostname,
    is_primary: !!row.is_primary,
    ssl_status: row.ssl_status,
    ownership_status: row.ownership_status ?? null,
    dns_target: row.dns_target ?? null,
    verification_txt_name: row.verification_txt_name ?? null,
    verification_txt_value: row.verification_txt_value ?? null,
    cloudflare_hostname_id: row.cloudflare_hostname_id ?? null,
    worker_domain_id: row.worker_domain_id ?? null,
    worker_route_id: row.worker_route_id ?? row.worker_domain_id ?? null,
    last_error: row.last_error ?? null,
    last_checked_at: row.last_checked_at ?? null,
    verified_at: row.verified_at ?? null,
    created_at: row.created_at,
  };
}

/** Domains of one reseller (self) or, for admins, of everyone. */
export const listDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ resellerId: z.string().uuid().optional(), all: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<DomainRow[]> => {
    const ctx = { supabase: context.supabase, userId: context.userId };
    const db = context.supabase;

    let query = db.from("reseller_domains").select("*").order("created_at");
    if (data.all) {
      if (!(await isAdmin(ctx))) throw new Response("Forbidden", { status: 403 });
    } else {
      query = query.eq("reseller_id", await resolveReseller(ctx, data.resellerId));
    }
    const rows = await fetchAll<any>(() => query);

    const ids = [...new Set(rows.map((r: any) => r.reseller_id))];
    const resellers = ids.length ? await fetchAllIn<any>((chunk) => db.from("resellers").select("id, business_name, code").in("id", chunk), ids) : [];
    const byId = new Map(resellers.map((r: any) => [r.id, r]));
    return rows.map((r: any) => mapRow(r, byId.get(r.reseller_id)));
  });

/** When connecting a bare apex domain, provision "www." as the second half of
 * the same user-facing domain pair. Either both rows succeed or both are cleaned up. */
async function tryAutoWww(
  cf: typeof import("@/lib/cloudflare.server"),
  db: any,
  resellerId: string,
  apexHostname: string,
  mode: "cloudflare" | "dns",
  conf: any,
) {
  const { isApexHostname } = await import("@/lib/hostname-utils");
  if (!isApexHostname(apexHostname)) return;
  const wwwHost = `www.${apexHostname}`;
  let createdHostnameId: string | null = null;
  let createdWorkerRouteId: string | null = null;
  let createdWorkerDomainId: string | null = null;
  try {
    const { data: dupe } = await db.from("reseller_domains").select("id").eq("hostname", wwwHost).maybeSingle();
    if (dupe) return;

    if (mode === "dns") {
      const { error } = await db.from("reseller_domains").insert({
        reseller_id: resellerId,
        hostname: wwwHost,
        mode: "dns",
        is_primary: false,
        ssl_status: "pending",
        ownership_status: "dns_pending",
        dns_target: cf.dnsTargetFor(conf),
        last_checked_at: new Date().toISOString(),
        last_error: null,
      });
      if (error) throw new Error(error.message);
      return;
    }

    const state = await cf.createCustomHostname(conf, wwwHost);
    createdHostnameId = state.created ? state.id : null;

    let workerRouteId: string | null = null;
    try {
      workerRouteId = await cf.createWorkerRoute(conf, wwwHost);
      createdWorkerRouteId = workerRouteId;
    } catch (err) {
      console.error("auto www worker route create failed", err);
    }

    let workerDomainId: string | null = null;
    try {
      workerDomainId = await cf.attachWorkerDomain(conf, wwwHost);
      createdWorkerDomainId = workerDomainId;
    } catch (err) {
      console.error("worker domain attach failed (auto www)", err);
    }

    const { error } = await db.from("reseller_domains").insert({
      reseller_id: resellerId,
      hostname: wwwHost,
      mode: "cloudflare",
      is_primary: false,
      ssl_status: state.sslStatus,
      ownership_status: state.ownershipStatus,
      cloudflare_hostname_id: state.id,
      worker_domain_id: workerDomainId,
      worker_route_id: workerRouteId,
      dns_target: state.dnsTarget,
      verification_txt_name: state.txtName,
      verification_txt_value: state.txtValue,
      verified_at: state.active ? new Date().toISOString() : null,
      last_checked_at: new Date().toISOString(),
      last_error: null,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    if (createdWorkerRouteId) {
      try {
        await cf.deleteWorkerRoute(conf, { routeId: createdWorkerRouteId, hostname: wwwHost });
      } catch (cleanupError) {
        console.error("auto www worker route cleanup failed", cleanupError);
      }
    }
    if (createdWorkerDomainId) {
      try {
        await cf.detachWorkerDomain(conf, createdWorkerDomainId);
      } catch (cleanupError) {
        console.error("auto www worker cleanup failed", cleanupError);
      }
    }
    if (createdHostnameId) {
      try {
        await cf.deleteCustomHostname(conf, createdHostnameId);
      } catch (cleanupError) {
        console.error("auto www hostname cleanup failed", cleanupError);
      }
    }
    throw err;
  }
}

/** Add a hostname and provision it on Cloudflare. */
export const connectDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        hostname: z.string().max(300),
        resellerId: z.string().uuid().optional(),
        mode: z.enum(["cloudflare", "dns"]).default("cloudflare"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<DomainRow> => {
    const cf = await import("@/lib/cloudflare.server");
    const ctx = { supabase: context.supabase, userId: context.userId };
    const db = context.supabase;
    const resellerId = await resolveReseller(ctx, data.resellerId);
    const hostname = cf.normalizeHostname(data.hostname);

    const { data: dupe } = await db
      .from("reseller_domains")
      .select("id, reseller_id")
      .eq("hostname", hostname)
      .maybeSingle();
    if (dupe) throw new Response("This domain is already connected", { status: 400 });

    const { count } = await db
      .from("reseller_domains")
      .select("id", { count: "exact", head: true })
      .eq("reseller_id", resellerId);
    const isPrimary = (count ?? 0) === 0;

    // Server-DNS mode: no Cloudflare API call, the reseller just points DNS at our server.
    if (data.mode === "dns") {
      const conf = cf.requireDnsConfig(await cf.loadConfigFlexible(db));
      const { data: row, error } = await db
        .from("reseller_domains")
        .insert({
          reseller_id: resellerId,
          hostname,
          mode: "dns",
          is_primary: isPrimary,
          ssl_status: "pending",
          ownership_status: "dns_pending",
          dns_target: cf.dnsTargetFor(conf),
          last_checked_at: new Date().toISOString(),
          last_error: null,
        })
        .select("*")
        .single();
      if (error) {
        const dup = (error as any).code === "23505";
        throw new Response(dup ? "This domain is already connected" : error.message, { status: 400 });
      }
      try {
        await tryAutoWww(cf, db, resellerId, hostname, "dns", conf);
      } catch (err) {
        await db.from("reseller_domains").delete().eq("id", row.id);
        throw err;
      }
      return mapRow(row);
    }

    const conf = cf.requireActiveConfig(await cf.loadConfigFlexible(db));
    const state = await cf.createCustomHostname(conf, hostname);

    let workerRouteId: string | null = null;
    try {
      workerRouteId = await cf.createWorkerRoute(conf, hostname);
    } catch (err) {
      console.error("worker route create failed", err);
    }

    let workerDomainId: string | null = null;
    try {
      workerDomainId = await cf.attachWorkerDomain(conf, hostname);
    } catch (err) {
      console.error("worker domain attach failed", err);
    }

    const { data: row, error } = await db
      .from("reseller_domains")
      .insert({
        reseller_id: resellerId,
        hostname,
        mode: "cloudflare",
        is_primary: isPrimary,
        ssl_status: state.sslStatus,
        ownership_status: state.ownershipStatus,
        cloudflare_hostname_id: state.id,
        worker_domain_id: workerDomainId,
        worker_route_id: workerRouteId,
        dns_target: state.dnsTarget,
        verification_txt_name: state.txtName,
        verification_txt_value: state.txtValue,
        verified_at: state.active ? new Date().toISOString() : null,
        last_checked_at: new Date().toISOString(),
        last_error: null,
      })
      .select("*")
      .single();
    if (error) {
      if (workerRouteId) {
        try {
          await cf.deleteWorkerRoute(conf, { routeId: workerRouteId, hostname });
        } catch (cleanupError) {
          console.error("worker route cleanup after insert failure failed", cleanupError);
        }
      }
      if (workerDomainId) {
        try {
          await cf.detachWorkerDomain(conf, workerDomainId);
        } catch (cleanupError) {
          console.error("worker cleanup after insert failure failed", cleanupError);
        }
      }
      if (state.created) await cf.deleteCustomHostname(conf, state.id);
      const dup = (error as any).code === "23505";
      throw new Response(dup ? "This domain is already connected" : error.message, { status: 400 });
    }
    try {
      await tryAutoWww(cf, db, resellerId, hostname, "cloudflare", conf);
    } catch (err) {
      if (workerRouteId) {
        try {
          await cf.deleteWorkerRoute(conf, { routeId: workerRouteId, hostname });
        } catch (cleanupError) {
          console.error("apex worker route cleanup failed", cleanupError);
        }
      }
      if (workerDomainId) {
        try {
          await cf.detachWorkerDomain(conf, workerDomainId);
        } catch (cleanupError) {
          console.error("apex worker cleanup failed", cleanupError);
        }
      }
      try {
        if (state.created) await cf.deleteCustomHostname(conf, state.id);
      } catch (cleanupError) {
        console.error("apex hostname cleanup failed", cleanupError);
      }
      await db.from("reseller_domains").delete().eq("id", row.id);
      throw err;
    }
    return mapRow(row);
  });

/** Pull the live Cloudflare status for one domain. */
export const refreshDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<DomainRow> => {
    const cf = await import("@/lib/cloudflare.server");
    const db = context.supabase;
    const row = await loadDomainForCaller({ supabase: context.supabase, userId: context.userId }, data.id);

    if (row.mode === "dns") {
      const conf = cf.requireDnsConfig(await cf.loadConfigFlexible(db));
      const { ok, answers } = await cf.checkDnsPointing(conf, row.hostname);
      const { data: updated, error } = await db
        .from("reseller_domains")
        .update({
          dns_target: cf.dnsTargetFor(conf),
          ssl_status: ok ? "active" : "pending",
          ownership_status: ok ? "active" : "dns_pending",
          verified_at: ok ? (row.verified_at ?? new Date().toISOString()) : null,
          last_checked_at: new Date().toISOString(),
          last_error: ok
            ? null
            : `DNS is not pointing here yet${answers.length ? ` (found: ${answers.slice(0, 3).join(", ")})` : ""}`,
        })
        .eq("id", row.id)
        .select("*")
        .single();
      if (error) throw new Response(error.message, { status: 400 });
      return mapRow(updated);
    }

    const conf = cf.requireActiveConfig(await cf.loadConfigFlexible(db));

    let state;
    try {
      state = row.cloudflare_hostname_id
        ? await cf.getCustomHostname(conf, row.cloudflare_hostname_id)
        : await cf.createCustomHostname(conf, row.hostname);
    } catch (err) {
      const message = err instanceof Response ? await err.clone().text() : String(err);
      await db
        .from("reseller_domains")
        .update({ last_error: message.slice(0, 500), last_checked_at: new Date().toISOString() })
        .eq("id", row.id);
      throw err;
    }

    // If auto worker routes enabled and worker_route_id is missing, sync worker route
    let workerRouteId = row.worker_route_id;
    if ((conf.auto_worker_domain || conf.auto_worker_routes) && conf.worker_name && conf.zone_id) {
      try {
        workerRouteId = await cf.createWorkerRoute(conf, row.hostname);
      } catch (err) {
        console.error("Refresh worker route sync failed:", err);
      }
    }

    const { data: updated, error } = await db
      .from("reseller_domains")
      .update({
        cloudflare_hostname_id: state.id,
        worker_route_id: workerRouteId || row.worker_route_id,
        ssl_status: state.sslStatus,
        ownership_status: state.ownershipStatus,
        dns_target: state.dnsTarget,
        verification_txt_name: state.txtName,
        verification_txt_value: state.txtValue,
        verified_at: state.active ? (row.verified_at ?? new Date().toISOString()) : null,
        last_checked_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    return mapRow(updated);
  });

/** Make one hostname the store's canonical domain. */
export const setPrimaryDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = context.supabase;
    const row = await loadDomainForCaller({ supabase: context.supabase, userId: context.userId }, data.id);
    await db.from("reseller_domains").update({ is_primary: false }).eq("reseller_id", row.reseller_id);
    const { error } = await db.from("reseller_domains").update({ is_primary: true }).eq("id", row.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

/** Remove the domain from Cloudflare (hostname + worker route / worker domain) and from the DB. */
async function removeDomainRow(cf: typeof import("@/lib/cloudflare.server"), db: any, conf: any, row: any) {
  if (row.mode !== "dns" && conf.api_token && conf.zone_id) {
    if (row.worker_route_id || row.hostname) {
      try {
        await cf.deleteWorkerRoute(conf, { routeId: row.worker_route_id, hostname: row.hostname });
      } catch (err) {
        console.error("deleteWorkerRoute failed:", err);
      }
    }
    if (row.worker_domain_id) {
      try {
        await cf.detachWorkerDomain(conf, row.worker_domain_id);
      } catch (err) {
        console.error("detachWorkerDomain failed:", err);
      }
    }
    if (row.cloudflare_hostname_id) {
      await cf.deleteCustomHostname(conf, row.cloudflare_hostname_id);
    }
  }

  const { error } = await db.from("reseller_domains").delete().eq("id", row.id);
  if (error) throw new Response(error.message, { status: 400 });
}

export const disconnectDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const cf = await import("@/lib/cloudflare.server");
    const db = context.supabase;
    const row = await loadDomainForCaller({ supabase: context.supabase, userId: context.userId }, data.id);
    const conf = await cf.loadConfigFlexible(db);

    await removeDomainRow(cf, db, conf, row);

    // Keep exactly one primary domain per store.
    const { data: rest } = await db
      .from("reseller_domains")
      .select("id, is_primary")
      .eq("reseller_id", row.reseller_id)
      .order("created_at");
    if ((rest ?? []).length > 0 && !(rest ?? []).some((r: any) => r.is_primary))
      await db.from("reseller_domains").update({ is_primary: true }).eq("id", rest![0].id);
    return { ok: true };
  });

/** Remove an apex + www pair as one user action, keeping failed rows retryable. */
export const disconnectDomainGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ removedIds: string[]; failures: string[] }> => {
    const cf = await import("@/lib/cloudflare.server");
    const { domainGroupKey } = await import("@/lib/hostname-utils");
    const ctx = { supabase: context.supabase, userId: context.userId };
    const db = context.supabase;
    const selected = await loadDomainForCaller(ctx, data.id);
    const resellerId = await resolveReseller(ctx, selected.reseller_id);
    const { data: allRows, error: listError } = await db
      .from("reseller_domains")
      .select("*")
      .eq("reseller_id", resellerId)
      .order("created_at");
    if (listError) throw new Response(listError.message, { status: 400 });

    const key = domainGroupKey(selected.hostname);
    const group = (allRows ?? []).filter((row: any) => domainGroupKey(row.hostname) === key);
    const conf = await cf.loadConfigFlexible(db);
    const removedIds: string[] = [];
    const failures: string[] = [];

    for (const row of group) {
      try {
        await removeDomainRow(cf, db, conf, row);
        removedIds.push(row.id);
      } catch (err) {
        const detail = err instanceof Response ? await err.clone().text() : err instanceof Error ? err.message : String(err);
        failures.push(`${row.hostname}: ${detail || "remove failed"}`);
      }
    }

    const { data: rest } = await db
      .from("reseller_domains")
      .select("id, is_primary")
      .eq("reseller_id", resellerId)
      .order("created_at");
    const firstRemaining = rest?.[0];
    if (firstRemaining && !(rest ?? []).some((row: any) => row.is_primary))
      await db.from("reseller_domains").update({ is_primary: true }).eq("id", firstRemaining.id);

    return { removedIds, failures };
  });

/* --------------------------------------------- platform domains (payment redirects) */

export type PlatformOriginSettings = {
  /** The platform's own live hostnames (besides the hosting URL). */
  allowed_origins: string[];
  /** Origin that owns the privileged backend key — gateway callbacks land here. */
  callback_base_url: string;
};

function cleanHost(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

export const getPlatformOrigins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformOriginSettings> => {
    const { assertAnyPermission } = await import("@/lib/admin-users.server");
    await assertAnyPermission(context.supabase, context.userId, ["settings.manage"]);
    const { data } = await context.supabase
      .from("global_settings")
      .select("allowed_origins, callback_base_url")
      .eq("id", 1)
      .maybeSingle();
    return {
      allowed_origins: ((data as any)?.allowed_origins ?? []) as string[],
      callback_base_url: String((data as any)?.callback_base_url ?? ""),
    };
  });

export const savePlatformOrigins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        allowed_origins: z.array(z.string().max(253)).max(50).default([]),
        callback_base_url: z.string().max(253).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<PlatformOriginSettings> => {
    const { assertAnyPermission } = await import("@/lib/admin-users.server");
    await assertAnyPermission(context.supabase, context.userId, ["settings.manage"]);
    const hosts = Array.from(new Set(data.allowed_origins.map(cleanHost).filter(Boolean)));
    const callback = data.callback_base_url.trim().replace(/\/+$/, "");
    const { error } = await context.supabase
      .from("global_settings")
      .update({ allowed_origins: hosts, callback_base_url: callback || null } as any)
      .eq("id", 1);
    if (error) throw new Response(error.message, { status: 400 });
    return { allowed_origins: hosts, callback_base_url: callback };
  });
