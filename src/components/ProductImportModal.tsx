import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CloudDownload, Link2, Loader2, Pencil, Save, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchImportImage, importProductFromUrl } from "@/lib/product-import.functions";
import { importImagesToStorage, saveImportDraft } from "@/lib/product-import";
import { uniqueProductSlug } from "@/lib/slug";

type Mode = "direct" | "edit";

/**
 * Paste a marketplace product link (Daraz / Alibaba / AliExpress / Amazon /
 * WooCommerce or any OG-tagged shop) and either save it straight away as an
 * inactive draft, or open the product form pre-filled for editing.
 */
export function ProductImportModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: () => void }) {
  const nav = useNavigate();
  const runImport = useServerFn(importProductFromUrl);
  const pullImage = useServerFn(fetchImportImage);
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("edit");
  const [step, setStep] = useState<string>("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      setStep("Reading the product page…");
      const data = await runImport({ data: { url: url.trim() } });

      setStep(`Downloading ${Math.min(data.images.length, 6)} image(s)…`);
      const images = await importImagesToStorage(data.images, pullImage, 6, (d, t) =>
        setStep(`Downloading image ${d}/${t}…`),
      );


      if (mode === "edit") {
        saveImportDraft({ ...data, images });
        toast.success(`${data.source} theke data ready — ekhon edit kore save korun.`);
        onClose();
        nav({ to: "/admin/products/new" });
        return;
      }

      setStep("Saving product…");
      const price = data.price ?? 0;
      const [{ data: brandRow }, { data: catRow }] = await Promise.all([
        data.brand
          ? supabase.from("brands").select("id").ilike("name", data.brand).maybeSingle()
          : Promise.resolve({ data: null }),
        data.category
          ? supabase.from("categories").select("id").ilike("name", data.category).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const slug = await uniqueProductSlug(data.name);
      const { data: p, error } = await supabase
        .from("products")
        .insert({
          name: data.name,
          slug,
          sku: data.sku || null,
          description: data.description || null,
          short_description: data.shortDescription || null,
          brand_id: (brandRow as { id: string } | null)?.id ?? null,
          category_id: (catRow as { id: string } | null)?.id ?? null,
          buying_price: price,
          reseller_price: price,
          suggested_price: price,
          packaging_cost: 0,
          delivery_mode: "area",
          delivery_inside: 60,
          delivery_outside: 130,
          stock: 0,
          is_active: false,
          og_image_url: images[0]?.url ?? null,
          meta_title: data.metaTitle || null,
          meta_description: data.metaDescription || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      if (images.length && p) {
        await supabase.from("product_images").insert(
          images.map((im, i) => ({ product_id: p.id, url: im.url, is_primary: i === 0, sort_order: i })),
        );
      }
      toast.success("Product saved as inactive draft — price check kore active korun.");
      setUrl("");
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-2xl">
        <div className="flex items-start gap-3 border-b bg-primary/10 px-5 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <CloudDownload className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">Import product from URL</h3>
            <p className="text-xs text-muted-foreground">
              Daraz, Alibaba, AliExpress, Amazon, WooCommerce — automated details & media extractor
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={go} className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1 block text-xs font-medium">Target product link *</label>
            <div className="flex items-center gap-2 rounded-md border bg-background px-3">
              <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                required
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.daraz.com.bd/products/..."
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              https only, scripts stripped, images re-encoded to ≤200KB WebP before saving.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <ModeCard
              active={mode === "direct"}
              onPick={() => setMode("direct")}
              icon={<Save className="h-4 w-4" />}
              title="Just add"
              text="Ja data pabe tai save hobe (inactive draft), modal asbe na."
            />
            <ModeCard
              active={mode === "edit"}
              onPick={() => setMode("edit")}
              icon={<Pencil className="h-4 w-4" />}
              title="Edit then save"
              text="Product form prefilled hobe — poriborton kore save korben."
            />
          </div>

          {busy && step && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {step}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              disabled={busy}
              className="btn-brand inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
              {mode === "direct" ? "Import & save" : "Import & edit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModeCard({
  active, onPick, icon, title, text,
}: {
  active: boolean; onPick: () => void; icon: React.ReactNode; title: string; text: string;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`rounded-lg border p-3 text-left transition ${
        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon} {title}
      </span>
      <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{text}</span>
    </button>
  );
}
