import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllSafe } from "@/lib/fetch-all";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { ProductCodeChip } from "@/components/product-code";
import { Loader2, Search, Save, Trash2, Tag, Handshake, Package, Users, Truck } from "lucide-react";
import { toast } from "sonner";
import { matchesResellerSearch } from "@/lib/phone-search";
import { deliveryLabel } from "@/lib/delivery";

export const Route = createFileRoute("/_authenticated/admin/reseller-pricing")({
  component: ResellerPricingPage,
  head: () => ({
    meta: [
      { title: "Reseller pricing — Admin" },
      {
        name: "description",
        content: "Give a reseller their own product price, packaging cost and delivery charge for selected products.",
      },
      { property: "og:title", content: "Reseller pricing — Admin" },
      { property: "og:description", content: "Per-reseller product price, packaging and delivery control." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Reseller = { id: string; business_name: string; code: string | null; contact_phone?: string | null };
type Product = {
  id: string;
  name: string;
  product_code: string | null;
  og_image_url: string | null;
  reseller_price: number;
  packaging_cost: number;
  suggested_price: number | null;
  delivery_mode: string | null;
  delivery_flat: number | null;
  delivery_inside: number | null;
  delivery_outside: number | null;
  delivery_sub: number | null;
};
type Override = {
  id: string;
  product_id: string;
  reseller_price: number;
  packaging_cost: number | null;
  delivery_mode: string | null;
  delivery_flat: number | null;
  delivery_inside: number | null;
  delivery_outside: number | null;
  delivery_sub: number | null;
};
type Draft = {
  price: string;
  pack: string;
  dmode: string; // "" = master delivery
  flat: string;
  inside: string;
  sub: string;
  outside: string;
};
type Summary = { reseller_id: string; products: number; last_updated: string | null };

const taka = (n: number) => `৳${Math.round(Number(n || 0))}`;
const input = "h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const small = "h-8 w-20 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring";
const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const str = (v: number | null | undefined) => (v == null ? "" : String(Number(v)));

function draftOf(o?: Override): Draft {
  return {
    price: o ? str(o.reseller_price) : "",
    pack: str(o?.packaging_cost),
    dmode: o?.delivery_mode ?? "",
    flat: str(o?.delivery_flat),
    inside: str(o?.delivery_inside),
    sub: str(o?.delivery_sub),
    outside: str(o?.delivery_outside),
  };
}

const optNum = (s: string) => (s.trim() === "" ? null : Math.max(Number(s) || 0, 0));

function ResellerPricingPage() {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [resellerId, setResellerId] = useState<string>("");
  const [resellerSearch, setResellerSearch] = useState("");
  const [onlyCustomResellers, setOnlyCustomResellers] = useState(false);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [rowLoading, setRowLoading] = useState(false);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [del, setDel] = useState<{ id: string; name: string } | null>(null);

  const loadSummary = async () => {
    const { data } = await supabase.rpc("reseller_custom_rate_summary" as any);
    setSummary(((data ?? []) as Summary[]) || []);
  };

  useEffect(() => {
    (async () => {
      const [rs, ps] = await Promise.all([
        fetchAllSafe(() =>
          supabase.from("resellers").select("id,business_name,code,contact_phone").order("business_name", { ascending: true }),
        ),
        fetchAllSafe(() =>
          supabase
            .from("products")
            .select(
              "id,name,product_code,og_image_url,reseller_price,packaging_cost,suggested_price,delivery_mode,delivery_flat,delivery_inside,delivery_outside,delivery_sub",
            )
            .eq("is_active", true)
            .order("created_at", { ascending: false }),
        ),
        loadSummary(),
      ]);
      setResellers(rs as Reseller[]);
      setProducts(ps as Product[]);
      setLoading(false);
    })();
  }, []);

  const loadOverrides = async (rid: string) => {
    if (!rid) return setOverrides([]);
    setRowLoading(true);
    const data = await fetchAllSafe(() =>
      supabase
        .from("reseller_product_prices")
        .select("id,product_id,reseller_price,packaging_cost,delivery_mode,delivery_flat,delivery_inside,delivery_outside,delivery_sub")
        .eq("reseller_id", rid),
    );
    setRowLoading(false);
    setOverrides(data as Override[]);
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

  const summaryMap = useMemo(() => new Map(summary.map((s) => [s.reseller_id, s])), [summary]);
  const customResellers = useMemo(
    () =>
      resellers
        .filter((r) => summaryMap.has(r.id))
        .sort((a, b) => (summaryMap.get(b.id)?.products ?? 0) - (summaryMap.get(a.id)?.products ?? 0)),
    [resellers, summaryMap],
  );

  const filteredResellers = useMemo(() => {
    const s = resellerSearch.trim();
    const base = onlyCustomResellers ? customResellers : resellers;
    const list = s ? base.filter((r) => matchesResellerSearch(r, s)) : base;
    return list.slice(0, 50);
  }, [resellers, customResellers, resellerSearch, onlyCustomResellers]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyCustom && !byProduct.has(p.id)) return false;
      if (!s) return true;
      return p.name.toLowerCase().includes(s) || (p.product_code ?? "").toLowerCase().includes(s);
    });
  }, [products, q, onlyCustom, byProduct]);

  const savedCount = overrides.length;
  const customPackCount = overrides.filter((o) => o.packaging_cost != null).length;
  const customDeliveryCount = overrides.filter((o) => o.delivery_mode).length;

  const getDraft = (p: Product) => draft[p.id] ?? draftOf(byProduct.get(p.id));
  const setField = (p: Product, k: keyof Draft, v: string) =>
    setDraft((d) => ({ ...d, [p.id]: { ...getDraft(p), [k]: v } }));

  async function save(p: Product) {
    if (!resellerId) return toast.error("Select a reseller first");
    const d = getDraft(p);
    const price = d.price.trim() === "" ? Number(p.reseller_price) : Number(d.price);
    if (!Number.isFinite(price) || price < 0) return toast.error("Enter a valid price");
    const pack = optNum(d.pack);
    const dmode = d.dmode || null;
    if (d.price.trim() === "" && pack == null && !dmode) return toast.error("Set at least one custom rate");
    setSavingId(p.id);
    const { error } = await supabase.from("reseller_product_prices").upsert(
      {
        reseller_id: resellerId,
        product_id: p.id,
        reseller_price: price,
        packaging_cost: pack,
        delivery_mode: dmode,
        delivery_flat: dmode === "flat" || dmode === "custom" ? optNum(d.flat) ?? 0 : null,
        delivery_inside: dmode === "area" ? optNum(d.inside) ?? 0 : null,
        delivery_sub: dmode === "area" ? optNum(d.sub) : null,
        delivery_outside: dmode === "area" ? optNum(d.outside) ?? 0 : null,
      } as any,
      { onConflict: "reseller_id,product_id" },
    );
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success(`${p.name} — custom rate saved`);
    await Promise.all([loadOverrides(resellerId), loadSummary()]);
  }

  async function remove(id: string) {
    const { error } = await supabase.from("reseller_product_prices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Custom rate removed — master rates apply again");
    await Promise.all([loadOverrides(resellerId), loadSummary()]);
  }

  const selected = resellers.find((r) => r.id === resellerId) ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reseller pricing"
        description="Set a reseller specific product price, packaging cost and delivery charge. That reseller's catalog, panel orders, order edit and storefront checkout all use these rates."
      />

      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Resellers with custom rates" value={String(customResellers.length)} icon={<Users className="h-4 w-4" />} />
            <StatCard
              label="Total custom product rates"
              value={String(summary.reduce((s, x) => s + Number(x.products || 0), 0))}
              icon={<Tag className="h-4 w-4" />}
            />
            <StatCard label="Total resellers" value={String(resellers.length)} icon={<Handshake className="h-4 w-4" />} />
          </div>

          {customResellers.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-2 text-sm font-semibold">Custom rate resellers ({customResellers.length})</div>
              <div className="flex flex-wrap gap-2">
                {customResellers.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setResellerId(r.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                      r.id === resellerId ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    {r.business_name}
                    {r.code ? <span className="opacity-70">({r.code})</span> : null}
                    <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-foreground">
                      {summaryMap.get(r.id)?.products ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Handshake className="h-4 w-4 text-muted-foreground" /> Reseller
              </span>
              <button
                type="button"
                onClick={() => setOnlyCustomResellers((v) => !v)}
                className={`h-8 rounded-md border px-3 text-xs font-semibold ${
                  onlyCustomResellers ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                Only custom-rate resellers ({customResellers.length})
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  className={`${input} pl-8`}
                  placeholder="Search reseller by name, code or phone"
                  value={resellerSearch}
                  onChange={(e) => setResellerSearch(e.target.value)}
                />
              </div>
              <select className={input} value={resellerId} onChange={(e) => setResellerId(e.target.value)}>
                <option value="">Select a reseller…</option>
                {selected && !filteredResellers.some((r) => r.id === selected.id) && (
                  <option value={selected.id}>{selected.business_name}</option>
                )}
                {filteredResellers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.business_name} {r.code ? `(${r.code})` : ""}
                    {summaryMap.has(r.id) ? ` — ${summaryMap.get(r.id)!.products} custom` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!resellerId ? (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
              Select a reseller to set custom product price, packaging and delivery.
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Custom priced products" value={String(savedCount)} icon={<Tag className="h-4 w-4" />} />
                <StatCard label="Custom packaging" value={String(customPackCount)} icon={<Package className="h-4 w-4" />} />
                <StatCard label="Custom delivery" value={String(customDeliveryCount)} icon={<Truck className="h-4 w-4" />} />
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
                    Custom rated only ({savedCount})
                  </button>
                  {rowLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-sm">
                    <thead className="border-b bg-muted/40">
                      <tr>
                        <th className={th}>Product</th>
                        <th className={th}>Product price</th>
                        <th className={th}>Packaging</th>
                        <th className={th}>Delivery charge</th>
                        <th className={th}>Reseller cost</th>
                        <th className={th}></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.slice(0, 200).map((p) => {
                        const o = byProduct.get(p.id);
                        const d = getDraft(p);
                        const effPrice = d.price.trim() === "" ? Number(p.reseller_price) : Number(d.price) || 0;
                        const effPack = d.pack.trim() === "" ? Number(p.packaging_cost) : Number(d.pack) || 0;
                        return (
                          <tr key={p.id} className={o ? "bg-primary/5" : ""}>
                            <td className="px-3 py-2 align-top">
                              <div className="flex items-center gap-2">
                                <div className="h-9 w-9 shrink-0 overflow-hidden rounded border bg-muted">
                                  {p.og_image_url && (
                                    <img src={p.og_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="max-w-[220px] truncate font-medium">{p.name}</div>
                                  <ProductCodeChip code={p.product_code} />
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="number"
                                min={0}
                                className={small + " w-24"}
                                placeholder={String(Number(p.reseller_price))}
                                value={d.price}
                                onChange={(e) => setField(p, "price", e.target.value)}
                              />
                              <div className="mt-1 text-[10px] text-muted-foreground">Master {taka(p.reseller_price)}</div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="number"
                                min={0}
                                className={small}
                                placeholder={String(Number(p.packaging_cost))}
                                value={d.pack}
                                onChange={(e) => setField(p, "pack", e.target.value)}
                              />
                              <div className="mt-1 text-[10px] text-muted-foreground">Master {taka(p.packaging_cost)}</div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <select
                                className="h-8 rounded-md border bg-background px-2 text-xs"
                                value={d.dmode}
                                onChange={(e) => setField(p, "dmode", e.target.value)}
                              >
                                <option value="">Master rule</option>
                                <option value="area">Area-wise</option>
                                <option value="flat">Flat</option>
                                <option value="free">Free</option>
                                <option value="custom">Custom</option>
                              </select>
                              {d.dmode === "area" && (
                                <div className="mt-1 flex gap-1">
                                  <input className={small + " w-16"} type="number" min={0} placeholder="Dhaka" value={d.inside} onChange={(e) => setField(p, "inside", e.target.value)} />
                                  <input className={small + " w-16"} type="number" min={0} placeholder="Sub" value={d.sub} onChange={(e) => setField(p, "sub", e.target.value)} />
                                  <input className={small + " w-16"} type="number" min={0} placeholder="Outside" value={d.outside} onChange={(e) => setField(p, "outside", e.target.value)} />
                                </div>
                              )}
                              {(d.dmode === "flat" || d.dmode === "custom") && (
                                <div className="mt-1">
                                  <input className={small} type="number" min={0} placeholder="Charge" value={d.flat} onChange={(e) => setField(p, "flat", e.target.value)} />
                                </div>
                              )}
                              {!d.dmode && (
                                <div className="mt-1 max-w-[200px] truncate text-[10px] text-muted-foreground">{deliveryLabel(p as any)}</div>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top whitespace-nowrap font-semibold">
                              {taka(effPrice + effPack)}
                              <div className="text-[10px] font-normal text-muted-foreground">price + packaging</div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => save(p)}
                                  disabled={savingId === p.id}
                                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                                >
                                  {savingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                  Save
                                </button>
                                {o && (
                                  <button
                                    type="button"
                                    onClick={() => setDel({ id: o.id, name: p.name })}
                                    className="rounded-md border p-1.5 text-destructive hover:bg-destructive/10"
                                    aria-label="Remove custom rate"
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
          isOpen
          title="Remove custom rate"
          description={`${del.name} will fall back to the master price, packaging and delivery for this reseller.`}
          confirmText="Remove"
          variant="danger"
          onClose={() => setDel(null)}
          onConfirm={async () => {
            await remove(del.id);
            setDel(null);
          }}
        />
      )}
    </div>
  );
}
