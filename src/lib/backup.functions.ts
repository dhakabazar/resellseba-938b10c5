import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAnyPermission } from "@/lib/admin-users.server";

const PERMS = ["backup.manage", "settings.manage"];

export type BackupManifest = {
  version: number;
  generated_at: string;
  users: number;
  tables: { name: string; rows: number }[];
};

export type ImageManifest = {
  buckets: { id: string; public: boolean; files: { path: string; size: number }[] }[];
};

/** Every table with its row count — read live from the database, so new tables are included automatically. */
export const backupManifest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BackupManifest> => {
    await assertAnyPermission(context.supabase, context.userId, PERMS);
    const { data, error } = await (context.supabase as any).rpc("backup_manifest");
    if (error) throw new Response(error.message, { status: 400 });
    return data as BackupManifest;
  });

export const backupRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { table: string; offset: number; limit: number }) => d)
  .handler(async ({ data, context }): Promise<any[]> => {
    await assertAnyPermission(context.supabase, context.userId, PERMS);
    const { data: rows, error } = await (context.supabase as any).rpc("backup_rows", {
      _table: data.table,
      _offset: data.offset,
      _limit: data.limit,
    });
    if (error) throw new Response(error.message, { status: 400 });
    return (rows ?? []) as any[];
  });

export const backupUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { offset: number; limit: number }) => d)
  .handler(async ({ data, context }): Promise<any[]> => {
    await assertAnyPermission(context.supabase, context.userId, PERMS);
    const { data: rows, error } = await (context.supabase as any).rpc("backup_auth_users", {
      _offset: data.offset,
      _limit: data.limit,
    });
    if (error) throw new Response(error.message, { status: 400 });
    return (rows ?? []) as any[];
  });

export const restoreTriggers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAnyPermission(context.supabase, context.userId, PERMS);
    const { error } = await (context.supabase as any).rpc("restore_set_triggers", { _enabled: data.enabled });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const restoreWipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tables: string[] | null }) => d)
  .handler(async ({ data, context }) => {
    await assertAnyPermission(context.supabase, context.userId, PERMS);
    const { error } = await (context.supabase as any).rpc("restore_wipe", { _tables: data.tables });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const restoreRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { table: string; rows: any[] }) => d)
  .handler(async ({ data, context }): Promise<{ written: number }> => {
    await assertAnyPermission(context.supabase, context.userId, PERMS);
    const { data: n, error } = await (context.supabase as any).rpc("restore_rows", {
      _table: data.table,
      _rows: data.rows,
    });
    if (error) throw new Response(error.message, { status: 400 });
    return { written: Number(n ?? 0) };
  });

export const restoreUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rows: any[] }) => d)
  .handler(async ({ data, context }): Promise<{ written: number }> => {
    await assertAnyPermission(context.supabase, context.userId, PERMS);
    const { data: n, error } = await (context.supabase as any).rpc("restore_auth_users", { _rows: data.rows });
    if (error) throw new Response(error.message, { status: 400 });
    return { written: Number(n ?? 0) };
  });

/* ------------------------------- images ---------------------------------- */

export const imageManifest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImageManifest> => {
    await assertAnyPermission(context.supabase, context.userId, PERMS);
    const db = context.supabase as any;
    const buckets = await db.rpc("backup_storage_buckets");
    if (buckets.error) throw new Response(buckets.error.message, { status: 400 });

    const map = new Map<string, { id: string; public: boolean; files: { path: string; size: number }[] }>();
    for (const b of buckets.data ?? []) map.set(b.id, { id: b.id, public: !!b.is_public, files: [] });

    // The data API returns at most 1000 rows per request, so page through every file.
    const PAGE_SIZE = 1000;
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db.rpc("backup_storage_objects").range(from, from + PAGE_SIZE - 1);
      if (error) throw new Response(error.message, { status: 400 });
      const rows = data ?? [];
      for (const o of rows) {
        if (!map.has(o.bucket_id)) map.set(o.bucket_id, { id: o.bucket_id, public: !!o.is_public, files: [] });
        map.get(o.bucket_id)!.files.push({ path: o.name, size: Number(o.size ?? 0) });
      }
      if (rows.length < PAGE_SIZE) break;
    }
    return { buckets: Array.from(map.values()) };
  });

export const imageRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bucket: string; path: string }) => d)
  .handler(async ({ data, context }): Promise<{ base64: string; contentType: string }> => {
    await assertAnyPermission(context.supabase, context.userId, PERMS);
    const { data: file, error } = await context.supabase.storage.from(data.bucket).download(data.path);
    if (error) throw new Response(error.message, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    return { base64: bytes.toString("base64"), contentType: file.type || "application/octet-stream" };
  });

export const imageEnsureBuckets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { buckets: { id: string; public: boolean }[] }) => d)
  .handler(async ({ data, context }) => {
    await assertAnyPermission(context.supabase, context.userId, PERMS);
    const { data: current, error } = await (context.supabase as any).rpc("backup_storage_buckets");
    if (error) throw new Response(error.message, { status: 400 });
    const existing = new Set((current ?? []).map((bucket: { id: string }) => bucket.id));
    const missing = data.buckets.filter((bucket) => !existing.has(bucket.id));
    if (missing.length === 0) return { ok: true, created: [] as string[], missing: [] as string[] };

    // Try to create missing buckets with the privileged key (works on a fresh server
    // with full env access; custom domains forward here too via the platform origin).
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const created: string[] = [];
      const failed: string[] = [];
      for (const bucket of missing) {
        const res = await supabaseAdmin.storage.createBucket(bucket.id, { public: !!bucket.public });
        if (res.error) failed.push(bucket.id);
        else created.push(bucket.id);
      }
      if (failed.length > 0) {
        throw new Response(
          `Could not create image folder(s): ${failed.join(", ")}. Create them manually from Storage, then restore again.`,
          { status: 400 },
        );
      }
      return { ok: true, created, missing: [] as string[] };
    } catch (e) {
      if (e instanceof Response) throw e;
      // No privileged key on this host — tell the admin exactly what to create.
      const names = missing.map((bucket) => `${bucket.id}${bucket.public ? " (public)" : ""}`).join(", ");
      throw new Response(
        `নতুন সার্ভারে এই image folder গুলো নেই: ${names}. আগে Storage থেকে folder গুলো বানিয়ে আবার restore করুন।`,
        { status: 400 },
      );
    }
  });

export const imageWrite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bucket: string; path: string; base64: string; contentType?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAnyPermission(context.supabase, context.userId, PERMS);
    const bytes = Buffer.from(data.base64, "base64");
    const { error } = await context.supabase.storage.from(data.bucket).upload(data.path, bytes, {
      contentType: data.contentType || "application/octet-stream",
      upsert: true,
    });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });
