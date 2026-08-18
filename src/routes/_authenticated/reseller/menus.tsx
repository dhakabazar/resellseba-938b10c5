import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
  Home,
  Layers,
  Link2,
  Loader2,
  Package,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/ui-kit";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import {
  MAX_MENU_DEPTH,
  buildMenuTree,
  fetchMenuRows,
  flattenMenu,
  moveMenuItem,
  newMenuItem,
  saveMenuRows,
  shiftMenuItem,
  subtreeSize,
  type FlatMenuItem,
  type MenuKind,
} from "@/lib/store-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reseller/menus")({
  component: MenusPage,
});

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

type SourceItem = { key: string; label: string; kind: MenuKind; ref_slug?: string | null; image_url?: string | null };

const DEPTH_LABEL = ["Main menu", "Sub menu", "Child menu"];

function MenusPage() {
  const { user } = useAuth();
  const uid = user?.id;

  const [rid, setRid] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [items, setItems] = useState<FlatMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [categories, setCategories] = useState<SourceItem[]>([]);
  const [products, setProducts] = useState<SourceItem[]>([]);
  const [tab, setTab] = useState<"categories" | "products" | "custom">("categories");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [customLabel, setCustomLabel] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    (async () => {
      const { data: r } = await supabase.from("resellers").select("id,code").eq("user_id", uid).maybeSingle();
      if (!alive) return;
      if (!r) return setLoading(false);
      setRid(r.id);
      setCode(r.code);

      const [menu, cats, listings] = await Promise.all([
        fetchMenuRows(r.id, false),
        supabase.from("categories").select("id,name,slug,image_url,sort_order").eq("is_active", true).order("sort_order"),
        supabase
          .from("reseller_listings")
          .select("id, custom_title, product:products(name,slug,is_active)")
          .eq("reseller_id", r.id)
          .eq("is_active", true),
      ]);
      if (!alive) return;

      setItems(flattenMenu(buildMenuTree(menu)));
      setCategories(
        (cats.data ?? []).map((c) => ({
          key: `cat:${c.slug}`,
          label: c.name,
          kind: "category" as MenuKind,
          ref_slug: c.slug,
          image_url: c.image_url,
        })),
      );
      setProducts(
        ((listings.data ?? []) as unknown as {
          id: string;
          custom_title: string | null;
          product: { name: string; slug: string; is_active: boolean } | null;
        }[])
          .filter((l) => l.product?.is_active)
          .map((l) => ({
            key: `prod:${l.product!.slug}`,
            label: l.custom_title || l.product!.name,
            kind: "product" as MenuKind,
            ref_slug: l.product!.slug,
          })),
      );
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  const source = tab === "categories" ? categories : tab === "products" ? products : [];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return source;
    return source.filter((s) => s.label.toLowerCase().includes(needle));
  }, [source, q]);

  function update(next: FlatMenuItem[]) {
    setItems(next);
    setDirty(true);
  }

  function patch(id: string, values: Partial<FlatMenuItem>) {
    update(items.map((it) => (it.id === id ? { ...it, ...values } : it)));
  }

  function addItems(list: SourceItem[]) {
    if (!list.length) return;
    update([
      ...items,
      ...list.map((s) =>
        newMenuItem({ label: s.label, kind: s.kind, ref_slug: s.ref_slug ?? null, image_url: s.image_url ?? null }),
      ),
    ]);
    setPicked({});
    toast.success(`${list.length} item menu te add hoyeche`);
  }

  function removeItem(id: string) {
    const index = items.findIndex((it) => it.id === id);
    if (index < 0) return;
    const size = subtreeSize(items, index);
    update([...items.slice(0, index), ...items.slice(index + size)]);
  }

  async function save() {
    if (!rid) return;
    setBusy(true);
    try {
      await saveMenuRows(rid, items);
      const fresh = await fetchMenuRows(rid, false);
      setItems(flattenMenu(buildMenuTree(fresh)));
      setDirty(false);
      toast.success("Menu save hoyeche");
    } catch (e) {
      toast.error((e as Error).message || "Menu save fail");
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  if (!rid)
    return (
      <div className="surface-card p-8 text-center text-sm text-muted-foreground">
        Store profile পাওয়া যায়নি।
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Header menu builder"
        description="Drag kore menu sajao, sub-menu / child-menu banao ar mega menu on koro — store header ei onujai dekhabe."
        actions={
          <div className="flex items-center gap-2">
            {code && (
              <a
                href={`/s/${code}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Preview store
              </a>
            )}
            <button
              onClick={save}
              disabled={busy || !dirty}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save menu
            </button>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* ---------- left: available links ---------- */}
        <div className="surface-card h-fit p-4">
          <div className="text-sm font-semibold">Add menu items</div>
          <div className="mt-3 flex gap-1 rounded-lg bg-muted p-1 text-xs font-medium">
            {(
              [
                { id: "categories", label: "Categories", icon: <Layers className="h-3.5 w-3.5" /> },
                { id: "products", label: "Products", icon: <Package className="h-3.5 w-3.5" /> },
                { id: "custom", label: "Custom", icon: <Link2 className="h-3.5 w-3.5" /> },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  setPicked({});
                }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 transition",
                  tab === t.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {tab === "custom" ? (
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Menu name</label>
                <input className={inp} value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Offer" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Link</label>
                <input className={inp} value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://… or /s/code/checkout" />
              </div>
              <button
                onClick={() => {
                  if (!customLabel.trim()) return toast.error("Menu name din");
                  update([
                    ...items,
                    newMenuItem({ label: customLabel.trim(), kind: "custom", url: customUrl.trim() || null }),
                  ]);
                  setCustomLabel("");
                  setCustomUrl("");
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> Add custom link
              </button>
              <div className="border-t pt-3">
                <div className="mb-2 text-xs font-medium text-muted-foreground">Quick links</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => addItems([{ key: "home", label: "Home", kind: "home" }])}
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    <Home className="h-3.5 w-3.5" /> Home
                  </button>
                  <button
                    onClick={() => addItems([{ key: "all", label: "All products", kind: "all_products" }])}
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    <Package className="h-3.5 w-3.5" /> All products
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input className={cn(inp, "pl-9")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
              </div>
              <div className="mt-3 max-h-[360px] space-y-1 overflow-y-auto pr-1">
                {filtered.length === 0 && (
                  <div className="py-6 text-center text-xs text-muted-foreground">Kichu pawa jayni</div>
                )}
                {filtered.map((s) => (
                  <label
                    key={s.key}
                    className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      checked={!!picked[s.key]}
                      onChange={(e) => setPicked((p) => ({ ...p, [s.key]: e.target.checked }))}
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                    />
                    {s.image_url && <img src={s.image_url} alt="" className="h-7 w-7 rounded object-cover" />}
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={() => addItems(filtered.filter((s) => picked[s.key]))}
                disabled={!filtered.some((s) => picked[s.key])}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add to menu
              </button>
            </>
          )}
        </div>

        {/* ---------- right: active header menu ---------- */}
        <div className="surface-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Active header menu</div>
              <div className="text-xs text-muted-foreground">
                Drag kore order & nesting change koro. Arrow diyeo sub/child banate paro (max {MAX_MENU_DEPTH + 1} level).
              </div>
            </div>
            {dirty && <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-600">Unsaved</span>}
          </div>

          {items.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
              Ekhono kono menu nai — bam pash theke item add koro. Menu khali thakle store e category list auto dekhabe.
            </div>
          ) : (
            <div className="mt-4 space-y-1.5">
              {items.map((item, index) => {
                const open = openId === item.id;
                return (
                  <div
                    key={item.id}
                    style={{ marginLeft: item.depth * 26 }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOverIndex(index);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex != null && dragIndex !== index) update(moveMenuItem(items, dragIndex, index));
                      setDragIndex(null);
                      setOverIndex(null);
                    }}
                    className={cn(
                      "rounded-lg border bg-background transition",
                      overIndex === index && dragIndex != null && "border-primary ring-2 ring-primary/30",
                      dragIndex === index && "opacity-50",
                      !item.is_active && "opacity-60",
                    )}
                  >
                    <div className="flex items-center gap-2 px-2 py-2">
                      <span
                        draggable
                        onDragStart={() => setDragIndex(index)}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setOverIndex(null);
                        }}
                        className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
                        title="Drag"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                      {item.image_url && <img src={item.image_url} alt="" className="h-7 w-7 rounded object-cover" />}
                      <button
                        onClick={() => setOpenId(open ? null : item.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="truncate text-sm font-medium">{item.label}</span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {DEPTH_LABEL[item.depth]}
                        </span>
                        {item.depth === 0 && item.layout === "mega" && (
                          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Mega
                          </span>
                        )}
                        {open ? <ChevronDown className="ml-auto h-4 w-4 shrink-0" /> : <ChevronRight className="ml-auto h-4 w-4 shrink-0" />}
                      </button>
                      <button
                        onClick={() => update(shiftMenuItem(items, index, -1))}
                        disabled={item.depth === 0}
                        title="Outdent"
                        className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => update(shiftMenuItem(items, index, 1))}
                        disabled={index === 0 || item.depth > (items[index - 1]?.depth ?? 0) || item.depth >= MAX_MENU_DEPTH}
                        title="Indent (sub menu)"
                        className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setRemoveId(item.id)}
                        title="Remove"
                        className="rounded p-1 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {open && (
                      <div className="grid gap-3 border-t px-3 py-3 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Menu name</label>
                          <input className={inp} value={item.label} onChange={(e) => patch(item.id, { label: e.target.value })} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            {item.kind === "custom" ? "Link URL" : "Target"}
                          </label>
                          {item.kind === "custom" ? (
                            <input
                              className={inp}
                              value={item.url ?? ""}
                              onChange={(e) => patch(item.id, { url: e.target.value })}
                              placeholder="https://…"
                            />
                          ) : (
                            <input
                              className={cn(inp, "bg-muted/50 text-muted-foreground")}
                              readOnly
                              value={
                                item.kind === "category"
                                  ? `Category: ${item.ref_slug}`
                                  : item.kind === "product"
                                    ? `Product: ${item.ref_slug}`
                                    : item.kind === "home"
                                      ? "Store home"
                                      : "All products"
                              }
                            />
                          )}
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            Short description (mega menu te dekhabe)
                          </label>
                          <input
                            className={inp}
                            value={item.description ?? ""}
                            onChange={(e) => patch(item.id, { description: e.target.value })}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Menu image</label>
                          <ImageUploader
                            bucket="branding"
                            folder={`${rid}/menu`}
                            value={item.image_url ? ([{ path: "", url: item.image_url, bytes: 0 }] as UploadedImage[]) : []}
                            onChange={(v) => patch(item.id, { image_url: v[0]?.url ?? null })}
                            label="Upload menu image"
                            variant="square"
                            maxImages={1}
                            hint="Mega menu te thumbnail hisebe dekhabe"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={item.is_active}
                              onChange={(e) => patch(item.id, { is_active: e.target.checked })}
                              className="h-4 w-4"
                            />
                            Active
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={item.open_new_tab}
                              onChange={(e) => patch(item.id, { open_new_tab: e.target.checked })}
                              className="h-4 w-4"
                            />
                            New tab
                          </label>
                          {item.depth === 0 && (
                            <label className="inline-flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={item.layout === "mega"}
                                onChange={(e) => patch(item.id, { layout: e.target.checked ? "mega" : "dropdown" })}
                                className="h-4 w-4"
                              />
                              Mega menu
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* drop zone at the very end */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverIndex(items.length);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex != null) update(moveMenuItem(items, dragIndex, items.length));
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className={cn(
                  "rounded-lg border border-dashed py-3 text-center text-xs text-muted-foreground",
                  overIndex === items.length && dragIndex != null && "border-primary text-primary",
                )}
              >
                Drop here to move to the end
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={removeId != null}
        title="Menu item remove?"
        description="Ei item ar er niche thaka sob sub-menu remove hoye jabe."
        confirmText="Remove"
        variant="danger"
        onClose={() => setRemoveId(null)}
        onConfirm={() => {
          if (removeId) removeItem(removeId);
          setRemoveId(null);
        }}
      />
    </div>
  );
}
