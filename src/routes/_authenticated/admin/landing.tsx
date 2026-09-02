import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearAppDataCache } from "@/lib/app-data";
import { PageHeader } from "@/components/ui-kit";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { APP_ICON_NAMES } from "@/lib/icons";

export const Route = createFileRoute("/_authenticated/admin/landing")({
  component: LandingEditor,
});

type Feature = { icon: string; title: string; desc: string };
type Step = { title: string; desc: string };
type FlowStep = { icon: string; title: string; desc: string };
type FaqItem = { q: string; a: string };
type Story = { name: string; role?: string; location?: string; quote: string; metric?: string; metricLabel?: string; rating?: number; avatar?: UploadedImage | null };
type ContactPerson = { name: string; role?: string; phone?: string; whatsapp?: string; email?: string; photo?: UploadedImage | null };
type StatItem = { value: string; label: string };
type LandingContent = {
  nav: { features: string; how: string; categories: string; signIn: string; cta: string; faq?: string; stories?: string };
  hero: {
    badge: string;
    titleStart: string;
    titleHighlight: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    badges: string[];
    bannerImage?: UploadedImage | null;
    videoUrl?: string;
    videoTitle?: string;
  };
  stats?: { items: StatItem[] };
  about?: { badge: string; title: string; body: string; points: string[]; flow?: FlowStep[] };
  features: { title: string; subtitle: string; items: Feature[] };
  how: { title: string; subtitle: string; steps: Step[] };
  faq?: { title: string; subtitle: string; items: FaqItem[] };
  stories?: { title?: string; subtitle?: string; items: Story[] };
  contacts?: { badge?: string; title?: string; subtitle?: string; items: ContactPerson[] };
  cta: { badge: string; title: string; subtitle: string; button: string };
  footer: { tagline: string };
};

const ICONS = APP_ICON_NAMES;

const TABS = [
  { id: "nav", label: "Navigation" },
  { id: "hero", label: "Hero" },
  { id: "stats", label: "Stats" },
  { id: "features", label: "Features" },
  { id: "flow", label: "Work flow" },
  { id: "how", label: "How it works" },
  { id: "faq", label: "FAQ" },
  { id: "stories", label: "Stories" },
  { id: "contacts", label: "Contacts" },
  { id: "cta", label: "Call to action" },
  { id: "footer", label: "Footer" },
] as const;
type TabId = (typeof TABS)[number]["id"];



function LandingEditor() {
  const [c, setC] = useState<LandingContent | null>(null);
  const [tab, setTab] = useState<TabId>("nav");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("global_settings").select("landing_content").eq("id", 1).maybeSingle();
      setC((data as { landing_content: LandingContent } | null)?.landing_content ?? null);
    })();
  }, []);

  async function save() {
    if (!c) return;
    setBusy(true);
    const { error } = await supabase.from("global_settings").update({ landing_content: c as never }).eq("id", 1);
    clearAppDataCache("settings");
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Landing page save hoyeche");
  }

  if (!c) return <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const update = (fn: (draft: LandingContent) => void) => {
    const next = JSON.parse(JSON.stringify(c)) as LandingContent;
    fn(next);
    setC(next);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Landing page content"
        description="Edit the text shown on your main domain"
      />

      <div className="surface-card -mx-1 flex gap-1.5 overflow-x-auto p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              tab === t.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "nav" && (
      <Section title="Navigation (header menu)">
        <Grid>
          <F label="Features"><I value={c.nav.features} onChange={(v) => update((d) => { d.nav.features = v; })} /></F>
          <F label="How it works"><I value={c.nav.how} onChange={(v) => update((d) => { d.nav.how = v; })} /></F>
          <F label="Categories"><I value={c.nav.categories} onChange={(v) => update((d) => { d.nav.categories = v; })} /></F>
          <F label="Stories"><I value={c.nav.stories ?? ""} onChange={(v) => update((d) => { d.nav.stories = v; })} /></F>
          <F label="FAQ"><I value={c.nav.faq ?? ""} onChange={(v) => update((d) => { d.nav.faq = v; })} /></F>
          <F label="Sign in"><I value={c.nav.signIn} onChange={(v) => update((d) => { d.nav.signIn = v; })} /></F>
          <F label="CTA button"><I value={c.nav.cta} onChange={(v) => update((d) => { d.nav.cta = v; })} /></F>
        </Grid>
      </Section>
      )}

      {tab === "hero" && (
      <Section title="Hero section">
        <F label="Top badge"><I value={c.hero.badge} onChange={(v) => update((d) => { d.hero.badge = v; })} /></F>
        <Grid>
          <F label="Title (start)"><I value={c.hero.titleStart} onChange={(v) => update((d) => { d.hero.titleStart = v; })} /></F>
          <F label="Title (highlighted part)"><I value={c.hero.titleHighlight} onChange={(v) => update((d) => { d.hero.titleHighlight = v; })} /></F>
        </Grid>
        <F label="Subtitle"><T value={c.hero.subtitle} onChange={(v) => update((d) => { d.hero.subtitle = v; })} /></F>
        <Grid>
          <F label="Primary CTA"><I value={c.hero.ctaPrimary} onChange={(v) => update((d) => { d.hero.ctaPrimary = v; })} /></F>
          <F label="Secondary CTA"><I value={c.hero.ctaSecondary} onChange={(v) => update((d) => { d.hero.ctaSecondary = v; })} /></F>
        </Grid>
        <F label="Trust badges (comma separated)">
          <I value={c.hero.badges.join(", ")} onChange={(v) => update((d) => { d.hero.badges = v.split(",").map(s => s.trim()).filter(Boolean); })} />
        </F>
        <Grid>
          <F label="Hero video link (YouTube or mp4) — khali rakhle sudhu banner dekhabe">
            <I value={c.hero.videoUrl ?? ""} onChange={(v) => update((d) => { d.hero.videoUrl = v; })} />
          </F>
          <F label="Video title (play button er niche dekhabe)">
            <I value={c.hero.videoTitle ?? ""} onChange={(v) => update((d) => { d.hero.videoTitle = v; })} />
          </F>
        </Grid>
        <F label="Hero banner image (auto-compressed to WebP ≤200KB)">
          <ImageUploader
            bucket="branding"
            folder="landing-hero"
            value={c.hero.bannerImage ? [c.hero.bannerImage] : []}
            onChange={(v) => update((d) => { d.hero.bannerImage = v[0] ?? null; })}
            label="Upload banner"
            variant="hero"
          />
        </F>
      </Section>
      )}

      {tab === "stats" && (
      <Section title="Stats band (khali rakhle auto count dekhabe)">
        <div className="space-y-3">
          {(c.stats?.items ?? []).map((s, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Stat #{i + 1}</span>
                <button type="button" onClick={() => update((d) => { d.stats!.items.splice(i, 1); })} className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <Grid>
                <F label="Value"><I value={s.value} onChange={(v) => update((d) => { d.stats!.items[i].value = v; })} /></F>
                <F label="Label"><I value={s.label} onChange={(v) => update((d) => { d.stats!.items[i].label = v; })} /></F>
              </Grid>
            </div>
          ))}
          {(c.stats?.items?.length ?? 0) < 4 && (
            <button type="button" onClick={() => update((d) => { d.stats = { items: [...(d.stats?.items ?? []), { value: "10,000+", label: "প্রোডাক্ট" }] }; })} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
              <Plus className="h-3.5 w-3.5" /> Stat add
            </button>
          )}
        </div>
      </Section>
      )}

      {tab === "features" && (
      <Section title="Features section">
        <F label="Title"><I value={c.features.title} onChange={(v) => update((d) => { d.features.title = v; })} /></F>
        <F label="Subtitle"><T value={c.features.subtitle} onChange={(v) => update((d) => { d.features.subtitle = v; })} /></F>
        <div className="space-y-3">
          {c.features.items.map((f, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Feature #{i + 1}</span>
                <button type="button" onClick={() => update((d) => { d.features.items.splice(i, 1); })} className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <Grid>
                <F label="Icon">
                  <select value={f.icon} onChange={(e) => update((d) => { d.features.items[i].icon = e.target.value; })} className={inp}>
                    {ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                </F>
                <F label="Title"><I value={f.title} onChange={(v) => update((d) => { d.features.items[i].title = v; })} /></F>
              </Grid>
              <F label="Description"><T value={f.desc} onChange={(v) => update((d) => { d.features.items[i].desc = v; })} /></F>
            </div>
          ))}
          <button type="button" onClick={() => update((d) => { d.features.items.push({ icon: "Sparkles", title: "নতুন ফিচার", desc: "বর্ণনা" }); })} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
            <Plus className="h-3.5 w-3.5" /> Feature add
          </button>
        </div>
      </Section>
      )}

      {tab === "flow" && (
      <Section title="আমরা কীভাবে কাজ করি (flow section)">
        <Grid>
          <F label="Badge"><I value={c.about?.badge ?? ""} onChange={(v) => update((d) => { d.about = { ...(d.about ?? { badge: "", title: "", body: "", points: [] }), badge: v }; })} /></F>
          <F label="Title"><I value={c.about?.title ?? ""} onChange={(v) => update((d) => { d.about = { ...(d.about ?? { badge: "", title: "", body: "", points: [] }), title: v }; })} /></F>
        </Grid>
        <F label="Intro text"><T value={c.about?.body ?? ""} onChange={(v) => update((d) => { d.about = { ...(d.about ?? { badge: "", title: "", body: "", points: [] }), body: v }; })} /></F>
        <div className="space-y-3">
          {(c.about?.flow ?? []).map((f, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Step #{i + 1}</span>
                <button type="button" onClick={() => update((d) => { d.about!.flow!.splice(i, 1); })} className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <Grid>
                <F label="Icon">
                  <select
                    value={f.icon}
                    onChange={(e) => update((d) => { d.about!.flow![i].icon = e.target.value; })}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    {ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                </F>
                <F label="Title"><I value={f.title} onChange={(v) => update((d) => { d.about!.flow![i].title = v; })} /></F>
              </Grid>
              <F label="Description"><T value={f.desc} onChange={(v) => update((d) => { d.about!.flow![i].desc = v; })} /></F>
            </div>
          ))}
          <button
            type="button"
            onClick={() => update((d) => {
              d.about = { ...(d.about ?? { badge: "", title: "", body: "", points: [] }), flow: [...(d.about?.flow ?? []), { icon: "ClipboardList", title: "", desc: "" }] };
            })}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Step add
          </button>
        </div>
      </Section>
      )}


      {tab === "how" && (
      <Section title="How it works (steps)">
        <F label="Title"><I value={c.how.title} onChange={(v) => update((d) => { d.how.title = v; })} /></F>
        <F label="Subtitle"><I value={c.how.subtitle} onChange={(v) => update((d) => { d.how.subtitle = v; })} /></F>
        <div className="space-y-3">
          {c.how.steps.map((s, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Step #{i + 1}</span>
                <button type="button" onClick={() => update((d) => { d.how.steps.splice(i, 1); })} className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <F label="Title"><I value={s.title} onChange={(v) => update((d) => { d.how.steps[i].title = v; })} /></F>
              <F label="Description"><T value={s.desc} onChange={(v) => update((d) => { d.how.steps[i].desc = v; })} /></F>
            </div>
          ))}
          <button type="button" onClick={() => update((d) => { d.how.steps.push({ title: "নতুন স্টেপ", desc: "বর্ণনা" }); })} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
            <Plus className="h-3.5 w-3.5" /> Step add
          </button>
        </div>
      </Section>
      )}

      {tab === "faq" && (
      <Section title="FAQ">
        <F label="Title"><I value={c.faq?.title ?? ""} onChange={(v) => update((d) => { d.faq = { ...(d.faq ?? { title: "", subtitle: "", items: [] }), title: v }; })} /></F>
        <F label="Subtitle"><T value={c.faq?.subtitle ?? ""} onChange={(v) => update((d) => { d.faq = { ...(d.faq ?? { title: "", subtitle: "", items: [] }), subtitle: v }; })} /></F>
        <div className="space-y-3">
          {(c.faq?.items ?? []).map((item, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">FAQ #{i + 1}</span>
                <button type="button" onClick={() => update((d) => { d.faq!.items.splice(i, 1); })} className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <F label="Question"><I value={item.q} onChange={(v) => update((d) => { d.faq!.items[i].q = v; })} /></F>
              <F label="Answer"><T value={item.a} onChange={(v) => update((d) => { d.faq!.items[i].a = v; })} /></F>
            </div>
          ))}
          <button type="button" onClick={() => update((d) => { d.faq = { ...(d.faq ?? { title: "", subtitle: "", items: [] }), items: [...(d.faq?.items ?? []), { q: "", a: "" }] }; })} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
            <Plus className="h-3.5 w-3.5" /> FAQ add
          </button>
        </div>
      </Section>
      )}

      {tab === "stories" && (
      <Section title="Reseller stories">
        <Grid>
          <F label="Title"><I value={c.stories?.title ?? ""} onChange={(v) => update((d) => { d.stories = { ...(d.stories ?? { items: [] }), title: v }; })} /></F>
          <F label="Subtitle"><I value={c.stories?.subtitle ?? ""} onChange={(v) => update((d) => { d.stories = { ...(d.stories ?? { items: [] }), subtitle: v }; })} /></F>
        </Grid>
        <div className="space-y-3">
          {(c.stories?.items ?? []).map((s, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Story #{i + 1}</span>
                <button type="button" onClick={() => update((d) => { d.stories!.items.splice(i, 1); })} className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <Grid>
                <F label="Name"><I value={s.name} onChange={(v) => update((d) => { d.stories!.items[i].name = v; })} /></F>
                <F label="Role"><I value={s.role ?? ""} onChange={(v) => update((d) => { d.stories!.items[i].role = v; })} /></F>
                <F label="Location"><I value={s.location ?? ""} onChange={(v) => update((d) => { d.stories!.items[i].location = v; })} /></F>
                <F label="Rating (1-5)"><I value={String(s.rating ?? 5)} onChange={(v) => update((d) => { d.stories!.items[i].rating = Math.max(0, Math.min(5, Number(v) || 0)); })} /></F>
                <F label="Metric (e.g. ৳৩২,০০০)"><I value={s.metric ?? ""} onChange={(v) => update((d) => { d.stories!.items[i].metric = v; })} /></F>
                <F label="Metric label"><I value={s.metricLabel ?? ""} onChange={(v) => update((d) => { d.stories!.items[i].metricLabel = v; })} /></F>
              </Grid>
              <F label="Quote"><T value={s.quote} onChange={(v) => update((d) => { d.stories!.items[i].quote = v; })} /></F>
              <F label="Photo (auto WebP ≤200KB)">
                <ImageUploader
                  bucket="branding"
                  folder="landing-stories"
                  value={s.avatar ? [s.avatar] : []}
                  onChange={(v) => update((d) => { d.stories!.items[i].avatar = v[0] ?? null; })}
                  label="Upload photo"
                />
              </F>
            </div>
          ))}
          <button type="button" onClick={() => update((d) => { d.stories = { ...(d.stories ?? {}), items: [...(d.stories?.items ?? []), { name: "", role: "", location: "", quote: "", metric: "", metricLabel: "", rating: 5, avatar: null }] }; })} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
            <Plus className="h-3.5 w-3.5" /> Story add
          </button>
        </div>
      </Section>
      )}

      {tab === "contacts" && (
      <Section title="Contact section (last section on landing page)">
        <Grid>
          <F label="Badge"><I value={c.contacts?.badge ?? ""} onChange={(v) => update((d) => { d.contacts = { ...(d.contacts ?? { items: [] }), badge: v }; })} /></F>
          <F label="Title"><I value={c.contacts?.title ?? ""} onChange={(v) => update((d) => { d.contacts = { ...(d.contacts ?? { items: [] }), title: v }; })} /></F>
        </Grid>
        <F label="Subtitle"><T value={c.contacts?.subtitle ?? ""} onChange={(v) => update((d) => { d.contacts = { ...(d.contacts ?? { items: [] }), subtitle: v }; })} /></F>
        <div className="space-y-3">
          {(c.contacts?.items ?? []).map((p, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Contact #{i + 1}</span>
                <button type="button" onClick={() => update((d) => { d.contacts!.items.splice(i, 1); })} className="text-destructive hover:opacity-70"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <Grid>
                <F label="Name"><I value={p.name} onChange={(v) => update((d) => { d.contacts!.items[i].name = v; })} /></F>
                <F label="Designation (CEO, Manager...)"><I value={p.role ?? ""} onChange={(v) => update((d) => { d.contacts!.items[i].role = v; })} /></F>
                <F label="Phone"><I value={p.phone ?? ""} onChange={(v) => update((d) => { d.contacts!.items[i].phone = v; })} /></F>
                <F label="WhatsApp (8801XXXXXXXXX)"><I value={p.whatsapp ?? ""} onChange={(v) => update((d) => { d.contacts!.items[i].whatsapp = v; })} /></F>
                <F label="Email"><I value={p.email ?? ""} onChange={(v) => update((d) => { d.contacts!.items[i].email = v; })} /></F>
              </Grid>
              <F label="Photo (auto WebP ≤200KB)">
                <ImageUploader
                  bucket="branding"
                  folder="landing-contacts"
                  value={p.photo ? [p.photo] : []}
                  onChange={(v) => update((d) => { d.contacts!.items[i].photo = v[0] ?? null; })}
                  label="Upload photo"
                />
              </F>
            </div>
          ))}
          <button type="button" onClick={() => update((d) => { d.contacts = { ...(d.contacts ?? {}), items: [...(d.contacts?.items ?? []), { name: "", role: "", phone: "", whatsapp: "", email: "", photo: null }] }; })} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
            <Plus className="h-3.5 w-3.5" /> Contact add
          </button>
        </div>
      </Section>
      )}

      {tab === "cta" && (
      <Section title="Call to action">
        <F label="Badge"><I value={c.cta.badge} onChange={(v) => update((d) => { d.cta.badge = v; })} /></F>
        <F label="Title"><I value={c.cta.title} onChange={(v) => update((d) => { d.cta.title = v; })} /></F>
        <F label="Subtitle"><T value={c.cta.subtitle} onChange={(v) => update((d) => { d.cta.subtitle = v; })} /></F>
        <F label="Button label"><I value={c.cta.button} onChange={(v) => update((d) => { d.cta.button = v; })} /></F>
      </Section>
      )}

      {tab === "footer" && (
      <Section title="Footer">
        <F label="Tagline"><I value={c.footer.tagline} onChange={(v) => update((d) => { d.footer.tagline = v; })} /></F>
      </Section>
      )}

      <div className="sticky bottom-4 flex justify-end">
        <button onClick={save} disabled={busy} className="btn-brand inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium shadow-lg disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save landing page
        </button>
      </div>
    </div>
  );
}

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
function I({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} className={inp} />;
}
function T({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={inp} />;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-medium">{label}</label>{children}</div>;
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card space-y-3 p-6">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}
