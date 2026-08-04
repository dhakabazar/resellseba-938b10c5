import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/ui-kit";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";
import { DEFAULT_THEME_ID, STORE_THEMES } from "@/lib/store-theme";

export const Route = createFileRoute("/_authenticated/reseller/design")({
  component: DesignPage,
});

function DesignPage() {
  const { user } = useAuth();
  const [rid, setRid] = useState<string | null>(null);
  const [code, setCode] = useState<string>("");
  const [theme, setTheme] = useState<string>(DEFAULT_THEME_ID);
  const [storeName, setStoreName] = useState("");
  const [tagline, setTagline] = useState("");
  const [primary, setPrimary] = useState("#3b82f6");
  const [accent, setAccent] = useState("#f59e0b");
  const [whatsapp, setWhatsapp] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [fb, setFb] = useState("");
  const [insta, setInsta] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [heroHeadline, setHeroHeadline] = useState("");
  const [heroSub, setHeroSub] = useState("");
  const [about, setAbout] = useState("");
  const [footer, setFooter] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [logo, setLogo] = useState<UploadedImage[]>([]);
  const [og, setOg] = useState<UploadedImage[]>([]);
  const [hero, setHero] = useState<UploadedImage[]>([]);
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
        setTheme(s.theme ?? DEFAULT_THEME_ID);
        setTagline(s.tagline ?? "");
        setPrimary(s.primary_color ?? "#3b82f6");
        setAccent(s.accent_color ?? "#f59e0b");
        setWhatsapp(s.whatsapp ?? "");
        setSupportPhone(s.support_phone ?? "");
        setFb(s.facebook_url ?? "");
        setInsta(s.instagram_url ?? "");
        setTiktok(s.tiktok_url ?? "");
        setAnnouncement(s.announcement ?? "");
        setHeroHeadline(s.hero_headline ?? "");
        setHeroSub(s.hero_subheadline ?? "");
        setAbout(s.about_text ?? "");
        setFooter(s.footer_text ?? "");
        setMetaDesc(s.meta_description ?? "");
        if (s.logo_url) setLogo([{ path: "", url: s.logo_url, bytes: 0 }]);
        if (s.og_image_url) setOg([{ path: "", url: s.og_image_url, bytes: 0 }]);
        if (s.hero_image_url) setHero([{ path: "", url: s.hero_image_url, bytes: 0 }]);
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
        theme,
        store_name: storeName,
        tagline: tagline || null,
        primary_color: primary,
        accent_color: accent,
        whatsapp: whatsapp || null,
        support_phone: supportPhone || null,
        facebook_url: fb || null,
        instagram_url: insta || null,
        tiktok_url: tiktok || null,
        announcement: announcement || null,
        hero_headline: heroHeadline || null,
        hero_subheadline: heroSub || null,
        about_text: about || null,
        footer_text: footer || null,
        meta_description: metaDesc || null,
        logo_url: logo[0]?.url ?? null,
        og_image_url: og[0]?.url ?? null,
        hero_image_url: hero[0]?.url ?? null,
      },
      { onConflict: "reseller_id" },
    );
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Store design saved");
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
        title="Store design"
        description="Theme, branding and storefront content."
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

      <form onSubmit={save} className="space-y-4">
        <div className="surface-card space-y-3 p-6">
          <div>
            <h3 className="text-sm font-semibold">Theme</h3>
            <p className="text-xs text-muted-foreground">Changes the full storefront layout, fonts and cards.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STORE_THEMES.map((t) => {
              const active = theme === t.id;
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={
                    "relative rounded-xl border p-4 text-left transition-colors " +
                    (active ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50")
                  }
                >
                  {active && (
                    <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                  <div className="flex gap-1">
                    {t.preview.map((c) => (
                      <span key={c} className="h-6 w-6 rounded-md border" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="mt-3 text-sm font-semibold">{t.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{t.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="surface-card space-y-3 p-6">
            <h3 className="text-sm font-semibold">Identity</h3>
            <Field label="Store name">
              <input required value={storeName} onChange={(e) => setStoreName(e.target.value)} className={inp} />
            </Field>
            <Field label="Tagline">
              <input value={tagline} onChange={(e) => setTagline(e.target.value)} className={inp} />
            </Field>
            <Field label="Logo">
              <ImageUploader bucket="branding" folder={`reseller-${rid}`} value={logo} onChange={setLogo} />
            </Field>
            <Field label="OG share image">
              <ImageUploader bucket="branding" folder={`reseller-${rid}-og`} value={og} onChange={setOg} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Primary color">
                <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-full rounded-md border" />
              </Field>
              <Field label="Accent color">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-full rounded-md border" />
              </Field>
            </div>
          </div>

          <div className="surface-card space-y-3 p-6">
            <h3 className="text-sm font-semibold">Homepage content</h3>
            <Field label="Announcement bar">
              <input value={announcement} onChange={(e) => setAnnouncement(e.target.value)} className={inp} placeholder="Free delivery over ৳2000" />
            </Field>
            <Field label="Hero headline">
              <input value={heroHeadline} onChange={(e) => setHeroHeadline(e.target.value)} className={inp} />
            </Field>
            <Field label="Hero subheadline">
              <textarea rows={2} value={heroSub} onChange={(e) => setHeroSub(e.target.value)} className={inp} />
            </Field>
            <Field label="Hero image">
              <ImageUploader bucket="branding" folder={`reseller-${rid}-hero`} value={hero} onChange={setHero} />
            </Field>
            <Field label="About text">
              <textarea rows={3} value={about} onChange={(e) => setAbout(e.target.value)} className={inp} />
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
            <Field label="Footer text">
              <input value={footer} onChange={(e) => setFooter(e.target.value)} className={inp} />
            </Field>
            <button
              disabled={busy}
              className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save design
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}
