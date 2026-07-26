import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Loader2, Plus, Check, CheckSquare, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Hint } from "@/components/Hint";
import { DataToolbar, Pagination, usePaginated, type FilterDef } from "@/components/data-list";

type P = {
  id: string;
  name: string;
  slug: string;
  reseller_price: number;
  packaging_cost: number;
  delivery_inside: number;
  delivery_outside: number;
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
            "id,name,slug,reseller_price,packaging_cost,delivery_inside,delivery_outside,suggested_price,stock,og_image_url,brand_id,category_id",
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
      toast.error(`Selling price minimum ৳${minPrice} hote hobe (product + packaging). Delivery customer alada dibe.`);
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
    toast.success(`${ids.length} product listed (suggested price). Edit korte listings page e jan.`);
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
        description="আপনার কস্ট = product price + packaging। ডেলিভারি চার্জ কাস্টমার আলাদা দেবে।"
      />
      <div className="-mt-4 mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        কীভাবে টাকা কাটবে?
        <Hint side="bottom">
          প্রতি অর্ডারে এডমিন কাটবে: <b>(reseller price + packaging) × quantity</b> + কুরিয়ার এর ডেলিভারি চার্জ।
          একাধিক প্রোডাক্ট থাকলে ডেলিভারি চার্জ সর্বোচ্চটা <b>একবার</b> ধরা হবে (highest wins)।
          বাকি টাকা আপনার profit।
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
        <EmptyState title="No products match" description="Filter change korun ba admin er notun product er opekkha korun." />
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
                <div className="aspect-square bg-muted">
                  {p.og_image_url && (
                    <img src={p.og_image_url} className="h-full w-full object-cover" alt="" />
                  )}
                </div>
                <div className="p-4">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Product ৳{p.reseller_price} + Pack ৳{p.packaging_cost} = <b>৳{myCost}</b> (your cost)
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Delivery ৳{p.delivery_inside} (in) / ৳{p.delivery_outside} (out) · customer pays
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
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <Row label="Product price" value={`৳${selected.reseller_price}`} />
              <Row label="Packaging" value={`৳${selected.packaging_cost}`} />
              <div className="border-t pt-2">
                <Row label="Your cost (admin কাটবে)" value={`৳${minSell}`} strong />
              </div>
              <Row label="Delivery inside Dhaka" value={`৳${selected.delivery_inside}`} />
              <Row label="Delivery outside Dhaka" value={`৳${selected.delivery_outside}`} />
              <p className="text-xs">
                ডেলিভারি চার্জ কাস্টমার আলাদা দেবে (কুরিয়ার এ যায়)। একাধিক প্রোডাক্টে সর্বোচ্চটা একবার প্রযোজ্য।
              </p>
            </div>
            <div className="mt-4">
              <label className="mb-1 flex items-center gap-1 text-xs font-medium">
                Your selling price (minimum ৳{minSell})
                <Hint>এই দাম কাস্টমার প্রোডাক্ট এর জন্য দেবে। ডেলিভারি এর উপরে যোগ হবে।</Hint>
              </label>
              <input
                type="number"
                min={minSell}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              {priceNum > 0 && (
                <p className="mt-2 text-xs">
                  Selling ৳{priceNum} − Product ৳{selected.reseller_price} − Packaging ৳{selected.packaging_cost} ={" "}
                  <span className={`font-semibold ${profit >= 0 ? "text-success" : "text-destructive"}`}>
                    ৳{profit} profit / unit
                  </span>
                  <br />
                  <span className="text-muted-foreground">Delivery customer theke alada, courier e jai.</span>
                </p>
              )}
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
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className={strong ? "font-semibold text-foreground" : ""}>{value}</span>
    </div>
  );
}
