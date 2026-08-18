import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Plus, Loader2, Pencil, Trash2, Eye, EyeOff, Check, X, CheckSquare, Square, Copy, Download, CloudDownload } from "lucide-react";
import { toast } from "sonner";
import {
  DataToolbar,
  Pagination,
  ActionMenu,
  usePaginated,
  type FilterDef,
} from "@/components/data-list";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { CopyButton, ImageDownloadTools, stripHtml } from "@/components/store/reseller-tools";
import { ProductImportModal } from "@/components/ProductImportModal";

type Row = {
  id: string;
  product_code: string;
  name: string;
  buying_price: number;
  reseller_price: number;
  suggested_price: number;
  stock: number;
  is_active: boolean;
  is_featured: boolean;
  og_image_url: string | null;
  brand_id: string | null;
  category_id: string | null;
};

type Opt = { id: string; name: string };

type ProductSearch = { status?: string; stock?: string; category?: string; brand?: string };

export const Route = createFileRoute("/_authenticated/admin/products/")({
  validateSearch: (s: Record<string, unknown>): ProductSearch => ({
    status: typeof s.status === "string" ? s.status : undefined,
    stock: typeof s.stock === "string" ? s.stock : undefined,
    category: typeof s.category === "string" ? s.category : undefined,
    brand: typeof s.brand === "string" ? s.brand : undefined,
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const nav = useNavigate();
  const search = Route.useSearch();
  const [items, setItems] = useState<Row[]>([]);
  const [brands, setBrands] = useState<Opt[]>([]);
  const [categories, setCategories] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const [q, setQ] = useState("");
  const [brand, setBrand] = useState(search.brand ?? "");
  const [category, setCategory] = useState(search.category ?? "");
  const [status, setStatus] = useState(search.status ?? "");
  const [stockFilter, setStockFilter] = useState(search.stock ?? "");

  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: b }, { data: c }] = await Promise.all([
      supabase
        .from("products")
        .select("id,product_code,name,buying_price,reseller_price,suggested_price,stock,is_active,is_featured,og_image_url,brand_id,category_id")
        .order("created_at", { ascending: false }),
      supabase.from("brands").select("id,name").order("name"),
      supabase.from("categories").select("id,name").order("name"),
    ]);
    setItems((p ?? []) as Row[]);
    setBrands((b ?? []) as Opt[]);
    setCategories((c ?? []) as Opt[]);
    setLoading(false);
  }
  useEffect(() => {
    if (items.length === 0) {
      load();
    }
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, brand, category, status, stockFilter, perPage]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  async function toggle(p: Row) {
    const { error } = await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    setItems((s) => s.map((i) => (i.id === p.id ? { ...i, is_active: !p.is_active } : i)));
  }
  async function remove(p: Row) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setItems((s) => s.filter((i) => i.id !== p.id));
    setSelected((s) => {
      const n = new Set(s);
      n.delete(p.id);
      return n;
    });
  }

  async function bulkSetActive(active: boolean) {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBulkBusy(true);
    const { error } = await supabase.from("products").update({ is_active: active }).in("id", ids);
    setBulkBusy(false);
    if (error) return toast.error(error.message);
    setItems((s) => s.map((i) => (ids.includes(i.id) ? { ...i, is_active: active } : i)));
    toast.success(`${ids.length} product ${active ? "activated" : "hidden"}`);
    setSelected(new Set());
  }
  async function bulkDelete() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} product? Products used in orders are protected.`)) return;
    setBulkBusy(true);
    const { error } = await supabase.from("products").delete().in("id", ids);
    setBulkBusy(false);
    if (error) return toast.error(error.message);
    setItems((s) => s.filter((i) => !ids.includes(i.id)));
    toast.success(`${ids.length} product deleted`);
    setSelected(new Set());
  }

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (q) {
        const t = q.toLowerCase();
        if (!i.name.toLowerCase().includes(t) && !i.product_code.includes(t)) return false;
      }
      if (brand && i.brand_id !== brand) return false;
      if (category && i.category_id !== category) return false;
      if (status === "active" && !i.is_active) return false;
      if (status === "hidden" && i.is_active) return false;
      if (status === "featured" && !i.is_featured) return false;
      if (stockFilter === "out" && i.stock > 0) return false;
      if (stockFilter === "low" && (i.stock === 0 || i.stock > 5)) return false;
      if (stockFilter === "in" && i.stock <= 0) return false;
      return true;
    });
  }, [items, q, brand, category, status, stockFilter]);

  const paged = usePaginated(filtered, page, perPage);


  const filters: FilterDef[] = [
    {
      key: "brand",
      label: "Brand",
      value: brand,
      onChange: setBrand,
      options: brands.map((b) => ({ value: b.id, label: b.name })),
    },
    {
      key: "category",
      label: "Category",
      value: category,
      onChange: setCategory,
      options: categories.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      key: "status",
      label: "Status",
      value: status,
      onChange: setStatus,
      options: [
        { value: "active", label: "Active" },
        { value: "hidden", label: "Hidden" },
        { value: "featured", label: "Featured" },
      ],
    },
    {
      key: "stock",
      label: "Stock",
      value: stockFilter,
      onChange: setStockFilter,
      options: [
        { value: "in", label: "In stock" },
        { value: "low", label: "Low (≤5)" },
        { value: "out", label: "Out of stock" },
      ],
    },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        description="Master catalog resellers create listings from."
        actions={
          <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <CloudDownload className="h-4 w-4" /> Import from URL
          </button>
          <Link
            to="/admin/products/new"
            className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> New product
          </Link>
          </div>
        }
      />

      <ProductImportModal open={importOpen} onClose={() => setImportOpen(false)} onSaved={() => load()} />

      <DataToolbar
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search by name or ID…"
        filters={filters}
        perPage={perPage}
        onPerPage={setPerPage}
      />

      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No products match"
          description="Try changing filters or add a new product."
          action={
            <Link
              to="/admin/products/new"
              className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" /> Add product
            </Link>
          }
        />
      ) : (
        <>
          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-primary/5 px-3 py-2 text-sm">
              <span className="font-medium">{selected.size} selected</span>
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  disabled={bulkBusy}
                  onClick={() => bulkSetActive(true)}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-background disabled:opacity-50"
                >
                  <Eye className="h-3.5 w-3.5" /> Activate
                </button>
                <button
                  disabled={bulkBusy}
                  onClick={() => bulkSetActive(false)}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-background disabled:opacity-50"
                >
                  <EyeOff className="h-3.5 w-3.5" /> Hide
                </button>
                <button
                  disabled={bulkBusy}
                  onClick={bulkDelete}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          <div className="surface-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-8 px-2 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        const pageIds = paged.map((p) => p.id);
                        const allChecked = pageIds.every((id) => selected.has(id));
                        setSelected((s) => {
                          const n = new Set(s);
                          if (allChecked) pageIds.forEach((id) => n.delete(id));
                          else pageIds.forEach((id) => n.add(id));
                          return n;
                        });
                      }}
                      className="text-muted-foreground hover:text-primary"
                      aria-label="Select all on page"
                    >
                      {paged.length > 0 && paged.every((p) => selected.has(p.id)) ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="min-w-[240px] px-3 py-3">Product</th>
                  <th className="px-3 py-3">Admin cost</th>
                  <th className="px-3 py-3">Reseller</th>
                  <th className="px-3 py-3">Suggested</th>
                  <th className="px-3 py-3">Stock</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.map((p) => (
                  <tr key={p.id} className={`hover:bg-muted/50 ${selected.has(p.id) ? "bg-primary/5" : ""}`}>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setSelected((s) => {
                            const n = new Set(s);
                            if (n.has(p.id)) n.delete(p.id);
                            else n.add(p.id);
                            return n;
                          })
                        }
                        className="text-muted-foreground hover:text-primary"
                        aria-label="Select"
                      >
                        {selected.has(p.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="min-w-[240px] px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                          onClick={() => setDetailId(p.id)}
                        >
                          {p.og_image_url && (
                            <img src={p.og_image_url} className="h-full w-full object-cover" alt="" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div 
                            className="font-medium truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => setDetailId(p.id)}
                          >
                            {p.name}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-medium">
                              ID #{p.product_code}
                            </span>
                            {p.brand_id && brands.find((b) => b.id === p.brand_id) && (
                              <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5">
                                {brands.find((b) => b.id === p.brand_id)!.name}
                              </span>
                            )}
                            {p.category_id && categories.find((c) => c.id === p.category_id) && (
                              <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5">
                                {categories.find((c) => c.id === p.category_id)!.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">৳{p.buying_price}</td>
                    <td className="px-3 py-3">৳{p.reseller_price}</td>
                    <td className="px-3 py-3">৳{p.suggested_price}</td>
                    <td className="px-3 py-3">
                      <StockCell row={p} onSaved={(v) => setItems((s) => s.map((i) => (i.id === p.id ? { ...i, stock: v } : i)))} />
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.is_active
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${p.is_active ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                        {p.is_active ? "Active" : "Hidden"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end">
                        <ActionMenu>
                          <DropdownMenuItem onSelect={() => setDetailId(p.id)}>
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => nav({ to: "/admin/products/$id/edit", params: { id: p.id } })}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => toggle(p)}>
                            {p.is_active ? (
                              <>
                                <EyeOff className="mr-2 h-4 w-4" /> Hide
                              </>
                            ) : (
                              <>
                                <Eye className="mr-2 h-4 w-4" /> Show
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => remove(p)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </ActionMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} perPage={perPage} total={filtered.length} onPage={setPage} />
        </>
      )}
      {detailId && (
        <ProductDetailModal 
          id={detailId} 
          onClose={() => setDetailId(null)} 
          brands={brands} 
          categories={categories} 
        />
      )}
    </div>
  );
}

function ProductDetailModal({ 
  id, 
  onClose, 
  brands, 
  categories 
}: { 
  id: string; 
  onClose: () => void; 
  brands: Opt[]; 
  categories: Opt[] 
}) {
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<{url: string}[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("products")
        .select("*, product_images(url)")
        .eq("id", id)
        .single();
      if (data) {
        setP(data);
        setImages(data.product_images || []);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm">
      <Loader2 className="h-8 w-8 animate-spin text-white" />
    </div>
  );

  if (!p) return null;

  const brandName = brands.find(b => b.id === p.brand_id)?.name;
  const categoryName = categories.find(c => c.id === p.category_id)?.name;
  const imageUrls = [p.og_image_url, ...images.map(i => i.url)].filter(Boolean) as string[];
  const detailsText = stripHtml([p.short_description, p.description].filter(Boolean).join("\n\n"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-4xl surface-card max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur-md">
          <h3 className="text-lg font-bold">Product Details</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
                {p.og_image_url ? (
                  <img src={p.og_image_url} className="h-full w-full object-cover" alt="" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground">No image</div>
                )}
                <div className="absolute right-3 top-3 flex flex-col gap-2">
                  <ImageDownloadTools compact images={imageUrls} activeUrl={p.og_image_url} baseName={p.name} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={i} className="h-16 w-16 overflow-hidden rounded-lg border bg-muted">
                    <img src={img.url} className="h-full w-full object-cover" alt="" />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-2xl font-bold">{p.name}</h1>
                  <CopyButton value={p.name} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    ID #{p.product_code}
                  </span>
                  {brandName && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{brandName}</span>}
                  {categoryName && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{categoryName}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-xl border bg-muted/30 p-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Buying Price</div>
                  <div className="text-lg font-bold">৳{p.buying_price}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reseller Price</div>
                  <div className="text-lg font-bold">৳{p.reseller_price}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Suggested Sell</div>
                  <div className="text-lg font-bold">৳{p.suggested_price}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stock Available</div>
                  <div className={`text-lg font-bold ${p.stock <= 5 ? "text-destructive" : ""}`}>{p.stock} units</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold">Description</h4>
                  <CopyButton value={detailsText} label="details" />
                </div>
                <div className="prose prose-sm max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: p.description || p.short_description || 'No description provided.' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StockCell({ row, onSaved }: { row: Row; onSaved: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(row.stock));
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function save() {
    const n = Math.max(0, Math.floor(Number(val)));
    if (Number.isNaN(n)) return toast.error("Invalid stock");
    if (n === row.stock) return setEditing(false);
    setBusy(true);
    const { error } = await supabase.from("products").update({ stock: n }).eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    onSaved(n);
    setEditing(false);
    toast.success("Stock updated");
  }

  if (!editing) {
    return (
      <button
        onClick={() => {
          setVal(String(row.stock));
          setEditing(true);
        }}
        className={`rounded-md border border-dashed px-2 py-0.5 text-xs hover:border-primary hover:text-primary ${
          row.stock === 0 ? "text-destructive" : row.stock <= 5 ? "text-warning" : ""
        }`}
        title="Click to edit stock"
      >
        {row.stock}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="number"
        min={0}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-20 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <button onClick={save} disabled={busy} className="rounded-md p-1 text-primary hover:bg-primary/10">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </button>
      <button onClick={() => setEditing(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
