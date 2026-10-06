import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyReseller, getResellerStoreUrl } from "@/lib/app-data";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/ui-kit";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";

export const Route = createFileRoute("/_authenticated/reseller/settings")({
  component: SettingsPage,
});

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SettingsPage() {
  const { user } = useAuth();
  const [rid, setRid] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [storeName, setStoreName] = useState("");
  const [tagline, setTagline] = useState("");
  /** Store colors are managed per theme in the Theme page. */
  const [whatsapp, setWhatsapp] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [fb, setFb] = useState("");
  const [insta, setInsta] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [footer, setFooter] = useState("");
  const [logo, setLogo] = useState<UploadedImage[]>([]);
  const [favicon, setFavicon] = useState<UploadedImage[]>([]);
  const [og, setOg] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const r = await getMyReseller(user.id);
      if (!r) return setLoading(false);
      setRid(r.id);
      setCode(r.code);

      const activeUrl = await getResellerStoreUrl(r.id, r.code);
      setStoreUrl(activeUrl);

      const { data: s } = await supabase.from("reseller_settings").select("*").eq("reseller_id", r.id).maybeSingle();
      if (s) {
        setStoreName(s.store_name);
        setTagline(s.tagline ?? "");
        setWhatsapp(s.whatsapp ?? "");
        setSupportPhone(s.support_phone ?? "");
        setFb(s.facebook_url ?? "");
        setInsta(s.instagram_url ?? "");
        setTiktok(s.tiktok_url ?? "");
        setAnnouncement(s.announcement ?? "");
        setMetaDesc(s.meta_description ?? "");
        setFooter(s.footer_text ?? "");
        if (s.logo_url) setLogo([{ path: "", url: s.logo_url, bytes: 0 }]);
        if (s.favicon_url) setFavicon([{ path: "", url: s.favicon_url, bytes: 0 }]);
        if (s.og_image_url) setOg([{ path: "", url: s.og_image_url, bytes: 0 }]);
      } else {
        setStoreName(r.business_name);
      }
      setLoading(false);
    })();
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!rid) return;
    setBusy(true);
    const { error } = await supabase.from("reseller_settings").upsert(
      {
        reseller_id: rid,
        store_name: storeName,
        tagline: tagline || null,
        /** colors are theme palette driven now */
        primary_color: null,
        accent_color: null,
        whatsapp: whatsapp || null,
        support_phone: supportPhone || null,
        facebook_url: fb || null,
        instagram_url: insta || null,
        tiktok_url: tiktok || null,
        announcement: announcement || null,
        meta_description: metaDesc || null,
        footer_text: footer || null,
        logo_url: logo[0]?.url ?? null,
        favicon_url: favicon[0]?.url ?? null,
        og_image_url: og[0]?.url ?? null,
      },
      { onConflict: "reseller_id" },
    );
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Settings saved successfully");
  }

  if (loading)
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Store Configuration"
        description="Configure your storefront identity, branding assets, social channels, and SEO parameters."
        actions={
          <div className="flex items-center gap-2">
            {(storeUrl || code) && (
              <a
                href={storeUrl || `/s/${code}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
              >
                <ExternalLink className="h-4 w-4" /> View store
              </a>
            )}
            <button
              type="submit"
              form="reseller-settings-form"
              disabled={busy}
              className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </button>
          </div>
        }
      />

      <form id="reseller-settings-form" onSubmit={save} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Card 1: Identity */}
          <div className="surface-card space-y-4 p-6 rounded-xl border">
            <div>
              <h3 className="text-base font-semibold">Store Identity</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Basic brand identity and public announcement</p>
            </div>
            <Field label="Store name">
              <input required value={storeName} onChange={(e) => setStoreName(e.target.value)} className={inp} />
            </Field>
            <Field label="Tagline">
              <input value={tagline} onChange={(e) => setTagline(e.target.value)} className={inp} />
            </Field>
            <Field label="Announcement bar" hint="Shown at the very top of the storefront.">
              <input
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                className={inp}
                placeholder="Free delivery over ৳2000"
              />
            </Field>
            <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Store colors live in <span className="font-medium text-foreground">Theme</span> — pick a theme and one of its
              ready-made color palettes there.
            </p>
          </div>

          {/* Card 2: Brand assets */}
          <div className="surface-card space-y-4 p-6 rounded-xl border">
            <div>
              <h3 className="text-base font-semibold">Brand Assets</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Logos and preview images displayed across your store</p>
            </div>
            <Field label="Logo">
              <ImageUploader bucket="branding" folder={`${rid}/logo`} value={logo} onChange={setLogo} />
            </Field>
            <Field label="Favicon">
              <ImageUploader bucket="branding" folder={`${rid}/favicon`} value={favicon} onChange={setFavicon} />
            </Field>
            <Field label="OG share image">
              <ImageUploader bucket="branding" folder={`${rid}/og`} value={og} onChange={setOg} />
            </Field>
          </div>

          {/* Card 3: Contact & social */}
          <div className="surface-card space-y-4 p-6 rounded-xl border">
            <div>
              <h3 className="text-base font-semibold">Contact & Social Links</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Help customers reach you via phone, chat and social media</p>
            </div>
            <Field label="Support phone">
              <input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} className={inp} placeholder="01XXXXXXXXX" />
            </Field>
            <Field label="WhatsApp">
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inp} placeholder="8801XXXXXXXXX" />
            </Field>
            <Field label="Facebook page URL">
              <input value={fb} onChange={(e) => setFb(e.target.value)} className={inp} placeholder="https://facebook.com/yourpage" />
            </Field>
            <Field label="Instagram URL">
              <input value={insta} onChange={(e) => setInsta(e.target.value)} className={inp} placeholder="https://instagram.com/yourhandle" />
            </Field>
            <Field label="TikTok URL">
              <input value={tiktok} onChange={(e) => setTiktok(e.target.value)} className={inp} placeholder="https://tiktok.com/@yourhandle" />
            </Field>
          </div>

          {/* Card 4: SEO & footer */}
          <div className="surface-card space-y-4 p-6 rounded-xl border">
            <div>
              <h3 className="text-base font-semibold">SEO & Footer</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Search engine metadata and bottom copyright text</p>
            </div>
            <Field label="Meta description" hint="Brief summary shown in Google search results and shared links.">
              <textarea rows={3} value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} className={inp} placeholder="Describe your store in a few sentences..." />
            </Field>
            <Field label="Footer bottom text" hint="Appears at the very bottom copyright line.">
              <input value={footer} onChange={(e) => setFooter(e.target.value)} className={inp} placeholder="© 2026 All Rights Reserved" />
            </Field>
          </div>
        </div>

        {/* Global Save Action Footer (Outside the grid) */}
        <div className="surface-card flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
          <div>
            <h4 className="text-sm font-semibold">Save All Store Configurations</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Updates all 4 sections (Identity, Brand Assets, Contact & Social, SEO & Footer) at once.
            </p>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="btn-brand inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-all shadow hover:shadow-md disabled:opacity-50 w-full sm:w-auto min-w-[180px]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>Save all settings</span>
          </button>
        </div>
      </form>
    </div>
  );
}

