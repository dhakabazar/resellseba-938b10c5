import { supabase } from "@/integrations/supabase/client";

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function uniqueProductSlug(name: string, ignoreId?: string): Promise<string> {
  const base = slugify(name) || "product";
  let q = supabase.from("products").select("slug").like("slug", `${base}%`);
  if (ignoreId) q = q.neq("id", ignoreId);
  const { data } = await q;
  const taken = new Set((data ?? []).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 1; i < 1000; i++) {
    const cand = `${base}-${i}`;
    if (!taken.has(cand)) return cand;
  }
  return `${base}-${Date.now()}`;
}
