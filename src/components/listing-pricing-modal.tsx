import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, X, Save, TrendingUp } from "lucide-react";
import { ProductCodeChip } from "@/components/product-code";
import { getGlobalSettings } from "@/lib/app-data";
import {
  DELIVERY_AREAS,
  areaLabel,
  deliveryLabel,
  globalDelivery,
  productDeliveryCharge,
  type DeliveryArea,
} from "@/lib/delivery";

type PricingProduct = {
  id: string;
  name: string;
  product_code: string | null;
  og_image_url: string | null;
  reseller_price: number;
  packaging_cost: number;
  suggested_price: number | null;
  stock: number | null;
  brand_id?: string | null;
  category_id?: string | null;
  delivery_mode: string | null;
  delivery_flat: number | null;
  delivery_inside: number | null;
  delivery_outside: number | null;
  delivery_sub: number | null;
};

type PricingListing = {
  id: string;
  selling_price: number;
  is_active: boolean;
  products: PricingProduct | null;
};

const taka = (n: number) => `৳${Math.round(n * 100) / 100}`;

export function ListingPricingModal({
  id,
  onClose,
  onSaved,
}: {
  id: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [row, setRow] = useState<PricingListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const [settingsTick, setSettingsTick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      // Make sure the platform delivery rule is loaded before we price anything.
      const [{ data, error }] = await Promise.all([
        supabase
          .from("reseller_listings")
          .select(
            "id,selling_price,is_active,products(id,name,product_code,og_image_url,reseller_price,packaging_cost,suggested_price,stock,brand_id,category_id,delivery_mode,delivery_flat,delivery_inside,delivery_outside,delivery_sub)",
          )
          .eq("id", id)
          .maybeSingle(),
        getGlobalSettings().catch(() => null),
      ]);
      if (!alive) return;
      if (error) toast.error(error.message);
      const l = (data ?? null) as PricingListing | null;
      setRow(l);
      setPrice(l ? String(l.selling_price) : "");
      setSettingsTick((t) => t + 1);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const p = row?.products ?? null;
  const g = globalDelivery();

  const calc = useMemo(() => {
    const productCost = Number(p?.reseller_price ?? 0);
    const packaging = Number(p?.packaging_cost ?? 0);
    const cost = productCost + packaging;
    const sell = Number(price);
    const valid = price.trim() !== "" && Number.isFinite(sell) && sell >= 0;
    const profit = valid ? sell - cost : 0;
    const margin = valid && sell > 0 ? (profit / sell) * 100 : 0;
    const delivery: { area: DeliveryArea; label: string; charge: number }[] = p
      ? DELIVERY_AREAS.map((area) => ({
          area,
          label: areaLabel(area, g),
          charge: productDeliveryCharge(p, area, {}, g),
        }))
      : [];
    return { productCost, packaging, cost, sell, valid, profit, margin, delivery };
  }, [p, price, g, settingsTick]);

  async function save() {
    if (!row || !p) return;
    if (!calc.valid) return toast.error("Enter a valid selling price");
    if (calc.sell < calc.cost)
      return toast.error(
        `Selling price must be at least ${taka(calc.cost)} (product + packaging). Delivery is charged to the customer separately.`,
      );
    setBusy(true);
    const { error } = await supabase
      .from("reseller_listings")
      .update({ selling_price: calc.sell })
      .eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Selling price updated to ${taka(calc.sell)}`);
    onSaved?.();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="surface-card max-h-[90vh] w-full max-w-lg overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-5 py-4 backdrop-blur-md">
          <h3 className="text-lg font-bold">Pricing</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !p ? (
          <div className="p-6 text-sm text-muted-foreground">Listing not found.</div>
        ) : (
          <div className="space-y-5 p-5">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                {p.og_image_url && (
                  <img src={p.og_image_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <ProductCodeChip code={p.product_code} />
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      row?.is_active ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                    }`}
                  >
                    {row?.is_active ? "Live" : "Paused"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Your cost breakdown
              </div>
              <dl className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Product cost (admin price)</dt>
                  <dd className="font-medium">{taka(calc.productCost)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Packaging cost</dt>
                  <dd className="font-medium">{taka(calc.packaging)}</dd>
                </div>
                <div className="flex items-center justify-between border-t pt-1.5">
                  <dt className="font-semibold">Total cost</dt>
                  <dd className="font-bold">{taka(calc.cost)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">
                Delivery charge customer আলাদা করে দেয় — আপনার profit থেকে কাটে না।
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="listing-selling-price">
                Selling price (৳)
              </label>
              <input
                id="listing-selling-price"
                type="number"
                min={calc.cost}
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-lg font-semibold outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>
                  Minimum <b>{taka(calc.cost)}</b>
                </span>
                {p.suggested_price != null && (
                  <button
                    type="button"
                    onClick={() => setPrice(String(p.suggested_price))}
                    className="font-medium text-primary hover:underline"
                  >
                    Use suggested {taka(Number(p.suggested_price))}
                  </button>
                )}
                {p.stock != null && <span>Stock {p.stock}</span>}
              </div>
              {calc.valid && calc.sell < calc.cost && (
                <p className="mt-2 text-xs font-medium text-destructive">
                  Selling price cost এর নিচে — save করা যাবে না।
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Your profit / unit
                </div>
                <div
                  className={`text-xl font-bold ${calc.profit < 0 ? "text-destructive" : "text-success"}`}
                >
                  {taka(calc.profit)}
                </div>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Margin
                </div>
                <div className="flex items-center gap-1 text-xl font-bold">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  {calc.margin.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Customer pays (with delivery)
                </div>
                <span className="text-xs text-muted-foreground">{deliveryLabel(p, g)}</span>
              </div>
              <div className="space-y-1.5 text-sm">
                {calc.delivery.map((d) => (
                  <div key={d.area} className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {d.label} <span className="text-xs">(+{taka(d.charge)} delivery)</span>
                    </span>
                    <span className="font-semibold">
                      {taka((calc.valid ? calc.sell : 0) + d.charge)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy || !calc.valid || calc.sell < calc.cost}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save price
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
