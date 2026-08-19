import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MaskedCfConfig } from "@/lib/cloudflare.server";

export type DomainRow = {
  id: string;
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
  last_error: string | null;
  last_checked_at: string | null;
  verified_at: string | null;
  created_at: string;
};

export type DnsGuide = { cnameTarget: string; aRecordIp: string; zoneName: string; active: boolean };

/** Masked Cloudflare credentials for the admin settings screen. */
export const getCloudflareConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MaskedCfConfig> => {
    const { assertAnyPermission } = await import("@/lib/admin-users.server");
    await assertAnyPermission(context.supabase, context.userId, ["settings.manage"]);
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
        is_active: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<MaskedCfConfig> => {
    const { assertAnyPermission } = await import("@/lib/admin-users.server");
    await assertAnyPermission(context.supabase, context.userId, ["settings.manage"]);
    const { loadConfigAsCaller, maskConfig } = await import("@/lib/cloudflare.server");

    const { error } = await context.supabase.rpc("cf_config_save", {
      _api_token: (data.api_token ?? "").trim(),
      _account_id: data.account_id.trim(),
      _zone_id: data.zone_id.trim(),
      _zone_name: data.zone_name.trim(),
      _worker_name: data.worker_name.trim(),
      _cname_target: data.cname_target.trim(),
      _a_record_ip: data.a_record_ip.trim(),
      _auto_worker_domain: data.auto_worker_domain,
      _is_active: data.is_active,
    });
    if (error) throw new Response(error.message, { status: 400 });
    return maskConfig(await loadConfigAsCaller(context.supabase));
  });

/** Check the stored token / zone / account against Cloudflare. */
export const testCloudflareConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ token: boolean; zone: string | null; account: string | null }> => {
    const { assertAnyPermission } = await import("@/lib/admin-users.server");
    await assertAnyPermission(context.supabase, context.userId, ["settings.manage"]);
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
    _permissions: ["settings.manage", "resellers.manage"],
  });
  return !!data;
}

/** Which reseller the caller may act on. */
async function resolveReseller(ctx: Ctx, resellerId?: string) {
  const { data: own } = await ctx.supabase.from("resellers").select("id").eq("user_id", ctx.userId).maybeSingle();
  if (resellerId && own?.id === resellerId) return resellerId;
  if (resellerId) {
    if (!(await isAdmin(ctx))) throw new Response("Forbidden", { status: 403 });
    return resellerId;
  }
  if (!own?.id) throw new Response("No reseller store found for this account", { status: 400 });
  return own.id as string;
}

async function loadDomainForCaller(ctx: Ctx, id: string) {
  const { data: row, error } = await ctx.supabase.from("reseller_domains").select("*").eq("id", id).maybeSingle();
  if (error) throw new Response(error.message, { status: 400 });
  if (!row) throw new Response("Domain not found", { status: 404 });
  const { data: own } = await ctx.supabase.from("resellers").select("id").eq("user_id", ctx.userId).maybeSingle();
  if (own?.id !== row.reseller_id && !(await isAdmin(ctx))) throw new Response("Forbidden", { status: 403 });
  return row as any;
}

function mapRow(row: any, reseller?: { business_name?: string | null; code?: string | null } | null): DomainRow {
  return {
    id: row.id,
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
    const { data: rows, error } = await query;
    if (error) throw new Response(error.message, { status: 400 });

    const ids = [...new Set((rows ?? []).map((r: any) => r.reseller_id))];
    const { data: resellers } = ids.length
      ? await db.from("resellers").select("id, business_name, code").in("id", ids)
      : { data: [] as any[] };
    const byId = new Map((resellers ?? []).map((r: any) => [r.id, r]));
    return (rows ?? []).map((r: any) => mapRow(r, byId.get(r.reseller_id)));
  });

/** Add a hostname and provision it on Cloudflare. */
export const connectDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ hostname: z.string().max(300), resellerId: z.string().uuid().optional() }).parse(d))
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

    const conf = cf.requireActiveConfig(await cf.loadConfigAsCaller(db));
    const state = await cf.createCustomHostname(conf, hostname);
    let workerDomainId: string | null = null;
    try {
      workerDomainId = await cf.attachWorkerDomain(conf, hostname);
    } catch (err) {
      console.error("worker domain attach failed", err);
    }

    const { count } = await db
      .from("reseller_domains")
      .select("id", { count: "exact", head: true })
      .eq("reseller_id", resellerId);

    const { data: row, error } = await db
      .from("reseller_domains")
      .insert({
        reseller_id: resellerId,
        hostname,
        is_primary: (count ?? 0) === 0,
        ssl_status: state.sslStatus,
        ownership_status: state.ownershipStatus,
        cloudflare_hostname_id: state.id,
        worker_domain_id: workerDomainId,
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
      await cf.deleteCustomHostname(conf, state.id);
      throw new Response(error.message, { status: 400 });
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
    const conf = cf.requireActiveConfig(await cf.loadConfigAsCaller(db));

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

    const { data: updated, error } = await db
      .from("reseller_domains")
      .update({
        cloudflare_hostname_id: state.id,
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

/** Remove the domain from Cloudflare (hostname + worker domain) and from the DB. */
export const disconnectDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const cf = await import("@/lib/cloudflare.server");
    const db = context.supabase;
    const row = await loadDomainForCaller({ supabase: context.supabase, userId: context.userId }, data.id);
    const conf = await cf.loadConfigAsCaller(db);

    if (conf.api_token && conf.zone_id && row.cloudflare_hostname_id)
      await cf.deleteCustomHostname(conf, row.cloudflare_hostname_id);
    if (conf.api_token && row.worker_domain_id) await cf.detachWorkerDomain(conf, row.worker_domain_id);

    const { error } = await db.from("reseller_domains").delete().eq("id", row.id);
    if (error) throw new Response(error.message, { status: 400 });

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
