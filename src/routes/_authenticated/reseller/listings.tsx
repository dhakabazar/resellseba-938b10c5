import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deliveryLabel } from "@/lib/delivery";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { DataToolbar, Pagination, usePaginated, type FilterDef, ActionMenu } from "@/components/data-list";
import { Loader2, Trash2, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { CopyButton, ImageDownloadTools, stripHtml } from "@/components/store/reseller-tools";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ProductCodeChip } from "@/components/product-code";

type L = {
  id: string;
  selling_price: number;
  is_active: boolean;
  products: {
    name: string;
    slug: string;
    product_code: string | null;
    reseller_price: number;
    packaging_cost: number;
    delivery_inside: number;
    delivery_outside: number;
    delivery_mode: string | null;
    delivery_flat: number | null;
    og_image_url: string | null;
  } | null;
};

export const Route = createFileRoute("/_authenticated/reseller/listings")({
  component: ListingsPage,
});

function ListingsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<L[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);


  async function load() {
    if (!user) return;
    setLoading(true);
    const { data: r } = await supabase
      .from("resellers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!r) return setLoading(false);
    const { data } = await supabase
      .from("reseller_listings")
      .select(
        "id,selling_price,is_active,products(name,slug,product_code,reseller_price,packaging_cost,delivery_inside,delivery_outside,delivery_mode,delivery_flat,og_image_url)",
      )
      .eq("reseller_id", r.id)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as L[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [user]);

  async function remove(id: string) {
    if (!confirm("Remove this listing?")) return;
    await supabase.from("reseller_listings").delete().eq("id", id);
    toast.success("Removed");
    load();
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = items.filter((l) => {
      const okQ =
        !term ||
        (l.products?.name ?? "").toLowerCase().includes(term) ||
        String(l.products?.product_code ?? "").toLowerCase().includes(term);
      const okS =
        !status || (status === "active" ? l.is_active : !l.is_active);
      return okQ && okS;
    });
    const profitOf = (l: L) =>
      l.selling_price - ((l.products?.reseller_price ?? 0) + (l.products?.packaging_cost ?? 0));
    out = [...out];
    if (sort === "price_high") out.sort((a, b) => b.selling_price - a.selling_price);
    else if (sort === "price_low") out.sort((a, b) => a.selling_price - b.selling_price);
    else if (sort === "profit_high") out.sort((a, b) => profitOf(b) - profitOf(a));
    else if (sort === "name")
      out.sort((a, b) => (a.products?.name ?? "").localeCompare(b.products?.name ?? ""));
    return out;
  }, [items, q, status, sort]);

  useEffect(() => {
    setPage(1);
  }, [q, status, sort, perPage]);

  const paged = usePaginated(filtered, page, perPage);

  const filters: FilterDef[] = [
    {
      key: "status",
      label: "Status",
      value: status,
      onChange: setStatus,
      options: [
        { value: "active", label: "Live" },
        { value: "paused", label: "Paused" },
      ],
    },
    {
      key: "sort",
      label: "Sort",
      value: sort,
      onChange: setSort,
      options: [
        { value: "newest", label: "Newest first" },
        { value: "name", label: "Name (A-Z)" },
        { value: "price_high", label: "Price high → low" },
        { value: "price_low", label: "Price low → high" },
        { value: "profit_high", label: "Profit high → low" },
      ],
    },
  ];

  if (loading)
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div>
      <PageHeader title="My listings" description="Products currently in your store." />

      <DataToolbar
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search by name or product ID…"
        filters={filters}
        perPage={perPage}
        onPerPage={setPerPage}
        right={
          <span className="text-sm text-muted-foreground">
            {filtered.length} of {items.length} listings
          </span>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="No listings"
          description="Select products from the Catalog to start listing."
        />
      ) : (
        <>
        <div className="surface-card divide-y">
          {paged.map((l) => {

            const cost = (l.products?.reseller_price ?? 0) + (l.products?.packaging_cost ?? 0);
            const profit = l.selling_price - cost;
            return (
              <div key={l.id} className="flex flex-wrap items-center gap-4 p-4">
                <div 
                  className="h-14 w-14 overflow-hidden rounded-md border bg-muted cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                  onClick={() => setDetailId(l.id)}
                >
                  {l.products?.og_image_url && (
                    <img src={l.products.og_image_url} className="h-full w-full object-cover" alt="" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1">
                    <ProductCodeChip code={l.products?.product_code} />
                  </div>
                  <div 
                    className="truncate font-medium cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setDetailId(l.id)}
                  >
                    {l.products?.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Sell ৳{l.selling_price} · Cost ৳{cost} (product + packaging) · Delivery:{" "}
                    {l.products ? deliveryLabel(l.products) : "—"}
                  </div>
                  <div className="mt-1.5">
                    <span className="inline-flex items-center rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                      Profit ৳{profit}
                    </span>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${
                    l.is_active ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                  }`}
                >
                  {l.is_active ? "Live" : "Paused"}
                </span>

                <ActionMenu>
                  <DropdownMenuItem onSelect={() => setDetailId(l.id)}>
                    <Eye className="mr-2 h-4 w-4" /> View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => remove(l.id)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Listing
                  </DropdownMenuItem>
                </ActionMenu>
              </div>
            );
          })}
        </div>
        <Pagination page={page} perPage={perPage} total={filtered.length} onPage={setPage} />
        </>
      )}
      {detailId && (
        <ListingDetailModal id={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}

function ListingDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [l, setL] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("reseller_listings")
        .select(`
          id, selling_price,
          products (
            id, name, product_code, description, short_description, og_image_url, stock, reseller_price, packaging_cost,
            delivery_mode, delivery_flat, delivery_inside, delivery_outside,
            product_images (url),
            brands (name),
            categories (name)
          )
        `)
        .eq("id", id)
        .single();
      if (data) setL(data);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm">
      <Loader2 className="h-8 w-8 animate-spin text-white" />
    </div>
  );

  const p = l?.products;
  if (!p) return null;

  const images = [p.og_image_url, ...(p.product_images?.map((i: any) => i.url) || [])].filter(Boolean) as string[];
  const activeUrl = images[Math.min(active, images.length - 1)] ?? null;
  const detailsText = stripHtml([p.short_description, p.description].filter(Boolean).join("\n\n"));
  const myCost = p.reseller_price + p.packaging_cost;
  const myProfit = l.selling_price - myCost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-4xl surface-card max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-4 backdrop-blur-md">
          <h3 className="text-lg font-bold">Listing Details</h3>
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
                  <ImageDownloadTools compact images={images} activeUrl={activeUrl} baseName={p.name} />
                </div>
              </div>
              {images.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {images.map((url, i) => (
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
                  <ProductCodeChip code={p.product_code} size="md" />
                  {p.brands?.name && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{p.brands.name}</span>}
                  {p.categories?.name && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{p.categories.name}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-xl border bg-muted/30 p-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Selling Price</div>
                  <div className="text-lg font-bold">৳{l.selling_price}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your Profit</div>
                  <div className="text-lg font-bold text-success">৳{myProfit}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Base Cost</div>
                  <div className="text-sm font-medium">৳{myCost}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stock</div>
                  <div className={`text-sm font-medium ${p.stock <= 5 ? "text-destructive" : ""}`}>{p.stock} in stock</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold">Product Description</h4>
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
