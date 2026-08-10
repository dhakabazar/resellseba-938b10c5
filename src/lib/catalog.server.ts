// Server-only helpers for catalog server functions.
export type ImgRow = { url: string; is_primary: boolean; sort_order: number };

export function pickImage(imgs: ImgRow[] | null | undefined) {
  const list = [...(imgs ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  return list[0]?.url ?? null;
}
