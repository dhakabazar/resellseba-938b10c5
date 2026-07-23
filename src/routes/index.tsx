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
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reseller Platform — Nijer online store, zero investment" },
      {
        name: "description",
        content:
          "Bangladesh er first-class reseller platform. Product listing, courier, payment, marketing — ekta panel-e sob. Ajkei nijer store chalu korun.",
      },
      { property: "og:title", content: "Reseller Platform — Nijer online store, zero investment" },
      {
        property: "og:description",
        content:
          "Master catalog theke product niye nijer store chalu korun. Courier, bKash/SSLCommerz, Facebook & TikTok ads — sob built-in.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RootResolver,
});

function RootResolver() {
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const host = typeof window !== "undefined" ? window.location.hostname : "";
      // Only custom domains resolve to a reseller store. Main / preview domain
      // always shows the platform landing page.
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

  return <Landing />;
}

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              R
            </span>
            Reseller
          </Link>
          <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">Kivabe kaj kore</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground sm:inline"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              className="btn-brand inline-flex items-center gap-1 rounded-md px-4 py-2 text-sm font-medium"
            >
              Start free <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-10%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/25 blur-[120px]" />
          <div className="absolute right-[-10%] top-[30%] h-[380px] w-[380px] rounded-full bg-accent/30 blur-[120px]" />
        </div>
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 text-center sm:pt-28 sm:pb-32">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Bangladesh er next-gen reseller platform
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Nijer online store chalu korun{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              zero investment-e
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Master catalog theke product niye list korun, nijer profit bosan,
            customer order pele admin courier book korbe. Payment, marketing, domain —
            sob ekta dashboard theke.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              className="btn-brand inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold shadow-lg shadow-primary/20"
            >
              Reseller hote signup korun <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted"
            >
              Admin sign in
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> No setup fee</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Steadfast + Pathao ready</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> bKash · SSLCommerz</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Custom domain</span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ekta panel-e sob kichhu</h2>
            <p className="mt-3 text-muted-foreground">
              Reseller business chalanor jonno ja ja lage — ready, integrated, dynamic.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group surface-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Kivabe suru korben</h2>
            <p className="mt-3 text-muted-foreground">Teen ta step — beshi na.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative surface-card p-6">
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

      {/* PRICING / CTA */}
      <section id="pricing" className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-1.5 text-xs text-muted-foreground">
            💚 Ekhon join korle 100% free
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-5xl">
            Aj-i shuru korun. Kaal-i first order.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            No credit card, no hidden fee. Signup korun, product list korun, share korun — order ashbei.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              className="btn-brand inline-flex items-center gap-2 rounded-md px-7 py-3 text-sm font-semibold shadow-lg shadow-primary/20"
            >
              Free signup <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60 bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
              R
            </span>
            © {new Date().getFullYear()} Reseller Platform
          </div>
          <div className="flex gap-5">
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: Boxes,
    title: "Master catalog + listing",
    desc: "Admin er premium products theke pochando gulo niye nijer store-e list korun, custom profit bosan.",
  },
  {
    icon: Truck,
    title: "Courier integrated",
    desc: "Steadfast, Pathao auto booking. Parcel status auto sync — manual jhamela nei.",
  },
  {
    icon: Wallet,
    title: "Payments ready",
    desc: "bKash Personal, SSLCommerz, Rocket, Nagad — customer er pochando payment.",
  },
  {
    icon: Megaphone,
    title: "Ads & pixels",
    desc: "Facebook Pixel + CAPI, TikTok Events, GA4 — global ba per-reseller override.",
  },
  {
    icon: Globe,
    title: "Custom domain",
    desc: "Cloudflare SaaS diye nijer domain connect korun. Independent store like your own brand.",
  },
  {
    icon: BarChart3,
    title: "Live analytics",
    desc: "Revenue, profit, top products — real-time chart. Payout request click-e.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    desc: "Row-level security, magic-byte image validation, compressed uploads — safe & fast.",
  },
  {
    icon: Sparkles,
    title: "Reseller design tools",
    desc: "Logo, color, favicon, OG image, tagline — nijer branding, kono coding lagbe na.",
  },
  {
    icon: Wallet,
    title: "Leader commission",
    desc: "Leader reseller downline theke auto commission earn korbe. Full transparent.",
  },
];

const STEPS = [
  {
    title: "Signup korun",
    desc: "Email diye account khulun, reseller onboarding form fill korun — 30 second-er kaaj.",
  },
  {
    title: "Product list korun",
    desc: "Catalog theke pochando product niye nijer selling price set korun. Profit auto calculate hobe.",
  },
  {
    title: "Store share korun",
    desc: "Nijer store link Facebook/WhatsApp e share korun. Order ele admin courier book korbe.",
  },
];
