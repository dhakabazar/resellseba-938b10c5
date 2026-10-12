export type BodyCategoryItem = { id: string; is_active: boolean };

/** null = never configured; [] = deliberately show no body categories. */
export function readBodyCategoryItems(value: unknown): BodyCategoryItem[] | null {
  if (typeof value !== "string") return null;
  try {
    const rows: unknown = JSON.parse(value);
    if (!Array.isArray(rows)) return null;
    const seen = new Set<string>();
    return rows.flatMap((row) => {
      if (!row || typeof row.id !== "string" || typeof row.is_active !== "boolean" || seen.has(row.id)) return [];
      seen.add(row.id);
      return [{ id: row.id, is_active: row.is_active }];
    });
  } catch {
    return null;
  }
}

export function selectBodyCategories<T extends { id: string }>(categories: T[], items: BodyCategoryItem[] | null): T[] {
  if (items === null) return categories;
  const byId = new Map(categories.map((category) => [category.id, category]));
  return items.flatMap((item) => {
    const category = byId.get(item.id);
    return item.is_active && category ? [category] : [];
  });
}