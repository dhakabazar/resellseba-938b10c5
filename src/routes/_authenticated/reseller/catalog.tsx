import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deliveryLabel, deliveryMode } from "@/lib/delivery";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Loader2, Plus, Check, CheckSquare, Square, Trash2, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { Hint } from "@/components/Hint";
import { ResellerProductCalc } from "@/components/price-breakdown";
import { DataToolbar, Pagination, usePaginated, type FilterDef } from "@/components/data-list";
import { CopyButton, ImageDownloadTools, stripHtml } from "@/components/store/reseller-tools";

type P = {
  id: string;
  name: string;
  slug: string;
  reseller_price: number;
  packaging_cost: number;
  delivery_inside: number;
  delivery_outside: number;
  delivery_mode: string | null;
  delivery_flat: number | null;
  suggested_price: number;
  stock: number;
  og_image_url: string | null;
  brand_id: string | null;
  category_id: string | null;
};
type Opt = { id: string; name: string };

export const Route = createFileRoute("/_authenticated/reseller/catalog")({
  component: CatalogPage,
});

function CatalogPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<P[]>([]);
  const [brands, setBrands] = useState<Opt[]>([]);
  const [categories, setCategories] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [listed, setListed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<P | null>(null);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [avail, setAvail] = useState("");
  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: r } = await supabase
        .from("resellers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (r) {
        setResellerId(r.id);
        const { data: mine } = await supabase
          .from("reseller_listings")
          .select("product_id")
          .eq("reseller_id", r.id);
        setListed(new Set((mine ?? []).map((m) => m.product_id)));
      }
      const [{ data }, { data: b }, { data: c }] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id,name,slug,reseller_price,packaging_cost,delivery_inside,delivery_outside,delivery_mode,delivery_flat,suggested_price,stock,og_image_url,brand_id,category_id",
          )
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase.from("brands").select("id,name").eq("is_active", true).order("name"),
        supabase.from("categories").select("id,name").eq("is_active", true).order("name"),
      ]);
      setItems((data ?? []) as P[]);
      setBrands((b ?? []) as Opt[]);
      setCategories((c ?? []) as Opt[]);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => setPage(1), [q, brand, category, avail, perPage]);

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (q) {
          const t = q.toLowerCase();
          if (!i.name.toLowerCase().includes(t) && !i.slug.includes(t)) return false;
        }
        if (brand && i.brand_id !== brand) return false;
        if (category && i.category_id !== category) return false;
        if (avail === "listed" && !listed.has(i.id)) return false;
        if (avail === "unlisted" && listed.has(i.id)) return false;
        if (avail === "instock" && i.stock <= 0) return false;
        return true;
      }),
    [items, q, brand, category, avail, listed],
  );
  const paged = usePaginated(filtered, page, perPage);

  const filters: FilterDef[] = [
    { key: "brand", label: "Brand", value: brand, onChange: setBrand, options: brands.map((b) => ({ value: b.id, label: b.name })) },
    { key: "category", label: "Category", value: category, onChange: setCategory, options: categories.map((c) => ({ value: c.id, label: c.name })) },
    {
      key: "avail",
      label: "Show",
      value: avail,
      onChange: setAvail,
      options: [
        { value: "unlisted", label: "Not listed yet" },
        { value: "listed", label: "Already listed" },
        { value: "instock", label: "In stock" },
      ],
    },
  ];

  const openList = (p: P) => {
    setSelected(p);
    setPrice(String(p.suggested_price));
  };

  async function addListing() {
    if (!selected || !resellerId) return;
    const priceNum = Number(price);
    // Reseller's minimum sell = reseller_price + packaging (delivery is separate, charged to customer)
    const minPrice = selected.reseller_price + selected.packaging_cost;
    if (priceNum < minPrice) {
      toast.error(`Selling price must be at least ৳${minPrice} (product + packaging). Delivery is charged separately.`);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("reseller_listings").insert({
      reseller_id: resellerId,
      product_id: selected.id,
      selling_price: priceNum,
      extra_delivery_inside: 0,
      extra_delivery_outside: 0,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    listed.add(selected.id);
    setListed(new Set(listed));
    toast.success("Listed in your store!");
    setSelected(null);
  }

  async function bulkList() {
    if (!resellerId) return;
    const ids = Array.from(picked).filter((id) => !listed.has(id));
    if (!ids.length) return toast.error("Selected products already listed");
    setBulkBusy(true);
    const rows = items
      .filter((i) => ids.includes(i.id))
      .map((i) => ({
        reseller_id: resellerId,
        product_id: i.id,
        selling_price: i.suggested_price && i.suggested_price >= i.reseller_price + i.packaging_cost
          ? i.suggested_price
          : i.reseller_price + i.packaging_cost,
        extra_delivery_inside: 0,
        extra_delivery_outside: 0,
      }));
    const { error } = await supabase.from("reseller_listings").insert(rows);
    setBulkBusy(false);
    if (error) return toast.error(error.message);
    const next = new Set(listed);
    ids.forEach((id) => next.add(id));
    setListed(next);
    setPicked(new Set());
    toast.success(`${ids.length} product listed at suggested price. Edit prices on the Listings page.`);
  }

  async function delistOne(p: P) {
    if (!resellerId) return;
    setBusy(true);
    const { error } = await supabase
      .from("reseller_listings")
      .delete()
      .eq("reseller_id", resellerId)
      .eq("product_id", p.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    const next = new Set(listed);
    next.delete(p.id);
    setListed(next);
    toast.success(`"${p.name}" removed from your store`);
  }

  async function bulkDelist() {
    if (!resellerId) return;
    const ids = Array.from(picked).filter((id) => listed.has(id));
    if (!ids.length) return toast.error("Selected products not listed");
    if (!confirm(`Remove ${ids.length} listing from your store?`)) return;
    setBulkBusy(true);
    const { error } = await supabase
      .from("reseller_listings")
      .delete()
      .eq("reseller_id", resellerId)
      .in("product_id", ids);
    setBulkBusy(false);
    if (error) return toast.error(error.message);
    const next = new Set(listed);
    ids.forEach((id) => next.delete(id));
    setListed(next);
    setPicked(new Set());
    toast.success(`${ids.length} listing removed`);
  }

  if (loading)
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const priceNum = Number(price) || 0;
  const profit = selected
    ? priceNum - selected.reseller_price - selected.packaging_cost
    : 0;
  const minSell = selected
    ? selected.reseller_price + selected.packaging_cost
    : 0;

  return (
    <div>
      <PageHeader
        title="Catalog"
        description="Your cost = product price + packaging. Delivery is charged to the customer separately."
      />
      <div className="-mt-4 mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        How are charges calculated?
        <Hint side="bottom">
          Per order, admin deducts <b>(reseller price + packaging) × quantity</b> plus the courier delivery charge.
          With multiple products, only the highest delivery charge is applied once.
          The rest is your profit.
        </Hint>
      </div>

      <DataToolbar
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search products…"
        filters={filters}
        perPage={perPage}
        onPerPage={setPerPage}
      />

      {filtered.length === 0 ? (
        <EmptyState title="No products match" description="Change filters or wait for admin to add new products." />
      ) : (
        <>
        {picked.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-primary/5 px-3 py-2 text-sm">
            <span className="font-medium">{picked.size} selected</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                disabled={bulkBusy}
                onClick={bulkList}
                className="btn-brand inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> List (suggested price)
              </button>
              <button
                disabled={bulkBusy}
                onClick={bulkDelist}
                className="inline-flex items-center gap-1 rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delist
              </button>
              <button
                onClick={() => setPicked(new Set())}
                className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
          </div>
        )}
        <div className="mb-2 flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              const ids = paged.map((p) => p.id);
              const all = ids.every((id) => picked.has(id));
              setPicked((s) => {
                const n = new Set(s);
                if (all) ids.forEach((id) => n.delete(id));
                else ids.forEach((id) => n.add(id));
                return n;
              });
            }}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-muted"
          >
            {paged.length > 0 && paged.every((p) => picked.has(p.id)) ? (
              <CheckSquare className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            Select page
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paged.map((p) => {
            const myCost = p.reseller_price + p.packaging_cost;
            const isListed = listed.has(p.id);
            const isPicked = picked.has(p.id);
            return (
              <div key={p.id} className={`surface-card overflow-hidden relative ${isPicked ? "ring-2 ring-primary" : ""}`}>
                <button
                  type="button"
                  onClick={() =>
                    setPicked((s) => {
                      const n = new Set(s);
                      if (n.has(p.id)) n.delete(p.id);
                      else n.add(p.id);
                      return n;
                    })
                  }
                  className="absolute left-2 top-2 z-10 rounded-md bg-background/90 p-1 shadow-sm backdrop-blur"
                  aria-label="Select"
                >
                  {isPicked ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                </button>
                <div 
                  className="aspect-square bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setDetailId(p.id)}
                >
                  {p.og_image_url && (
                    <img src={p.og_image_url} className="h-full w-full object-cover" alt="" />
                  )}
                </div>
                <div className="p-4">
                  <div 
                    className="truncate text-sm font-medium cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setDetailId(p.id)}
                  >
                    {p.name}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Product ৳{p.reseller_price} + Pack ৳{p.packaging_cost} = <b>৳{myCost}</b> (your cost)
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Delivery: {deliveryLabel(p)} · customer pays
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Suggested ৳{p.suggested_price} · Stock {p.stock}
                  </div>
                  {isListed ? (
                    <button
                      disabled
                      className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md bg-success/15 px-3 py-1.5 text-xs font-medium text-success-foreground"
                    >
                      <Check className="h-3 w-3" /> Listed
                    </button>
                  ) : (
                    <button
                      onClick={() => openList(p)}
                      className="btn-brand mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium"
                    >
                      <Plus className="h-3 w-3" /> List
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <Pagination page={page} perPage={perPage} total={filtered.length} onPage={setPage} />
        </>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md surface-card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">List "{selected.name}"</h3>
            <div className="mt-4">
              <label className="mb-1 flex items-center gap-1 text-xs font-medium">
                Your selling price (minimum ৳{minSell})
                <Hint>Customer pays this for the product; delivery is added on top.</Hint>
              </label>
              <input
                type="number"
                min={minSell}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="mt-4">
              <ResellerProductCalc
                input={{
                  buying: 0,
                  resellerPrice: Number(selected.reseller_price) || 0,
                  packaging: Number(selected.packaging_cost) || 0,
                  deliveryMode: deliveryMode(selected) as "area" | "free" | "flat",
                  deliveryFlat: Number(selected.delivery_flat ?? 0),
                  deliveryInside: Number(selected.delivery_inside) || 0,
                  deliveryOutside: Number(selected.delivery_outside) || 0,
                  sellPrice: priceNum || 0,
                }}
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Delivery is collected from the customer and goes to the courier. With multiple products only the highest delivery charge applies.
              </p>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={addListing}
                disabled={busy}
                className="btn-brand flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Add to my store
              </button>
              <button
                onClick={() => setSelected(null)}
                className="rounded-md border px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {detailId && (
        <ProductDetailModal id={detailId} onClose={() => setDetailId(null)} brands={brands} categories={categories} />
      )}
    </div>
  );
}

function ProductDetailModal({ id, onClose, brands, categories }: { id: string; onClose: () => void; brands: Opt[]; categories: Opt[] }) {
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("products")
        .select("*, product_images(url)")
        .eq("id", id)
        .single();
      if (data) setP(data);
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
  const imageUrls = [p.og_image_url, ...(p.product_images?.map((i: any) => i.url) || [])].filter(Boolean) as string[];
  const activeUrl = imageUrls[Math.min(active, imageUrls.length - 1)] ?? null;
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
                {activeUrl ? (
                  <img src={activeUrl} className="h-full w-full object-cover" alt="" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground">No image</div>
                )}
                <div className="absolute right-3 top-3 flex flex-col gap-2">
                  <ImageDownloadTools compact images={imageUrls} activeUrl={activeUrl} baseName={p.name} />
                </div>
              </div>
              {imageUrls.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {imageUrls.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActive(i)}
                      className={`h-16 w-16 overflow-hidden rounded-lg border bg-muted transition ${i === active ? "ring-2 ring-primary border-primary" : "hover:opacity-80"}`}
                    >
                      <img src={url} className="h-full w-full object-cover" alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>


            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-2xl font-bold">{p.name}</h1>
                  <CopyButton value={p.name} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Code: {p.product_code}
                  </span>
                  {brandName && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{brandName}</span>}
                  {categoryName && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{categoryName}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-xl border bg-muted/30 p-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your Cost</div>
                  <div className="text-lg font-bold">৳{p.reseller_price + p.packaging_cost}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Suggested Sell</div>
                  <div className="text-lg font-bold">৳{p.suggested_price}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Delivery</div>
                  <div className="text-sm font-medium">{deliveryLabel(p)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stock</div>
                  <div className={`text-sm font-medium ${p.stock <= 5 ? "text-destructive" : ""}`}>{p.stock} units</div>
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

