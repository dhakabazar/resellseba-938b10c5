import { supabase } from "@/integrations/supabase/client";

/** A product may sit in many categories; the first one is its primary/display category. */
export type WithCategories = { category_id?: string | null; category_ids?: string[] | null };

/** All category ids of a product (falls back to the legacy single column). */
export function categoryIdsOf(p: WithCategories): string[] {
  const many = (p.category_ids ?? []).filter(Boolean) as string[];
  if (many.length) return many;
  return p.category_id ? [p.category_id] : [];
}

/** True when the product belongs to the given category id (any of its categories). */
export function inCategory(p: WithCategories, categoryId: string): boolean {
  if (!categoryId) return true;
  return categoryIdsOf(p).includes(categoryId);
}

/**
 * Replace a product's category links. `ids[0]` becomes the primary category
 * stored on products.category_id so older code paths keep working.
 */
export async function saveProductCategories(productId: string, ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  await supabase.from("product_categories").delete().eq("product_id", productId);
  if (unique.length) {
    const { error } = await supabase
      .from("product_categories")
      .insert(unique.map((category_id) => ({ product_id: productId, category_id })));
    if (error) throw new Error(error.message || "Failed to save categories");
  }
}

/** Load a product's category ids, primary first. */
export async function loadProductCategories(productId: string, primary?: string | null) {
  const { data } = await supabase.from("product_categories").select("category_id").eq("product_id", productId);
  const ids = (data ?? []).map((r) => r.category_id as string);
  if (primary && !ids.includes(primary)) ids.unshift(primary);
  return primary ? [primary, ...ids.filter((i) => i !== primary)] : ids;
}
