import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { ProductCodeChip } from "@/components/product-code";
import { Loader2, Search, Save, Trash2, Tag, Handshake, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/reseller-pricing")({
  component: ResellerPricingPage,
  head: () => ({
    meta: [
      { title: "Reseller pricing — Admin" },
      {
        name: "description",
        content:
          "Give a reseller their own admin price for selected products. Orders from that reseller use the custom price.",
      },
      { property: "og:title", content: "Reseller pricing — Admin" },
      { property: "og:description", content: "Per-reseller product price control." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Reseller = { id: string; business_name: string; code: string | null };
type Product = {
  id: string;
  name: string;
  product_code: string | null;
  og_image_url: string | null;
  reseller_price: number;
  packaging_cost: number;
  suggested_price: number | null;
};
type Override = { id: string; product_id: string; reseller_price: number; note: string | null };

const taka = (n: number) => `৳${Math.round(Number(n || 0))}`;
const input = "h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

function ResellerPricingPage() {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [resellerId, setResellerId] = useState<string>("");
  const [resellerSearch, setResellerSearch] = useState("");
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [rowLoading, setRowLoading] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [del, setDel] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: rs }, { data: ps }] = await Promise.all([
        supabase
          .from("resellers")
          .select("id,business_name,code")
          .order("business_name", { ascending: true }),
        supabase
          .from("products")
          .select("id,name,product_code,og_image_url,reseller_price,packaging_cost,suggested_price")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);
      setResellers((rs ?? []) as Reseller[]);
      setProducts((ps ?? []) as Product[]);
      setLoading(false);
    })();
  }, []);

  const loadOverrides = async (rid: string) => {
    if (!rid) return setOverrides([]);
    setRowLoading(true);
    const { data, error } = await supabase
      .from("reseller_product_prices")
      .select("id,product_id,reseller_price,note")
      .eq("reseller_id", rid);
    setRowLoading(false);
    if (error) return toast.error(error.message);
    setOverrides((data ?? []) as Override[]);
    setDraft({});
  };

  useEffect(() => {
    loadOverrides(resellerId);
  }, [resellerId]);

  const byProduct = useMemo(() => {
    const m = new Map<string, Override>();
    for (const o of overrides) m.set(o.product_id, o);
    return m;
  }, [overrides]);

  const filteredResellers = useMemo(() => {
    const s = resellerSearch.trim().toLowerCase();
    if (!s) return resellers.slice(0, 30);
    return resellers
      .filter((r) => r.business_name.toLowerCase().includes(s) || (r.code ?? "").toLowerCase().includes(s))
      .slice(0, 30);
  }, [resellers, resellerSearch]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyCustom && !byProduct.has(p.id)) return false;
      if (!s) return true;
      return p.name.toLowerCase().includes(s) || (p.product_code ?? "").toLowerCase().includes(s);
    });
  }, [products, q, onlyCustom, byProduct]);

  const savedCount = overrides.length;
  const avgDiff = useMemo(() => {
    if (!overrides.length) return 0;
    let sum = 0;
    for (const o of overrides) {
      const p = products.find((x) => x.id === o.product_id);
      if (p) sum += Number(o.reseller_price) - Number(p.reseller_price);
    }
    return sum / overrides.length;
  }, [overrides, products]);

  async function save(p: Product) {
    if (!resellerId) return toast.error("Select a reseller first");
    const raw = draft[p.id] ?? String(byProduct.get(p.id)?.reseller_price ?? "");
    const value = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(value) || value < 0) return toast.error("Enter a valid price");
    setSavingId(p.id);
    const { error } = await supabase
      .from("reseller_product_prices")
      .upsert(
        { reseller_id: resellerId, product_id: p.id, reseller_price: value },
        { onConflict: "reseller_id,product_id" },
      );
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success(`${p.name} — custom price ${taka(value)}`);
    await loadOverrides(resellerId);
  }

  async function remove(id: string) {
    const { error } = await supabase.from("reseller_product_prices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Custom price removed — master price applies again");
    await loadOverrides(resellerId);
  }

  const selected = resellers.find((r) => r.id === resellerId) ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reseller pricing"
        description="Set a reseller specific admin price for selected products. New orders of that reseller — panel, edit and storefront checkout — use this price for cost and profit."
      />

      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Handshake className="h-4 w-4 text-muted-foreground" /> Reseller
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  className={`${input} pl-8`}
                  placeholder="Search reseller by name or code"
                  value={resellerSearch}
                  onChange={(e) => setResellerSearch(e.target.value)}
                />
              </div>
              <select className={input} value={resellerId} onChange={(e) => setResellerId(e.target.value)}>
                <option value="">Select a reseller…</option>
                {filteredResellers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.business_name} {r.code ? `(${r.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!resellerId ? (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
              Select a reseller to set custom product prices.
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Reseller" value={selected?.business_name ?? "—"} icon={<Handshake className="h-4 w-4" />} />
                <StatCard label="Custom priced products" value={String(savedCount)} icon={<Tag className="h-4 w-4" />} />
                <StatCard
                  label="Avg. difference vs master"
                  value={`${avgDiff >= 0 ? "+" : ""}${taka(avgDiff)}`}
                  icon={<Package className="h-4 w-4" />}
                />
              </div>

              <div className="rounded-xl border bg-card">
                <div className="flex flex-wrap items-center gap-2 border-b p-3">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      className={`${input} pl-8`}
                      placeholder="Search product name or product ID"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setOnlyCustom((v) => !v)}
                    className={`h-9 rounded-md border px-3 text-xs font-semibold ${
                      onlyCustom ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    Custom priced only ({savedCount})
                  </button>
                  {rowLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b bg-muted/40">
                      <tr>
                        <th className={th}>Product</th>
                        <th className={th}>Master price</th>
                        <th className={th}>Packaging</th>
                        <th className={th}>Custom price</th>
                        <th className={th}>Reseller cost</th>
                        <th className={th}></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.slice(0, 200).map((p) => {
                        const o = byProduct.get(p.id);
                        const value = draft[p.id] ?? (o ? String(Number(o.reseller_price)) : "");
                        const effective = value.trim() === "" ? Number(p.reseller_price) : Number(value) || 0;
                        return (
                          <tr key={p.id} className={o ? "bg-primary/5" : ""}>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="h-9 w-9 shrink-0 overflow-hidden rounded border bg-muted">
                                  {p.og_image_url && (
                                    <img src={p.og_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{p.name}</div>
                                  <ProductCodeChip code={p.product_code} />
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">{taka(p.reseller_price)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{taka(p.packaging_cost)}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                step="1"
                                className={`${input} w-28`}
                                placeholder={String(Number(p.reseller_price))}
                                value={value}
                                onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                              />
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap font-semibold">
                              {taka(effective + Number(p.packaging_cost))}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => save(p)}
                                  disabled={savingId === p.id}
                                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                                >
                                  {savingId === p.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Save className="h-3.5 w-3.5" />
                                  )}
                                  Save
                                </button>
                                {o && (
                                  <button
                                    type="button"
                                    onClick={() => setDel({ id: o.id, name: p.name })}
                                    className="rounded-md border p-1.5 text-destructive hover:bg-destructive/10"
                                    aria-label="Remove custom price"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                            No products match this search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {del && (
        <ConfirmModal
          title="Remove custom price"
          description={`${del.name} will fall back to the master admin price for this reseller.`}
          confirmLabel="Remove"
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            await remove(del.id);
            setDel(null);
          }}
        />
      )}
    </div>
  );
}
