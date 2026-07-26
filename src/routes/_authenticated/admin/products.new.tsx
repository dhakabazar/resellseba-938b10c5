import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";
import { RichTextEditor } from "@/components/RichTextEditor";
import { uniqueProductSlug } from "@/lib/slug";

export const Route = createFileRoute("/_authenticated/admin/products/new")({
  component: NewProduct,
});

function NewProduct() {
  const nav = useNavigate();
  const [name, setName] = useState("");
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
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [keywords, setKeywords] = useState("");
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("brands").select("id,name").order("name").then(({ data }) => setBrands(data ?? []));
    supabase.from("categories").select("id,name").order("name").then(({ data }) => setCats(data ?? []));
  }, []);

  const calc = useMemo(() => {
    const buy = Number(buying) || 0;
    const rp = Number(resellerPrice) || 0;
    const pkg = Number(packaging) || 0;
    const di = Number(deliveryIn) || 0;
    const dOut = Number(deliveryOut) || 0;
    const sug = Number(suggested) || 0;
    const saProfit = rp - buy; // SA earns per unit from reseller
    const resellerBaseIn = rp + pkg + di; // reseller's minimum sell (inside dhaka)
    const resellerBaseOut = rp + pkg + dOut;
    const resellerProfitAtSuggestedIn = sug - rp - pkg; // delivery goes to SA
    return { saProfit, resellerBaseIn, resellerBaseOut, resellerProfitAtSuggestedIn };
  }, [buying, resellerPrice, packaging, deliveryIn, deliveryOut, suggested]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (Number(resellerPrice) < Number(buying)) {
      toast.error("Reseller price buying price er theke kom hote parbe na.");
      return;
    }
    if (Number(suggested) < calc.resellerBaseIn) {
      toast.error(`Suggested sell reseller er base cost ৳${calc.resellerBaseIn} er theke kom.`);
      return;
    }
    setBusy(true);
    try {
      const slug = await uniqueProductSlug(name);
      const { data: p, error } = await supabase
        .from("products")
        .insert({
          name,
          slug,
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
          og_image_url: images[0]?.url ?? null,
          meta_title: metaTitle || null,
          meta_description: metaDesc || null,
          keywords: keywords || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (images.length && p) {
        await supabase.from("product_images").insert(
          images.map((im, i) => ({
            product_id: p.id,
            url: im.url,
            is_primary: i === 0,
            sort_order: i,
          })),
        );
      }
      toast.success("Product created");
      nav({ to: "/admin/products" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="New product" description="Reseller ra ei product theke listing banabe." />
      <form onSubmit={save} className="space-y-4">
        <div className="surface-card p-6">
          <h3 className="mb-4 text-sm font-semibold">Basics</h3>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Product name" required>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="SKU (optional)">
                <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls} placeholder="Auto if empty" />
              </Field>
            </div>
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
            <b>Buying price</b> = apnar (SA) kena dam. <b>Reseller price</b> = reseller ke jei dame den — reseller eta dekhbe product price hisebe.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Buying price / SA cost (৳)" required>
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
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Super admin er hishab</div>
              <Row label="Reseller price" value={`৳${Number(resellerPrice) || 0}`} />
              <Row label="− Buying price" value={`৳${Number(buying) || 0}`} />
              <Row label="SA profit / unit" value={`৳${calc.saProfit}`} strong success={calc.saProfit >= 0} />
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Reseller er hishab (inside Dhaka)</div>
              <Row label="Product (reseller price)" value={`৳${Number(resellerPrice) || 0}`} />
              <Row label="+ Packaging" value={`৳${Number(packaging) || 0}`} />
              <Row label="+ Delivery" value={`৳${Number(deliveryIn) || 0}`} />
              <Row label="Reseller base cost" value={`৳${calc.resellerBaseIn}`} strong />
              <div className="mt-2 border-t pt-2">
                <Row
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
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save product
          </button>
        </div>
      </form>
    </div>
  );
}

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

function Row({ label, value, strong, success }: { label: string; value: string; strong?: boolean; success?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${strong ? "font-semibold" : ""} ${success === true ? "text-success" : success === false ? "text-destructive" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
