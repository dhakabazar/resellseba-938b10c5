import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { ProductCodeChip } from "@/components/product-code";
import { Loader2, Trash2, Tag, Handshake, Users, Pencil, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { matchesResellerSearch } from "@/lib/phone-search";
import { deliveryLabel } from "@/lib/delivery";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchableSelect } from "@/components/searchable-select";
import { DataToolbar, Pagination, usePaginated } from "@/components/data-list";
import { ResellerRateEditor } from "@/components/reseller-rate-editor";
import { withResellerRates, type ResellerPriceMap } from "@/lib/reseller-prices";

export const Route = createFileRoute("/_authenticated/admin/reseller-pricing")({
  component: ResellerPricingPage,
  head: () => ({
    meta: [
      { title: "Reseller Pricing — Ecom Seller BD Admin" },
      {
        name: "description",
        content: "Give a reseller their own product price, packaging cost and delivery charge for selected products.",
      },
      { property: "og:title", content: "Reseller Pricing — Ecom Seller BD Admin" },
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

const optNum = (s: string) => (s.trim() === "" ? null : Number(s));

function ResellerPricingPage() {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [resellerId, setResellerId] = useState("");
  const [activeTab, setActiveTab] = useState("rates");
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [rowLoading, setRowLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [draft, setDraft] = useState<Draft>(draftOf());
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [rateFilter, setRateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [resellerSearch, setResellerSearch] = useState("");
  const [directoryPage, setDirectoryPage] = useState(1);
  const [directoryPerPage, setDirectoryPerPage] = useState(20);
  const [del, setDel] = useState<{ id: string; name: string } | null>(null);
  const requestId = useRef(0);

  const loadSummary = async () => {
    const { data, error } = await supabase.rpc("reseller_custom_rate_summary" as any);
    if (error) throw error;
    setSummary((data ?? []) as Summary[]);
  };
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [rs, ps] = await Promise.all([
          fetchAll<Reseller>(() => supabase.from("resellers").select("id,business_name,code,contact_phone").order("business_name")),
          fetchAll<Product>(() => supabase.from("products").select("id,name,product_code,og_image_url,reseller_price,packaging_cost,suggested_price,delivery_mode,delivery_flat,delivery_inside,delivery_outside,delivery_sub").eq("is_active", true).order("created_at", { ascending: false })),
          loadSummary(),
        ]);
        if (alive) { setResellers(rs); setProducts(ps); }
      } catch { if (alive) { setLoadError(true); toast.error("Could not load reseller rates"); } }
      finally { if (alive) setLoading(false); }
    };
    void load();
    return () => { alive = false; };
  }, []);

  const loadOverrides = async (rid: string) => {
    const token = ++requestId.current;
    setOverrides([]);
    if (!rid) { setRowLoading(false); return; }
    setRowLoading(true);
    try {
      const data = await fetchAll<Override>(() => supabase.from("reseller_product_prices").select("id,product_id,reseller_price,packaging_cost,delivery_mode,delivery_flat,delivery_inside,delivery_outside,delivery_sub").eq("reseller_id", rid));
      if (token === requestId.current) setOverrides(data);
    } catch { if (token === requestId.current) toast.error("Could not load custom rates"); }
    finally { if (token === requestId.current) setRowLoading(false); }
  };
  useEffect(() => { void loadOverrides(resellerId); return () => { requestId.current += 1; }; }, [resellerId]);
  useEffect(() => { setPage(1); }, [q, rateFilter, resellerId, perPage]);
  useEffect(() => { setDirectoryPage(1); }, [resellerSearch, directoryPerPage]);

  const byProduct = useMemo(() => new Map(overrides.map((o) => [o.product_id, o])), [overrides]);
  const rateMap: ResellerPriceMap = useMemo(() => new Map(overrides.map((o) => [o.product_id, o])), [overrides]);
  const summaryMap = useMemo(() => new Map(summary.map((s) => [s.reseller_id, s])), [summary]);
  const customResellers = useMemo(() => resellers.filter((r) => summaryMap.has(r.id)).sort((a, b) => Number(summaryMap.get(b.id)?.products ?? 0) - Number(summaryMap.get(a.id)?.products ?? 0)), [resellers, summaryMap]);
  const directory = customResellers.filter((r) => matchesResellerSearch(r, resellerSearch.trim()));
  const selected = resellers.find((r) => r.id === resellerId);
  const rows = useMemo(() => products.filter((p) => {
    const o = byProduct.get(p.id);
    if (rateFilter === "custom" && !o) return false;
    if (rateFilter === "master" && o) return false;
    if (rateFilter === "packaging" && o?.packaging_cost == null) return false;
    if (rateFilter === "delivery" && !o?.delivery_mode) return false;
    const search = q.trim().toLowerCase();
    return !search || p.name.toLowerCase().includes(search) || (p.product_code ?? "").toLowerCase().includes(search);
  }), [products, q, rateFilter, byProduct]);
  const visibleRows = usePaginated(rows, page, perPage);
  const visibleResellers = usePaginated(directory, directoryPage, directoryPerPage);

  function selectReseller(id: string) { setEditing(null); setResellerId(id); setPage(1); }
  function editProduct(product: Product) { setDraft(draftOf(byProduct.get(product.id))); setEditing(product); }
  async function save() {
    if (!editing || !resellerId || saving) return;
    const p = editing;
    const price = draft.price.trim() === "" ? Number(p.reseller_price) : Number(draft.price);
    const numeric = [price, ...[draft.pack, draft.flat, draft.inside, draft.sub, draft.outside].map(optNum).filter((v) => v != null)];
    if (numeric.some((v) => !Number.isFinite(v) || Number(v) < 0)) return toast.error("Enter valid, non-negative rates");
    const pack = optNum(draft.pack);
    const mode = draft.dmode || null;
    if (!draft.price.trim() && pack == null && !mode) return toast.error("Set at least one custom rate");
    setSaving(true);
    try {
      const { error } = await supabase.from("reseller_product_prices").upsert({
        reseller_id: resellerId, product_id: p.id, reseller_price: price, packaging_cost: pack,
        delivery_mode: mode, delivery_flat: mode === "flat" || mode === "custom" ? optNum(draft.flat) ?? 0 : null,
        delivery_inside: mode === "area" ? optNum(draft.inside) ?? 0 : null,
        delivery_sub: mode === "area" ? optNum(draft.sub) : null,
        delivery_outside: mode === "area" ? optNum(draft.outside) ?? 0 : null,
      } as any, { onConflict: "reseller_id,product_id" });
      if (error) throw error;
      setEditing(null); toast.success("Custom rates saved");
      await Promise.all([loadOverrides(resellerId), loadSummary()]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save custom rates"); }
    finally { setSaving(false); }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("reseller_product_prices").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setDel(null); toast.success("Master rates restored");
    await Promise.all([loadOverrides(resellerId), loadSummary()]);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reseller pricing" />
      {loading ? <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : loadError ? <div className="py-12 text-center text-sm text-destructive">Could not load pricing data. Please reload this page.</div> : <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Custom-rate resellers" value={customResellers.length} icon={<Users />} />
          <StatCard label="Custom product rates" value={summary.reduce((sum, r) => sum + Number(r.products), 0)} icon={<Tag />} />
          <StatCard label="All resellers" value={resellers.length} icon={<Handshake />} />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-5 grid h-11 w-full grid-cols-2 sm:w-fit">
            <TabsTrigger value="rates" className="gap-2"><Tag className="h-4 w-4" />Set rates</TabsTrigger>
            <TabsTrigger value="resellers" className="gap-2"><Users className="h-4 w-4" />Custom resellers <span className="text-xs text-muted-foreground">{customResellers.length}</span></TabsTrigger>
          </TabsList>
          <TabsContent value="rates" className="space-y-5">
            <div className="grid items-end gap-4 border-b pb-5 sm:grid-cols-[minmax(0,1fr)_auto]">
              <SearchableSelect label="Reseller" placeholder="Select a reseller" searchPlaceholder="Search name, code or phone…" value={resellerId} onChange={selectReseller} options={resellers.map((r) => ({ value: r.id, label: `${r.business_name}${r.code ? ` · ${r.code}` : ""}${r.contact_phone ? ` · ${r.contact_phone}` : ""}` }))} />
              {selected && <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground sm:pb-3"><span><strong className="text-foreground">{rowLoading ? "…" : overrides.length}</strong> custom products</span><span><strong className="text-foreground">{rowLoading ? "…" : overrides.filter((o) => o.packaging_cost != null).length}</strong> packaging</span><span><strong className="text-foreground">{rowLoading ? "…" : overrides.filter((o) => o.delivery_mode).length}</strong> delivery</span></div>}
            </div>
            {!selected ? <div className="grid justify-items-center gap-3 py-16 text-muted-foreground"><Handshake className="h-8 w-8" /><span className="text-sm">No reseller selected</span></div> : <>
              <DataToolbar search={q} onSearch={setQ} searchPlaceholder="Search product name or ID…" perPage={perPage} onPerPage={setPerPage} filters={[{ key: "rate", label: "Rates", value: rateFilter, onChange: setRateFilter, options: [{ value: "custom", label: "Custom rates" }, { value: "master", label: "Master rates" }, { value: "packaging", label: "Custom packaging" }, { value: "delivery", label: "Custom delivery" }] }]} />
              {rowLoading ? <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[740px] text-sm">
                    <thead className="border-y bg-muted/40"><tr><th className={th}>Product</th><th className={th}>Product price</th><th className={th}>Packaging</th><th className={th}>Delivery</th><th className={th}>Cost</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
                    <tbody className="divide-y">{visibleRows.map((p) => {
                      const o = byProduct.get(p.id);
                      const effective = withResellerRates(p, rateMap);
                      return <tr key={p.id} className="hover:bg-muted/20">
                        <td className="py-3 pr-3"><div className="flex items-center gap-3"><div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border bg-muted">{p.og_image_url && <img src={p.og_image_url} alt="" loading="lazy" className="h-full w-full object-cover" />}</div><div className="min-w-0"><div className="max-w-64 truncate font-medium" title={p.name}>{p.name}</div><div className="mt-1 flex items-center gap-2"><ProductCodeChip code={p.product_code} />{o && <span className="text-[10px] font-semibold text-primary">Custom</span>}</div></div></div></td>
                        <td className="px-3 py-3"><div className="font-semibold">{taka(effective.reseller_price)}</div><div className="mt-1 text-[10px] text-muted-foreground">{o ? `Master ${taka(p.reseller_price)}` : "Master rate"}</div></td>
                        <td className="px-3 py-3"><div className="font-medium">{taka(effective.packaging_cost)}</div><div className="mt-1 text-[10px] text-muted-foreground">{o?.packaging_cost != null ? `Master ${taka(p.packaging_cost)}` : "Master rate"}</div></td>
                        <td className="px-3 py-3"><div className="max-w-48 text-xs">{deliveryLabel(effective)}</div><div className="mt-1 text-[10px] text-muted-foreground">{o?.delivery_mode ? "Custom rule" : "Master rule"}</div></td>
                        <td className="whitespace-nowrap px-3 py-3"><div className="font-semibold">{taka(Number(effective.reseller_price) + Number(effective.packaging_cost))}</div><div className="mt-1 text-[10px] text-muted-foreground">price + packaging</div></td>
                        <td className="py-3 pl-3"><div className="flex items-center justify-end gap-1"><Button variant="outline" size="sm" onClick={() => editProduct(p)} aria-label={`Edit rates for ${p.name}`}><Pencil />Edit</Button>{o && <Button variant="ghost" size="icon" className="text-destructive" title="Remove custom rates" aria-label={`Remove rates for ${p.name}`} onClick={() => setDel({ id: o.id, name: p.name })}><Trash2 /></Button>}</div></td>
                      </tr>;
                    })}{rows.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No products match this filter.</td></tr>}</tbody>
                  </table>
                </div>
                <Pagination page={page} perPage={perPage} total={rows.length} onPage={setPage} />
              </>}
            </>}
          </TabsContent>
          <TabsContent value="resellers" className="space-y-4">
            <DataToolbar search={resellerSearch} onSearch={setResellerSearch} searchPlaceholder="Search reseller name, code or phone…" perPage={directoryPerPage} onPerPage={setDirectoryPerPage} />
            <div className="divide-y border-y">{visibleResellers.map((r) => <div key={r.id} className="flex items-center justify-between gap-3 py-4"><div className="min-w-0"><div className="truncate text-sm font-semibold">{r.business_name}</div><div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">{r.code && <span>#{r.code}</span>}{r.contact_phone && <span>{r.contact_phone}</span>}</div></div><div className="flex shrink-0 items-center gap-3"><span className="text-xs text-muted-foreground"><strong className="text-foreground">{summaryMap.get(r.id)?.products ?? 0}</strong> products</span><Button variant="outline" size="sm" onClick={() => { selectReseller(r.id); setActiveTab("rates"); }}>Rates<ArrowRight /></Button></div></div>)}{directory.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No custom-rate resellers found.</div>}</div>
            <Pagination page={directoryPage} perPage={directoryPerPage} total={directory.length} onPage={setDirectoryPage} />
          </TabsContent>
        </Tabs>
      </>}
      {editing && selected && <ResellerRateEditor product={editing} resellerName={selected.business_name} draft={draft} onField={(key, value) => setDraft((current) => ({ ...current, [key]: value }))} onSave={() => void save()} onClose={() => setEditing(null)} saving={saving} />}
      {del && <ConfirmModal isOpen title="Remove custom rates" description={`${del.name} will use master price, packaging and delivery for this reseller.`} confirmText="Remove" variant="danger" onClose={() => setDel(null)} onConfirm={() => remove(del.id)} />}
    </div>
  );
}
