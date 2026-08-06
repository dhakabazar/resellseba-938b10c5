import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/ui-kit";
import { ExternalLink, Loader2 } from "lucide-react";
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
      const { data: r } = await supabase
        .from("resellers")
        .select("id,business_name,code")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!r) return setLoading(false);
      setRid(r.id);
      setCode(r.code);
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
    else toast.success("Settings saved");
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
        title="Store Configuration"
        description="Configure your storefront identity, branding assets, and SEO parameters."
        actions={
          code ? (
            <a
              href={`/s/${code}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <ExternalLink className="h-4 w-4" /> View store
            </a>
          ) : undefined
        }
      />

      <form onSubmit={save} className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card space-y-3 p-6">
          <h3 className="text-sm font-semibold">Identity</h3>
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
            Store colors live in <span className="font-medium">Theme</span> — pick a theme and one of its
            ready-made color palettes there.
          </p>
        </div>

        <div className="surface-card space-y-3 p-6">
          <h3 className="text-sm font-semibold">Brand assets</h3>
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

        <div className="surface-card space-y-3 p-6">
          <h3 className="text-sm font-semibold">Contact & social</h3>
          <Field label="Support phone">
            <input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} className={inp} placeholder="01XXXXXXXXX" />
          </Field>
          <Field label="WhatsApp">
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inp} placeholder="8801XXXXXXXXX" />
          </Field>
          <Field label="Facebook page URL">
            <input value={fb} onChange={(e) => setFb(e.target.value)} className={inp} />
          </Field>
          <Field label="Instagram URL">
            <input value={insta} onChange={(e) => setInsta(e.target.value)} className={inp} />
          </Field>
          <Field label="TikTok URL">
            <input value={tiktok} onChange={(e) => setTiktok(e.target.value)} className={inp} />
          </Field>
        </div>

        <div className="surface-card space-y-3 p-6">
          <h3 className="text-sm font-semibold">SEO & footer</h3>
          <Field label="Meta description">
            <textarea rows={3} value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} className={inp} />
          </Field>
          <Field label="Footer bottom text">
            <input value={footer} onChange={(e) => setFooter(e.target.value)} className={inp} />
          </Field>
          <button
            disabled={busy}
            className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save settings
          </button>
        </div>
      </form>
    </div>
  );
}
