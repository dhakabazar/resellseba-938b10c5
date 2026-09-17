import { supabase } from "@/integrations/supabase/client";

export type MenuKind = "home" | "all_products" | "category" | "product" | "custom";
export const MAX_MENU_DEPTH = 2; // 0 = main, 1 = sub, 2 = child

export type MenuRow = {
  id: string;
  parent_id: string | null;
  label: string;
  kind: MenuKind;
  ref_slug: string | null;
  url: string | null;
  image_url: string | null;
  description: string | null;
  open_new_tab: boolean;
  layout: "dropdown" | "mega";
  sort_order: number;
  is_active: boolean;
};

export type MenuNode = MenuRow & { children: MenuNode[] };
/** Flat editor model: same row plus an explicit indent level. */
export type FlatMenuItem = MenuRow & { depth: number };

export function buildMenuTree(rows: MenuRow[]): MenuNode[] {
  const map = new Map<string, MenuNode>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));
  const roots: MenuNode[] = [];
  rows.forEach((r) => {
    const node = map.get(r.id)!;
    const parent = r.parent_id ? map.get(r.parent_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  const sort = (list: MenuNode[]) => {
    list.sort((a, b) => a.sort_order - b.sort_order);
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/** Tree -> flat (depth) list used by the builder UI. */
export function flattenMenu(nodes: MenuNode[], depth = 0): FlatMenuItem[] {
  const out: FlatMenuItem[] = [];
  nodes.forEach((n) => {
    const { children, ...row } = n;
    out.push({ ...row, depth });
    out.push(...flattenMenu(children, depth + 1));
  });
  return out;
}

/** Flat (depth) list -> rows with parent_id + sort_order, ready to persist. */
export function unflattenMenu(items: FlatMenuItem[]): MenuRow[] {
  const stack: string[] = [];
  const counters = new Map<string, number>();
  return items.map((item) => {
    stack.length = item.depth;
    const parent_id = item.depth > 0 ? (stack[item.depth - 1] ?? null) : null;
    stack[item.depth] = item.id;
    const key = parent_id ?? "root";
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    const { depth: _depth, ...row } = item;
    return { ...row, parent_id, sort_order: next };
  });
}

/** First item is always a root; nothing may skip more than one level. */
export function normalizeDepths(items: FlatMenuItem[]): FlatMenuItem[] {
  let prev = -1;
  return items.map((item) => {
    const depth = Math.min(Math.max(0, item.depth), prev + 1, MAX_MENU_DEPTH);
    prev = depth;
    return item.depth === depth ? item : { ...item, depth };
  });
}

/** Item + everything nested under it (contiguous deeper rows). */
export function subtreeSize(items: FlatMenuItem[], index: number): number {
  const base = items[index]?.depth ?? 0;
  let n = 1;
  while (index + n < items.length && items[index + n].depth > base) n++;
  return n;
}

export function moveMenuItem(items: FlatMenuItem[], from: number, to: number): FlatMenuItem[] {
  const size = subtreeSize(items, from);
  if (to >= from && to <= from + size) return items;
  const block = items.slice(from, from + size);
  const rest = [...items.slice(0, from), ...items.slice(from + size)];
  const target = to > from ? to - size : to;
  rest.splice(Math.max(0, Math.min(rest.length, target)), 0, ...block);
  return normalizeDepths(rest);
}

export function shiftMenuItem(items: FlatMenuItem[], index: number, delta: 1 | -1): FlatMenuItem[] {
  const size = subtreeSize(items, index);
  const current = items[index];
  const prev = items[index - 1];
  const nextDepth = current.depth + delta;
  if (nextDepth < 0 || nextDepth > MAX_MENU_DEPTH) return items;
  if (delta === 1 && (!prev || nextDepth > prev.depth + 1)) return items;
  const copy = [...items];
  for (let i = index; i < index + size; i++) copy[i] = { ...copy[i], depth: copy[i].depth + delta };
  return normalizeDepths(copy);
}

export function newMenuItem(partial: Partial<MenuRow> & { label: string; kind: MenuKind }): FlatMenuItem {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    parent_id: null,
    ref_slug: null,
    url: null,
    image_url: null,
    description: null,
    open_new_tab: false,
    layout: "dropdown",
    sort_order: 0,
    is_active: true,
    depth: 0,
    ...partial,
  } as FlatMenuItem;
}

const COLUMNS =
  "id,parent_id,label,kind,ref_slug,url,image_url,description,open_new_tab,layout,sort_order,is_active";

export async function fetchMenuRows(resellerId: string, activeOnly: boolean): Promise<MenuRow[]> {
  let q = supabase
    .from("reseller_menu_items")
    .select(COLUMNS)
    .eq("reseller_id", resellerId)
    .order("sort_order", { ascending: true });
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return (data ?? []) as unknown as MenuRow[];
}

/** Replaces the whole menu: safe because nothing else references these rows. */
export async function saveMenuRows(resellerId: string, items: FlatMenuItem[]) {
  const rows = unflattenMenu(normalizeDepths(items));
  const del = await supabase.from("reseller_menu_items").delete().eq("reseller_id", resellerId);
  if (del.error) throw del.error;
  const byDepth = new Map<number, typeof rows>();
  normalizeDepths(items).forEach((item, i) => {
    const list = byDepth.get(item.depth) ?? [];
    list.push(rows[i]);
    byDepth.set(item.depth, list);
  });
  for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
    const batch = (byDepth.get(depth) ?? []).map((r) => ({ ...r, reseller_id: resellerId }));
    if (!batch.length) continue;
    const { error } = await supabase.from("reseller_menu_items").insert(batch);
    if (error) throw error;
  }
}

/** Resolved link target for a menu row inside a given store. */
export type MenuTarget =
  | { kind: "route"; to: "/s/$code" | "/s/$code/shop"; params: { code: string }; search?: Record<string, unknown> }
  | { kind: "route-slug"; to: "/s/$code/c/$slug" | "/s/$code/p/$slug"; params: { code: string; slug: string } }
  | { kind: "external"; href: string }
  | { kind: "none" };

export function menuTarget(row: MenuRow, code: string): MenuTarget {
  switch (row.kind) {
    case "home":
      return { kind: "route", to: "/s/$code", params: { code } };
    case "all_products":
      return { kind: "route", to: "/s/$code/shop", params: { code } };
    case "category":
      return row.ref_slug
        ? { kind: "route-slug", to: "/s/$code/c/$slug", params: { code, slug: row.ref_slug } }
        : { kind: "none" };
    case "product":
      return row.ref_slug
        ? { kind: "route-slug", to: "/s/$code/p/$slug", params: { code, slug: row.ref_slug } }
        : { kind: "none" };
    default: {
      const url = row.url?.trim();
      if (!url) return { kind: "none" };
      if (/^https?:\/\//i.test(url) || url.startsWith("tel:") || url.startsWith("mailto:"))
        return { kind: "external", href: url };
      return { kind: "external", href: url.startsWith("/") ? url : `/${url}` };
    }
  }
}
