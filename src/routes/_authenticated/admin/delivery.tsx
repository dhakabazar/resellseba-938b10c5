import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Rule = {
  id: string;
  scope: string;
  brand_id: string | null;
  category_id: string | null;
  product_id: string | null;
  inside_dhaka: number;
  sub_dhaka: number;
  outside_dhaka: number;
  free_above: number | null;
  is_active: boolean;
  notes: string | null;
};

export const Route = createFileRoute("/_authenticated/admin/delivery")({
  component: DeliveryRulesPage,
});

function DeliveryRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    scope: "global" as "global" | "brand" | "category" | "product",
    brand_id: "",
    category_id: "",
    product_id: "",
    inside_dhaka: 60,
    sub_dhaka: 100,
    outside_dhaka: 130,
    free_above: "",
    notes: "",
  });

  async function load() {
    setLoading(true);
    const [{ data: r }, { data: b }, { data: c }, { data: p }] = await Promise.all([
      supabase.from("delivery_rules").select("*").order("scope"),
      supabase.from("brands").select("id,name").order("name"),
      supabase.from("categories").select("id,name").order("name"),
      supabase.from("products").select("id,name").order("name").limit(500),
    ]);
    setRules((r ?? []) as Rule[]);
    setBrands(b ?? []);
    setCategories(c ?? []);
    setProducts(p ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      scope: form.scope,
      brand_id: form.scope === "brand" ? form.brand_id || null : null,
      category_id: form.scope === "category" ? form.category_id || null : null,
      product_id: form.scope === "product" ? form.product_id || null : null,
      inside_dhaka: Number(form.inside_dhaka),
      sub_dhaka: Number(form.sub_dhaka),
      outside_dhaka: Number(form.outside_dhaka),
      free_above: form.free_above ? Number(form.free_above) : null,
      notes: form.notes || null,
    };
    const { error } = await supabase.from("delivery_rules").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Rule added");
    setShowForm(false);
    load();
  }

  async function toggle(r: Rule) {
    await supabase.from("delivery_rules").update({ is_active: !r.is_active }).eq("id", r.id);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this rule?")) return;
    await supabase.from("delivery_rules").delete().eq("id", id);
    load();
  }

  const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
  const label = (r: Rule) =>
    r.scope === "global"
      ? "Global default"
      : r.scope === "brand"
      ? `Brand: ${brands.find((b) => b.id === r.brand_id)?.name ?? "?"}`
      : r.scope === "category"
      ? `Category: ${categories.find((c) => c.id === r.category_id)?.name ?? "?"}`
      : `Product: ${products.find((p) => p.id === r.product_id)?.name ?? "?"}`;

  return (
    <div>
      <PageHeader
        title="Delivery rules"
        description="Product → Category → Brand → Global cascade. Most specific rule wins."
        actions={
          <button onClick={() => setShowForm((s) => !s)} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
            <Plus className="h-4 w-4" /> Add rule
          </button>
        }
      />

      {showForm && (
        <form onSubmit={save} className="surface-card mb-6 space-y-4 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Scope</span>
              <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as typeof form.scope })} className={inp}>
                <option value="global">Global (fallback)</option>
                <option value="brand">Brand</option>
                <option value="category">Category</option>
                <option value="product">Product</option>
              </select>
            </label>
            {form.scope === "brand" && (
              <label className="block text-sm"><span className="mb-1 block font-medium">Brand</span>
                <select required value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })} className={inp}>
                  <option value="">Select…</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}
            {form.scope === "category" && (
              <label className="block text-sm"><span className="mb-1 block font-medium">Category</span>
                <select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className={inp}>
                  <option value="">Select…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            {form.scope === "product" && (
              <label className="block text-sm"><span className="mb-1 block font-medium">Product</span>
                <select required value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className={inp}>
                  <option value="">Select…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="block text-sm"><span className="mb-1 block font-medium">Inside Dhaka</span>
              <input type="number" value={form.inside_dhaka} onChange={(e) => setForm({ ...form, inside_dhaka: Number(e.target.value) })} className={inp} />
            </label>
            <label className="block text-sm"><span className="mb-1 block font-medium">Sub Dhaka</span>
              <input type="number" value={form.sub_dhaka} onChange={(e) => setForm({ ...form, sub_dhaka: Number(e.target.value) })} className={inp} />
            </label>
            <label className="block text-sm"><span className="mb-1 block font-medium">Outside Dhaka</span>
              <input type="number" value={form.outside_dhaka} onChange={(e) => setForm({ ...form, outside_dhaka: Number(e.target.value) })} className={inp} />
            </label>
            <label className="block text-sm"><span className="mb-1 block font-medium">Free above (৳)</span>
              <input type="number" value={form.free_above} onChange={(e) => setForm({ ...form, free_above: e.target.value })} className={inp} placeholder="Optional" />
            </label>
          </div>
          <label className="block text-sm"><span className="mb-1 block font-medium">Notes</span>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inp} />
          </label>
          <div className="flex gap-2">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save rule</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rules.length === 0 ? (
        <EmptyState title="No delivery rules yet" description="Add a global rule first as a fallback." />
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <div>Rule</div><div>Inside</div><div>Sub</div><div>Outside</div><div>Free above</div><div></div>
          </div>
          {rules.map((r) => (
            <div key={r.id} className="grid grid-cols-1 items-center gap-2 border-b px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
              <div>
                <div className="font-medium">{label(r)}</div>
                {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
              </div>
              <div>৳{r.inside_dhaka}</div>
              <div>৳{r.sub_dhaka}</div>
              <div>৳{r.outside_dhaka}</div>
              <div>{r.free_above ? `৳${r.free_above}` : "—"}</div>
              <div className="flex justify-end gap-2">
                <button onClick={() => toggle(r)} className={`rounded-md border px-2 py-1 text-xs ${r.is_active ? "" : "opacity-50"}`}>
                  {r.is_active ? "Active" : "Inactive"}
                </button>
                <button onClick={() => remove(r.id)} className="rounded-md border px-2 py-1 text-xs hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
