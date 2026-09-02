import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearAppDataCache } from "@/lib/app-data";
import { PageHeader } from "@/components/ui-kit";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [siteName, setSiteName] = useState("");
  const [flagshipCode, setFlagshipCode] = useState("");
  const [resellers, setResellers] = useState<{ code: string; business_name: string }[]>([]);
  const [tagline, setTagline] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [primary, setPrimary] = useState("#3b82f6");
  const [accent, setAccent] = useState("#f59e0b");
  const [secondary, setSecondary] = useState("#0ea5e9");
  const [highlight, setHighlight] = useState("#ec4899");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState<UploadedImage[]>([]);
  const [favicon, setFavicon] = useState<UploadedImage[]>([]);
  const [og, setOg] = useState<UploadedImage[]>([]);
  const [labelSize, setLabelSize] = useState("3x4");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("global_settings").select("*").eq("id", 1).maybeSingle();
      if (data) {
        setSiteName(data.site_name ?? "");
        setTagline(data.tagline ?? "");
        setMetaTitle(data.meta_title_template ?? "");
        setMetaDesc(data.meta_description ?? "");
        setPrimary(data.primary_color ?? "#3b82f6");
        setAccent(data.accent_color ?? "#f59e0b");
        setSecondary((data as any).secondary_color ?? "#0ea5e9");
        setHighlight((data as any).highlight_color ?? "#ec4899");
        setPhone(data.contact_phone ?? "");
        setEmail(data.contact_email ?? "");
        setFlagshipCode((data as any).flagship_reseller_code ?? "");
        setLabelSize((data as any).label_size || "3x4");
        if (data.logo_url) setLogo([{ path: "", url: data.logo_url, bytes: 0 }]);
        if ((data as any).favicon_url) setFavicon([{ path: "", url: (data as any).favicon_url, bytes: 0 }]);
        if (data.og_image_url) setOg([{ path: "", url: data.og_image_url, bytes: 0 }]);
      }
      const { data: rs } = await supabase.from("resellers").select("code,business_name").eq("status", "active").order("business_name");
      setResellers(rs ?? []);
      setLoading(false);
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("global_settings").upsert({
      id: 1,
      site_name: siteName,
      tagline: tagline || null,
      meta_title_template: metaTitle || null,
      meta_description: metaDesc || null,
      primary_color: primary,
      accent_color: accent,
      contact_phone: phone || null,
      contact_email: email || null,
      logo_url: logo[0]?.url ?? null,
      favicon_url: favicon[0]?.url ?? null,
      og_image_url: og[0]?.url ?? null,
      flagship_reseller_code: flagshipCode || null,
      label_size: labelSize,
    } as any);
    clearAppDataCache("settings");
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Settings saved — refresh the page to apply");
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
        title="Global settings"
        description="Branding, SEO and contact defaults for all reseller stores."
      />
      <form onSubmit={save} className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card space-y-3 p-6">
          <h3 className="text-sm font-semibold">Identity</h3>
          <Field label="Site name">
            <input value={siteName} onChange={(e) => setSiteName(e.target.value)} className={inp} required />
          </Field>
          <Field label="Tagline">
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} className={inp} />
          </Field>
          <Field label="Logo (sidebar + storefront header)">
            <ImageUploader bucket="branding" folder="global" value={logo} onChange={setLogo} />
          </Field>
          <Field label="Favicon (browser tab icon — square PNG/WebP)">
            <ImageUploader bucket="branding" folder="favicon" value={favicon} onChange={setFavicon} />
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Primary color">
              <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-full rounded-md border" />
            </Field>
            <Field label="Accent color">
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-full rounded-md border" />
            </Field>
            <Field label="Secondary color">
              <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-10 w-full rounded-md border" />
            </Field>
            <Field label="Highlight color">
              <input type="color" value={highlight} onChange={(e) => setHighlight(e.target.value)} className="h-10 w-full rounded-md border" />
            </Field>
          </div>
          <div>
            <div
              className="h-8 w-full rounded-lg"
              style={{ background: `linear-gradient(120deg, ${primary} 0%, ${secondary} 38%, ${highlight} 68%, ${accent} 100%)` }}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              These 4 colors drive the landing page, admin and reseller panels.
            </p>
          </div>
        </div>
        <div className="surface-card space-y-3 p-6">
          <h3 className="text-sm font-semibold">SEO & OG</h3>
          <Field label="Meta title template">
            <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className={inp} placeholder="%s — ResellHub" />
          </Field>
          <Field label="Meta description">
            <textarea rows={3} value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} className={inp} />
          </Field>
          <Field label="OG image (default share image)">
            <ImageUploader bucket="branding" folder="og" value={og} onChange={setOg} />
          </Field>
        </div>
        <div className="surface-card space-y-3 p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold">Flagship storefront</h3>
          <p className="text-xs text-muted-foreground">
            Shown on the main domain and preview URL. Leave blank to show the sign-in page.
          </p>
          <Field label="Flagship reseller">
            <select value={flagshipCode} onChange={(e) => setFlagshipCode(e.target.value)} className={inp}>
              <option value="">— None (show sign-in) —</option>
              {resellers.map((r) => (
                <option key={r.code} value={r.code}>{r.business_name} ({r.code})</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="surface-card space-y-3 p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold">Shipping labels</h3>
          <p className="text-xs text-muted-foreground">
            Default label size for bulk and single printing.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Default label size">
              <select 
                value={labelSize} 
                onChange={(e) => setLabelSize(e.target.value)} 
                className={inp}
              >
                <option value="3x3">3x3 inch</option>
                <option value="3x4">3x4 inch</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="surface-card space-y-3 p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold">Contact</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} /></Field>
            <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inp} /></Field>
          </div>
          <div>
            <button disabled={busy} className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label className="mb-1 block text-xs font-medium">{label}</label>{children}</div>);
}
