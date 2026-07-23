import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  Boxes,
  BarChart3,
  Truck,
  Wallet,
  Globe,
  ShieldCheck,
  Megaphone,
  Sparkles,
  Check,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reseller Platform — Nijer online store, zero investment" },
      {
        name: "description",
        content:
          "Bangladesh er first-class reseller platform. Product listing, courier, payment, marketing — ekta panel-e sob.",
      },
      { property: "og:title", content: "Reseller Platform" },
      { property: "og:description", content: "Master catalog theke product niye nijer store chalu korun." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RootResolver,
});

const ICON_MAP: Record<string, LucideIcon> = {
  Boxes, Truck, Wallet, Megaphone, Globe, BarChart3, ShieldCheck, Sparkles,
};

type Feature = { icon: string; title: string; desc: string };
type Step = { title: string; desc: string };
type LandingContent = {
  nav: { features: string; how: string; pricing: string; signIn: string; cta: string };
  hero: {
    badge: string; titleStart: string; titleHighlight: string; subtitle: string;
    ctaPrimary: string; ctaSecondary: string; badges: string[];
  };
  features: { title: string; subtitle: string; items: Feature[] };
  how: { title: string; subtitle: string; steps: Step[] };
  cta: { badge: string; title: string; subtitle: string; button: string };
  footer: { tagline: string };
};

const FALLBACK: LandingContent = {
  nav: { features: "ফিচার", how: "কীভাবে কাজ করে", pricing: "প্রাইসিং", signIn: "সাইন ইন", cta: "শুরু করুন" },
  hero: {
    badge: "বাংলাদেশের রিসেলার প্ল্যাটফর্ম",
    titleStart: "নিজের অনলাইন স্টোর চালু করুন",
    titleHighlight: "জিরো ইনভেস্টমেন্টে",
    subtitle: "মাস্টার ক্যাটালগ থেকে প্রোডাক্ট নিয়ে লিস্ট করুন।",
    ctaPrimary: "সাইনআপ করুন",
    ctaSecondary: "অ্যাডমিন সাইন ইন",
    badges: ["সেটআপ ফি নেই"],
  },
  features: { title: "ফিচার", subtitle: "", items: [] },
  how: { title: "কীভাবে শুরু করবেন", subtitle: "", steps: [] },
  cta: { badge: "", title: "শুরু করুন", subtitle: "", button: "সাইনআপ" },
  footer: { tagline: "" },
};

function RootResolver() {
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);
  const [content, setContent] = useState<LandingContent>(FALLBACK);
  const [siteName, setSiteName] = useState("Reseller");

  useEffect(() => {
    (async () => {
      const host = typeof window !== "undefined" ? window.location.hostname : "";
      const isPlatformHost =
        !host ||
        host === "localhost" ||
        host.endsWith(".lovable.app") ||
        host.endsWith(".lovableproject.com");

      if (!isPlatformHost) {
        const { data: dom } = await supabase
          .from("reseller_domains")
          .select("reseller_id, resellers(code, status)")
          .eq("hostname", host)
          .not("verified_at", "is", null)
          .maybeSingle();
        const r = (dom as { resellers?: { code: string; status: string } } | null)?.resellers;
        if (r && r.status === "active") {
          nav({ to: "/s/$code", params: { code: r.code }, replace: true });
          return;
        }
      }

      const { data } = await supabase
        .from("global_settings")
        .select("site_name, landing_content")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        setSiteName(data.site_name ?? "Reseller");
        const lc = (data as { landing_content?: LandingContent }).landing_content;
        if (lc) setContent(lc);
      }
      setChecking(false);
    })();
  }, [nav]);

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="h-8 w-8 animate-pulse rounded-full bg-primary/20" />
      </div>
    );
  }

  return <Landing c={content} siteName={siteName} />;
}

function Landing({ c, siteName }: { c: LandingContent; siteName: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              {siteName.charAt(0).toUpperCase()}
            </span>
            {siteName}
          </Link>
          <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">{c.nav.features}</a>
            <a href="#how" className="hover:text-foreground">{c.nav.how}</a>
            <a href="#pricing" className="hover:text-foreground">{c.nav.pricing}</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground sm:inline">
              {c.nav.signIn}
            </Link>
            <Link to="/auth" className="btn-brand inline-flex items-center gap-1 rounded-md px-4 py-2 text-sm font-medium">
              {c.nav.cta} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-10%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/25 blur-[120px]" />
          <div className="absolute right-[-10%] top-[30%] h-[380px] w-[380px] rounded-full bg-accent/30 blur-[120px]" />
        </div>
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 text-center sm:pt-28 sm:pb-32">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {c.hero.badge}
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            {c.hero.titleStart}{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              {c.hero.titleHighlight}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {c.hero.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth" className="btn-brand inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold shadow-lg shadow-primary/20">
              {c.hero.ctaPrimary} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/auth" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted">
              {c.hero.ctaSecondary}
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground">
            {c.hero.badges.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" /> {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.features.title}</h2>
            <p className="mt-3 text-muted-foreground">{c.features.subtitle}</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {c.features.items.map((f, i) => {
              const Icon = ICON_MAP[f.icon] ?? Sparkles;
              return (
                <div key={i} className="group surface-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.how.title}</h2>
            <p className="mt-3 text-muted-foreground">{c.how.subtitle}</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {c.how.steps.map((s, i) => (
              <div key={i} className="relative surface-card p-6">
                <div className="absolute -top-3 -left-3 grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-md">
                  {i + 1}
                </div>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          {c.cta.badge && (
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-1.5 text-xs text-muted-foreground">
              {c.cta.badge}
            </div>
          )}
          <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-5xl">{c.cta.title}</h2>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">{c.cta.subtitle}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth" className="btn-brand inline-flex items-center gap-2 rounded-md px-7 py-3 text-sm font-semibold shadow-lg shadow-primary/20">
              {c.cta.button} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
              {siteName.charAt(0).toUpperCase()}
            </span>
            © {new Date().getFullYear()} {siteName} · {c.footer.tagline}
          </div>
          <div className="flex gap-5">
            <Link to="/auth" className="hover:text-foreground">{c.nav.signIn}</Link>
            <a href="#features" className="hover:text-foreground">{c.nav.features}</a>
            <a href="#how" className="hover:text-foreground">{c.nav.how}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
