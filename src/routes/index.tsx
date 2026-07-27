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
            <Link to="/login" search={{ mode: "signup" }} className="btn-brand inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium sm:px-4">
              {c.nav.cta} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

        </div>
      </header>

      <section className="relative isolate overflow-hidden">
        {banner ? (
          <div className="pointer-events-none absolute inset-0 z-0">
            <img src={banner} alt="" aria-hidden="true" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/55" />
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-transparent to-accent/25 mix-blend-multiply" />
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-accent/15" />
            <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
            <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent/25 blur-3xl" />
          </div>
        )}
        <div className="relative z-10 mx-auto max-w-5xl px-4 pt-14 pb-20 text-center sm:px-6 sm:pt-24 sm:pb-28 lg:pt-32 lg:pb-32">
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur-md sm:px-4 sm:text-xs ${
              banner
                ? "border-white/30 bg-white/15 text-white"
                : "border-primary/25 bg-primary/10 text-primary"
            }`}
          >
            <Sparkles className={`h-3.5 w-3.5 shrink-0 ${banner ? "text-white" : "text-primary"}`} />
            <span className="truncate">{c.hero.badge}</span>
          </div>
          <h1
            className={`mx-auto mt-5 max-w-4xl text-balance text-[28px] font-extrabold leading-[1.25] tracking-tight sm:mt-6 sm:text-5xl sm:leading-[1.15] lg:text-6xl ${
              banner ? "text-white" : "text-foreground"
            }`}
            style={banner ? { textShadow: "0 2px 24px rgba(0,0,0,0.55)" } : undefined}
          >
            {c.hero.titleStart}{" "}
            <span
              className={
                banner
                  ? "inline-block bg-gradient-to-r from-white via-white to-white/90 bg-clip-text text-transparent"
                  : "inline-block bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent"
              }
            >
              {c.hero.titleHighlight}
            </span>
          </h1>
          <p
            className={`mx-auto mt-4 max-w-2xl text-pretty text-[15px] leading-relaxed sm:mt-6 sm:text-base lg:text-lg ${
              banner ? "font-medium text-white/95" : "text-muted-foreground"
            }`}
            style={banner ? { textShadow: "0 1px 12px rgba(0,0,0,0.5)" } : undefined}
          >
            {c.hero.subtitle}
          </p>
          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              to="/login"
              className="btn-brand inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold shadow-xl shadow-primary/30 transition-transform hover:-translate-y-0.5 sm:px-7 sm:text-base"
            >
              {c.hero.ctaPrimary} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold backdrop-blur-md transition sm:px-7 sm:text-base ${
                banner
                  ? "border border-white/40 bg-white/10 text-white hover:bg-white/20"
                  : "border border-border bg-card/80 text-foreground hover:bg-card"
              }`}
            >
              {c.hero.ctaSecondary}
            </Link>
          </div>
          {c.hero.badges.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium sm:mt-10 sm:gap-3 sm:text-xs">
              {c.hero.badges.map((b) => (
                <span
                  key={b}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 backdrop-blur-md ${
                    banner
                      ? "border border-white/25 bg-white/15 text-white"
                      : "border border-primary/20 bg-primary/5 text-foreground"
                  }`}
                >
                  <Check className={`h-3.5 w-3.5 shrink-0 ${banner ? "text-white" : "text-primary"}`} />
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="features" className="relative border-t border-border/60 bg-gradient-to-b from-muted/40 via-background to-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
              <Sparkles className="h-3 w-3" /> Features
            </div>
            <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
                {c.features.title}
              </span>
            </h2>
            {c.features.subtitle && (
              <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">{c.features.subtitle}</p>
            )}
          </div>
          <div className="mt-12 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {c.features.items.map((f, i) => {
              const Icon = ICON_MAP[f.icon] ?? Sparkles;
              return (
                <div
                  key={i}
                  className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
                >
                  <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
                  <div className="relative mb-4 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="relative text-base font-semibold sm:text-lg">{f.title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how" className="relative border-t border-border/60 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-64 -translate-y-1/2 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent-foreground">
              <ArrowRight className="h-3 w-3" /> Steps
            </div>
            <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              <span className="bg-gradient-to-r from-primary via-foreground to-accent bg-clip-text text-transparent">
                {c.how.title}
              </span>
            </h2>
            {c.how.subtitle && (
              <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">{c.how.subtitle}</p>
            )}
          </div>
          <div className="relative mt-12 grid gap-6 sm:mt-14 md:grid-cols-3">
            {c.how.steps.map((s, i) => (
              <div
                key={i}
                className="relative rounded-2xl border border-border/60 bg-card p-6 pt-8 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="absolute -top-5 left-6 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="text-base font-semibold sm:text-lg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="relative border-t border-border/60 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
          {c.cta.badge && (
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-[11px] font-medium text-primary sm:text-xs">
              <Sparkles className="h-3 w-3" /> {c.cta.badge}
            </div>
          )}
          <h2 className="mt-5 text-balance text-3xl font-extrabold tracking-tight sm:mt-6 sm:text-4xl lg:text-5xl">
            <span className="bg-gradient-to-r from-primary via-foreground to-accent bg-clip-text text-transparent">
              {c.cta.title}
            </span>
          </h2>
          {c.cta.subtitle && (
            <p className="mx-auto mt-5 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">{c.cta.subtitle}</p>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/login" className="btn-brand inline-flex items-center gap-2 rounded-lg px-7 py-3 text-sm font-semibold shadow-xl shadow-primary/30 transition-transform hover:-translate-y-0.5 sm:text-base">
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
