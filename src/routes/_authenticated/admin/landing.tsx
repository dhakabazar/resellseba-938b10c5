import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/landing")({
  component: LandingEditor,
});

type Feature = { icon: string; title: string; desc: string };
type Step = { title: string; desc: string };
type LandingContent = {
  nav: { features: string; how: string; pricing: string; signIn: string; cta: string };
  hero: {
    badge: string;
    titleStart: string;
    titleHighlight: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    badges: string[];
  };
  features: { title: string; subtitle: string; items: Feature[] };
  how: { title: string; subtitle: string; steps: Step[] };
  cta: { badge: string; title: string; subtitle: string; button: string };
  footer: { tagline: string };
};

const ICONS = ["Boxes", "Truck", "Wallet", "Megaphone", "Globe", "BarChart3", "ShieldCheck", "Sparkles"];

function LandingEditor() {
  const [c, setC] = useState<LandingContent | null>(null);
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
        description="Main domain e ei text gulo dekhabe. Sob Bangla te lekha ache — apnar moto change korun."
      />

      <Section title="Navigation">
        <Grid>
          <F label="Features"><I value={c.nav.features} onChange={(v) => update((d) => { d.nav.features = v; })} /></F>
          <F label="How it works"><I value={c.nav.how} onChange={(v) => update((d) => { d.nav.how = v; })} /></F>
          <F label="Pricing"><I value={c.nav.pricing} onChange={(v) => update((d) => { d.nav.pricing = v; })} /></F>
          <F label="Sign in"><I value={c.nav.signIn} onChange={(v) => update((d) => { d.nav.signIn = v; })} /></F>
          <F label="CTA button"><I value={c.nav.cta} onChange={(v) => update((d) => { d.nav.cta = v; })} /></F>
        </Grid>
      </Section>

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
      </Section>

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

      <Section title="How it works">
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

      <Section title="Call to action">
        <F label="Badge"><I value={c.cta.badge} onChange={(v) => update((d) => { d.cta.badge = v; })} /></F>
        <F label="Title"><I value={c.cta.title} onChange={(v) => update((d) => { d.cta.title = v; })} /></F>
        <F label="Subtitle"><T value={c.cta.subtitle} onChange={(v) => update((d) => { d.cta.subtitle = v; })} /></F>
        <F label="Button label"><I value={c.cta.button} onChange={(v) => update((d) => { d.cta.button = v; })} /></F>
      </Section>

      <Section title="Footer">
        <F label="Tagline"><I value={c.footer.tagline} onChange={(v) => update((d) => { d.footer.tagline = v; })} /></F>
      </Section>

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
