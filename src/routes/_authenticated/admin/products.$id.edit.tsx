import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";
import { RichTextEditor } from "@/components/RichTextEditor";
import { uniqueProductSlug, slugify } from "@/lib/slug";

export const Route = createFileRoute("/_authenticated/admin/products/$id/edit")({
  component: EditProduct,
});

const inputCls =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({
  label, children, required,
}: {
  label: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

function EditProduct() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [origName, setOrigName] = useState("");
  const [slug, setSlug] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [buying, setBuying] = useState("");
  const [resellerPrice, setResellerPrice] = useState("");
  const [packaging, setPackaging] = useState("0");
  const [deliveryIn, setDeliveryIn] = useState("60");
  const [deliveryOut, setDeliveryOut] = useState("130");
  const [suggested, setSuggested] = useState("");
  const [stock, setStock] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [keywords, setKeywords] = useState("");
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: bs }, { data: cs }, { data: imgs }] = await Promise.all([
        supabase.from("products").select("*").eq("id", id).maybeSingle(),
        supabase.from("brands").select("id,name").order("name"),
        supabase.from("categories").select("id,name").order("name"),
        supabase.from("product_images").select("url,sort_order").eq("product_id", id).order("sort_order"),
      ]);
      setBrands(bs ?? []);
      setCats(cs ?? []);
      if (!p) {
        toast.error("Product not found");
        nav({ to: "/admin/products" });
        return;
      }
      const anyP = p as any;
      setName(p.name ?? "");
      setOrigName(p.name ?? "");
      setSlug(p.slug ?? "");
      setSku(p.sku ?? "");
      setDescription(p.description ?? "");
      setBrandId(p.brand_id ?? "");
      setCategoryId(p.category_id ?? "");
      setBuying(String(p.buying_price ?? 0));
      setResellerPrice(String(anyP.reseller_price ?? p.buying_price ?? 0));
      setPackaging(String(p.packaging_cost ?? 0));
      setDeliveryIn(String(p.delivery_inside ?? 0));
      setDeliveryOut(String(p.delivery_outside ?? 0));
      setSuggested(String(p.suggested_price ?? 0));
      setStock(String(p.stock ?? 0));
      setIsActive(!!p.is_active);
      setMetaTitle(p.meta_title ?? "");
      setMetaDesc(p.meta_description ?? "");
      setKeywords(p.keywords ?? "");
      const existing: UploadedImage[] = (imgs ?? []).map((r) => ({ url: r.url, path: "", bytes: 0 }));
      if (existing.length === 0 && p.og_image_url) existing.push({ url: p.og_image_url, path: "", bytes: 0 });
      setImages(existing);
      setLoading(false);
    })();
  }, [id, nav]);

  const calc = useMemo(() => {
    const buy = Number(buying) || 0;
    const rp = Number(resellerPrice) || 0;
    const pkg = Number(packaging) || 0;
    const di = Number(deliveryIn) || 0;
    const dOut = Number(deliveryOut) || 0;
    const sug = Number(suggested) || 0;
    return {
      saProfit: rp - buy,
      resellerBaseIn: rp + pkg + di,
      resellerBaseOut: rp + pkg + dOut,
      resellerProfitAtSuggestedIn: sug - rp - pkg,
    };
  }, [buying, resellerPrice, packaging, deliveryIn, deliveryOut, suggested]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let finalSlug = slug;
      // regenerate slug if name changed or slug empty
      if (!finalSlug || (name !== origName && slugify(name) !== finalSlug)) {
        finalSlug = await uniqueProductSlug(name, id);
      }
      if (Number(resellerPrice) < Number(buying)) {
        throw new Error("Reseller price buying price er theke kom hote parbe na.");
      }
      if (Number(suggested) < calc.resellerBaseIn) {
        throw new Error(`Suggested sell reseller er base cost ৳${calc.resellerBaseIn} er theke kom.`);
      }
      const { error } = await supabase
        .from("products")
        .update({
          name,
          slug: finalSlug,
          sku: sku || null,
          description: description || null,
          brand_id: brandId || null,
          category_id: categoryId || null,
          buying_price: Number(buying),
          reseller_price: Number(resellerPrice),
          packaging_cost: Number(packaging),
          delivery_inside: Number(deliveryIn),
          delivery_outside: Number(deliveryOut),
          suggested_price: Number(suggested),
          stock: Number(stock),
          is_active: isActive,
          og_image_url: images[0]?.url ?? null,
          meta_title: metaTitle || null,
          meta_description: metaDesc || null,
          keywords: keywords || null,
        })
        .eq("id", id);
      if (error) throw error;

      await supabase.from("product_images").delete().eq("product_id", id);
      if (images.length) {
        await supabase.from("product_images").insert(
          images.map((im, i) => ({
            product_id: id,
            url: im.url,
            is_primary: i === 0,
            sort_order: i,
          })),
        );
      }
      toast.success("Product updated");
      nav({ to: "/admin/products" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${name}"? Ei product er sob listing o remove hoye jete pare.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    nav({ to: "/admin/products" });
  }

  if (loading)
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Edit product"
        description="Master catalog update. Change save hole reseller listing e o reflect hobe."
        actions={
          <button
            onClick={remove}
            className="inline-flex items-center gap-2 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        }
      />
      <form onSubmit={save} className="space-y-4">
        <div className="surface-card p-6">
          <h3 className="mb-4 text-sm font-semibold">Basics</h3>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Product name" required>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="SKU (optional)">
                <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Slug">
              <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputCls} placeholder="Auto from name if empty" />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Brand">
                <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inputCls}>
                  <option value="">— None —</option>
                  {brands.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                </select>
              </Field>
              <Field label="Category">
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                  <option value="">— None —</option>
                  {cats.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </Field>
            </div>
            <Field label="Description">
              <RichTextEditor value={description} onChange={setDescription} />
            </Field>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active (resellers ke dekhabe)
            </label>
          </div>
        </div>

        <div className="surface-card p-6">
          <h3 className="mb-3 text-sm font-semibold">Images</h3>
          <ImageUploader
            bucket="product-images"
            folder="master"
            value={images}
            onChange={setImages}
            multiple
            square
            maxImages={8}
            variant="square"
            label="Add image"
          />
        </div>

        <div className="surface-card p-6">
          <h3 className="mb-1 text-sm font-semibold">Pricing & delivery</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            <b>Buying price</b> = admin's purchase cost. <b>Reseller price</b> = the price you give resellers.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Buying price / Admin cost (৳)" required>
              <input required type="number" min={0} value={buying} onChange={(e) => setBuying(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Reseller price (৳)" required>
              <input required type="number" min={0} value={resellerPrice} onChange={(e) => setResellerPrice(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Packaging cost (৳)">
              <input type="number" min={0} value={packaging} onChange={(e) => setPackaging(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Delivery inside Dhaka (৳)">
              <input type="number" min={0} value={deliveryIn} onChange={(e) => setDeliveryIn(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Delivery outside Dhaka (৳)">
              <input type="number" min={0} value={deliveryOut} onChange={(e) => setDeliveryOut(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Stock">
              <input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Suggested sell price (৳)" required>
              <input required type="number" min={0} value={suggested} onChange={(e) => setSuggested(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Admin calculation</div>
              <PRow label="Reseller price" value={`৳${Number(resellerPrice) || 0}`} />
              <PRow label="− Buying price" value={`৳${Number(buying) || 0}`} />
              <PRow label="Admin profit / unit" value={`৳${calc.saProfit}`} strong success={calc.saProfit >= 0} />
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Reseller calculation (inside Dhaka)</div>
              <PRow label="Product (reseller price)" value={`৳${Number(resellerPrice) || 0}`} />
              <PRow label="+ Packaging" value={`৳${Number(packaging) || 0}`} />
              <PRow label="+ Delivery" value={`৳${Number(deliveryIn) || 0}`} />
              <PRow label="Reseller base cost" value={`৳${calc.resellerBaseIn}`} strong />
              <div className="mt-2 border-t pt-2">
                <PRow
                  label={`Suggested (৳${Number(suggested) || 0}) hole profit`}
                  value={`৳${calc.resellerProfitAtSuggestedIn}`}
                  strong
                  success={calc.resellerProfitAtSuggestedIn >= 0}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card p-6">
          <h3 className="mb-1 text-sm font-semibold">SEO</h3>
          <div className="space-y-3">
            <Field label="Meta title (≤ 60 chars)">
              <input maxLength={60} value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Meta description (≤ 160 chars)">
              <textarea maxLength={160} rows={2} value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Keywords (comma separated)">
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => nav({ to: "/admin/products" })}
            className="rounded-md border px-5 py-2.5 text-sm"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            className="btn-brand inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </button>
        </div>
      </form>
    </div>
  );
}

function PRow({ label, value, strong, success }: { label: string; value: string; strong?: boolean; success?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${strong ? "font-semibold" : ""} ${success === true ? "text-success" : success === false ? "text-destructive" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
