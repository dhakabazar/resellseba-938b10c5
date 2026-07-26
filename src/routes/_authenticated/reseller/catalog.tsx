import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Loader2, Plus, Check } from "lucide-react";
import { toast } from "sonner";

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
};

export const Route = createFileRoute("/_authenticated/reseller/catalog")({
  component: CatalogPage,
});

function CatalogPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [listed, setListed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<P | null>(null);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

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
      const { data } = await supabase
        .from("products")
        .select(
          "id,name,slug,reseller_price,packaging_cost,delivery_inside,delivery_outside,suggested_price,stock,og_image_url",
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      setItems((data ?? []) as P[]);
      setLoading(false);
    })();
  }, [user]);

  const openList = (p: P) => {
    setSelected(p);
    setPrice(String(p.suggested_price));
  };

  async function addListing() {
    if (!selected || !resellerId) return;
    const priceNum = Number(price);
    // Reseller's minimum sell = reseller_price + packaging + delivery_inside
    const minPrice = selected.reseller_price + selected.packaging_cost + selected.delivery_inside;
    if (priceNum < minPrice) {
      toast.error(`Selling price minimum ৳${minPrice} hote hobe (product + packaging + delivery).`);
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
    ? selected.reseller_price + selected.packaging_cost + selected.delivery_inside
    : 0;

  return (
    <div>
      <PageHeader
        title="Catalog"
        description="Product price + packaging + delivery — ei 3ta niye apnar total cost. Ekhan theke selling price bosiye listing korun."
      />
      {items.length === 0 ? (
        <EmptyState title="Catalog is empty" description="Admin product add korle ekhane dekhabe." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => {
            const totalCost = p.reseller_price + p.packaging_cost + p.delivery_inside;
            const isListed = listed.has(p.id);
            return (
              <div key={p.id} className="surface-card overflow-hidden">
                <div className="aspect-square bg-muted">
                  {p.og_image_url && (
                    <img src={p.og_image_url} className="h-full w-full object-cover" alt="" />
                  )}
                </div>
                <div className="p-4">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Product ৳{p.reseller_price} + Pack ৳{p.packaging_cost} + Del ৳{p.delivery_inside} = <b>৳{totalCost}</b>
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
      )}

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md surface-card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">List "{selected.name}"</h3>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <Row label="Product price" value={`৳${selected.reseller_price}`} />
              <Row label="Packaging" value={`৳${selected.packaging_cost}`} />
              <Row label="Delivery (inside Dhaka)" value={`৳${selected.delivery_inside}`} />
              <Row label="Delivery (outside Dhaka)" value={`৳${selected.delivery_outside}`} />
              <div className="border-t pt-2">
                <Row
                  label="Base cost (inside Dhaka)"
                  value={`৳${minSell}`}
                  strong
                />
              </div>
              <p className="text-xs">Ei tin ta miliye apnar cost — ei theke kom e sell kora jabe na.</p>
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium">
                Apnar selling price (minimum ৳{minSell})
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
                    ৳{profit} profit / order
                  </span>
                  <br />
                  <span className="text-muted-foreground">Delivery charge customer theke alada ashe.</span>
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
