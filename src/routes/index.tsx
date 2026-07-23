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
type HeroImage = { path: string; url: string; bytes: number } | null;
type LandingContent = {
  nav: { features: string; how: string; pricing: string; signIn: string; cta: string };
  hero: {
    badge: string; titleStart: string; titleHighlight: string; subtitle: string;
    ctaPrimary: string; ctaSecondary: string; badges: string[];
    bannerImage?: HeroImage;
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
    bannerImage: null,
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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

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
        .select("site_name, logo_url, landing_content")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        setSiteName(data.site_name ?? "Reseller");
        setLogoUrl((data as { logo_url?: string | null }).logo_url ?? null);
        const lc = (data as unknown as { landing_content?: LandingContent }).landing_content;
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

  return <Landing c={content} siteName={siteName} logoUrl={logoUrl} />;
}

function Landing({ c, siteName, logoUrl }: { c: LandingContent; siteName: string; logoUrl: string | null }) {
  const banner = c.hero.bannerImage?.url;
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center" aria-label={siteName}>
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="h-12 max-w-44 shrink-0 object-contain sm:h-14" />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary text-lg font-bold text-primary-foreground sm:h-14 sm:w-14">
                {siteName.charAt(0).toUpperCase()}
              </span>
            )}
          </Link>
          <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">{c.nav.features}</a>
            <a href="#how" className="hover:text-foreground">{c.nav.how}</a>
            <a href="#pricing" className="hover:text-foreground">{c.nav.pricing}</a>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/login" className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground sm:inline">
              {c.nav.signIn}
            </Link>
            <Link to="/login" className="btn-brand inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium sm:px-4">
              {c.nav.cta} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden">
        {banner && (
          <div className="pointer-events-none absolute inset-0 z-0">
            <img
              src={banner}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover opacity-75"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/65 to-background" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute left-1/2 top-[-10%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/25 blur-[120px] sm:h-[520px] sm:w-[520px]" />
          <div className="absolute right-[-10%] top-[30%] h-[320px] w-[320px] rounded-full bg-accent/30 blur-[120px] sm:h-[380px] sm:w-[380px]" />
        </div>
        <div className="relative z-10 mx-auto max-w-4xl px-4 pt-16 pb-20 text-center sm:px-6 sm:pt-24 sm:pb-28 lg:pt-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur sm:px-4 sm:text-xs">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{c.hero.badge}</span>
          </div>
          <h1 className="mx-auto mt-5 max-w-3xl text-balance text-3xl font-bold leading-[1.5] tracking-tight sm:mt-6 sm:text-5xl sm:leading-[1.4] lg:text-6xl lg:leading-[1.35]">
            {c.hero.titleStart}{" "}
            <span className="inline-block bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              {c.hero.titleHighlight}
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:mt-6 sm:text-base lg:text-lg">
            {c.hero.subtitle}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3 sm:mt-8">
            <Link to="/login" className="btn-brand inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold shadow-lg shadow-primary/20 sm:px-6 sm:py-3">
              {c.hero.ctaPrimary} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 rounded-md border border-border bg-card/80 px-5 py-2.5 text-sm font-semibold backdrop-blur hover:bg-muted sm:px-6 sm:py-3">
              {c.hero.ctaSecondary}
            </Link>
          </div>
          {c.hero.badges.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-muted-foreground sm:gap-x-8 sm:text-xs">
              {c.hero.badges.map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> {b}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>




      <section id="features" className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">{c.features.title}</h2>
            {c.features.subtitle && (
              <p className="mt-3 text-pretty text-sm text-muted-foreground sm:text-base">{c.features.subtitle}</p>
            )}
          </div>
          <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {c.features.items.map((f, i) => {
              const Icon = ICON_MAP[f.icon] ?? Sparkles;
              return (
                <div key={i} className="group surface-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-6">
                  <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">{c.how.title}</h2>
            {c.how.subtitle && (
              <p className="mt-3 text-pretty text-sm text-muted-foreground sm:text-base">{c.how.subtitle}</p>
            )}
          </div>
          <div className="mt-10 grid gap-6 sm:mt-12 md:grid-cols-3">
            {c.how.steps.map((s, i) => (
              <div key={i} className="relative surface-card p-5 sm:p-6">
                <div className="absolute -top-3 -left-3 grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-md">
                  {i + 1}
                </div>
                <h3 className="mt-2 text-base font-semibold sm:text-lg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
          {c.cta.badge && (
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5 text-[11px] text-muted-foreground sm:px-4 sm:text-xs">
              {c.cta.badge}
            </div>
          )}
          <h2 className="mt-5 text-balance text-2xl font-bold tracking-tight sm:mt-6 sm:text-4xl lg:text-5xl">{c.cta.title}</h2>
          {c.cta.subtitle && (
            <p className="mx-auto mt-4 max-w-xl text-pretty text-sm text-muted-foreground sm:mt-5 sm:text-base">{c.cta.subtitle}</p>
          )}
          <div className="mt-7 flex flex-wrap justify-center gap-3 sm:mt-8">
            <Link to="/login" className="btn-brand inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-semibold shadow-lg shadow-primary/20 sm:px-7 sm:py-3">
              {c.cta.button} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>


      <footer className="border-t border-border/60 bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-center sm:text-left">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="h-10 max-w-36 shrink-0 object-contain" />
            ) : (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-primary text-sm font-bold text-primary-foreground">
                {siteName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate">© {new Date().getFullYear()} {siteName} · {c.footer.tagline}</span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-5">
            <Link to="/login" className="hover:text-foreground">{c.nav.signIn}</Link>
            <a href="#features" className="hover:text-foreground">{c.nav.features}</a>
            <a href="#how" className="hover:text-foreground">{c.nav.how}</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
