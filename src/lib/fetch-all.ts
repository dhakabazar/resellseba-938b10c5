/**
 * The Data API caps every single response at 1000 rows, so a plain
 * `select()` silently truncates big tables. These helpers page through the
 * result with `.range()` until every row is loaded.
 */

const CHUNK = 1000;

/**
 * `make()` must build a fresh query (table select or rpc) each call so we can
 * apply a different range to it.
 */
export async function fetchAll<T = any>(make: () => any, chunk = CHUNK): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += chunk) {
    const { data, error } = await make().range(from, from + chunk - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < chunk) break;
  }
  return out;
}

/** Same as fetchAll but never throws — mirrors the `{ data }` shape. */
export async function fetchAllSafe<T = any>(make: () => any, chunk = CHUNK): Promise<T[]> {
  try {
    return await fetchAll<T>(make, chunk);
  } catch {
    return [];
  }
}

/** Split an id list into <=1000 sized chunks for `.in()` filters. */
export function chunkIds<T>(ids: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/** Run an `.in(column, ids)` select over unlimited ids. */
export async function fetchAllIn<T = any>(
  make: (ids: any[]) => any,
  ids: any[],
  size = CHUNK,
): Promise<T[]> {
  const out: T[] = [];
  for (const part of chunkIds(ids, size)) {
    const rows = await fetchAllSafe<T>(() => make(part), size);
    out.push(...rows);
  }
  return out;
}
