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
