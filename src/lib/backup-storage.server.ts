// Server-only storage helpers for the image backup / restore tool.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type StorageFile = { path: string; size: number };

async function listFolder(bucket: string, prefix: string, out: StorageFile[]) {
  let offset = 0;
  const limit = 1000;
  for (;;) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Response(error.message, { status: 400 });
    const rows = data ?? [];
    for (const item of rows) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      // Folders come back without metadata/id.
      if (!item.id && !(item as any).metadata) {
        await listFolder(bucket, full, out);
      } else {
        out.push({ path: full, size: Number((item as any).metadata?.size ?? 0) });
      }
    }
    if (rows.length < limit) break;
    offset += limit;
  }
}

export async function listAllFiles() {
  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) throw new Response(error.message, { status: 400 });
  const result = [];
  for (const b of buckets ?? []) {
    const files: StorageFile[] = [];
    await listFolder(b.id, "", files);
    result.push({ id: b.id, public: !!b.public, files });
  }
  return { buckets: result };
}

export async function readFile(bucket: string, path: string) {
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
  if (error) throw new Response(error.message, { status: 400 });
  const buf = Buffer.from(await data.arrayBuffer());
  return { base64: buf.toString("base64"), contentType: data.type || "application/octet-stream" };
}

/** Creates any bucket that does not exist yet, so a fresh project needs no manual setup. */
export async function ensureBuckets(buckets: { id: string; public: boolean }[]) {
  const { data: existing } = await supabaseAdmin.storage.listBuckets();
  const have = new Set((existing ?? []).map((b) => b.id));
  for (const b of buckets) {
    if (have.has(b.id)) continue;
    const { error } = await supabaseAdmin.storage.createBucket(b.id, { public: b.public });
    if (error && !/already exists/i.test(error.message)) {
      throw new Response(`Bucket ${b.id}: ${error.message}`, { status: 400 });
    }
  }
}

export async function writeFile(bucket: string, path: string, base64: string, contentType?: string) {
  const bytes = Buffer.from(base64, "base64");
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, bytes, {
    contentType: contentType || "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Response(error.message, { status: 400 });
}
