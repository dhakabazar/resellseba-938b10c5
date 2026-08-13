import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getPublicStats } from "@/lib/landing.functions";
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
  Copy,
  Download,
  ShoppingBag,
  Layers,
  
  Menu,
  X,
  Users,
  ClipboardList,
  Send,
  PackageCheck,
  PiggyBank,
  BanknoteArrowDown,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { bdt } from "@/lib/finance-report";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reseller Platform — Nijer online store, zero investment" },
      {
        name: "description",
        content:
          "Bangladesh er first-class reseller platform. Product listing, courier, payment, marketing — ekta panel-e sob.",
      },
      { property: "og:title", content: "Reseller Platform — Nijer online store, zero investment" },
      { property: "og:description", content: "Bangladesh er first-class reseller platform. Product listing, courier, payment, marketing — ekta panel-e sob." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RootResolver,
});

const ICON_MAP: Record<string, LucideIcon> = {
  Boxes, Truck, Wallet, Megaphone, Globe, BarChart3, ShieldCheck, Sparkles,
  ClipboardList, Send, PackageCheck, PiggyBank, BanknoteArrowDown, ShoppingBag, Users,
};

type Feature = { icon: string; title: string; desc: string };
type FlowStep = { icon: string; title: string; desc: string };
type Step = { title: string; desc: string };
type HeroImage = { path: string; url: string; bytes: number } | null;
type StatItem = { value: string; label: string };
type LandingContent = {
  nav: { features: string; how: string; pricing: string; signIn: string; cta: string };
  hero: {
    badge: string; titleStart: string; titleHighlight: string; subtitle: string;
    ctaPrimary: string; ctaSecondary: string; badges: string[];
    bannerImage?: HeroImage;
  };
  stats?: { title?: string; items: StatItem[] };
  about?: { badge: string; title: string; body: string; points: string[]; flow?: FlowStep[] };
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
  about: {
    badge: "আমরা কীভাবে কাজ করি",
    title: "রিসেলার থেকে প্রফিট উইথড্র — পুরো জার্নি",
    body:
      "আপনি শুধু সেল করবেন, বাকি সব আমরা। অর্ডার জেনারেট করা থেকে প্রফিট উইথড্র পর্যন্ত প্রতিটি ধাপ পরিষ্কার ও ট্র্যাকেবল।",
    points: [],
    flow: [
      { icon: "ClipboardList", title: "অর্ডার জেনারেট", desc: "রিসেলার নিজের স্টোর থেকে কাস্টমারের অর্ডার প্যানেলে তোলে।" },
      { icon: "Send", title: "অ্যাডমিনে পাঠানো", desc: "কনফার্ম অর্ডার এক ক্লিকে অ্যাডমিনের কাছে ফরওয়ার্ড হয়।" },
      { icon: "PackageCheck", title: "প্যাকিং ও কুরিয়ার", desc: "অ্যাডমিন প্রোডাক্ট প্যাক করে কুরিয়ারে বুক ও ডেলিভারি ফলোআপ করে।" },
      { icon: "PiggyBank", title: "প্রফিট জমা", desc: "ডেলিভারি সফল হলে প্রফিট রিসেলার প্যানেলে অটো যোগ হয়।" },
      { icon: "BanknoteArrowDown", title: "উইথড্র", desc: "bKash/Nagad/ব্যাংকে উইথড্র রিকোয়েস্ট — পেমেন্ট হিস্ট্রি সহ।" },
    ],
  },
  features: {
    title: "যেসব সুবিধা পাবেন",
    subtitle: "প্রোডাক্ট থেকে পেমেন্ট — সবকিছু এক প্যানেলে",
    items: [
      { icon: "Boxes", title: "হাজারো প্রোডাক্ট, এক ক্লিকে লিস্ট", desc: "ভেরিফাইড ক্যাটালগ, HD ছবি, SEO কন্টেন্ট — স্টক কিনতে হবে না।" },
      { icon: "Wallet", title: "নিজের প্রফিট নিজে ঠিক করুন", desc: "কস্ট দেখেই মার্জিন বসান, পুরো প্রফিট আপনার।" },
      { icon: "Truck", title: "কুরিয়ার বুকিং আমরা করি", desc: "Steadfast, Pathao, CarryBee — প্যাকেজিং থেকে ট্র্যাকিং পর্যন্ত।" },
      { icon: "Globe", title: "নিজের ব্র্যান্ডেড স্টোর", desc: "কাস্টম ডোমেইন, লোগো, কালার, থিম — কাস্টমার শুধু আপনাকে দেখবে।" },
      { icon: "Wallet", title: "পেমেন্ট সবচেয়ে সহজ", desc: "bKash, Nagad, Rocket, SSLCommerz, EPS — COD + অনলাইন।" },
      { icon: "Megaphone", title: "Ads ট্র্যাকিং অটো", desc: "Facebook Pixel/CAPI + TikTok Events API — কোন অ্যাডে কত সেল।" },
      { icon: "BarChart3", title: "লাইভ প্রফিট রিপোর্ট", desc: "সেল, রেভিনিউ, ডিউ, রিটার্ন — সব রিয়েল-টাইমে।" },
      { icon: "ShieldCheck", title: "ডেটা সম্পূর্ণ প্রাইভেট", desc: "প্রতিটি রিসেলারের অর্ডার ও কাস্টমার ডেটা আলাদা।" },
      { icon: "Sparkles", title: "টিম ও কমিশন সিস্টেম", desc: "স্টাফ পারমিশন, লিডার রিসেলার — ইনকাম বাড়ান।" },
    ],
  },
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

function Brand({ siteName, logoUrl, size = "md" }: { siteName: string; logoUrl: string | null; size?: "md" | "sm" }) {
  const h = size === "md" ? "h-11 sm:h-13" : "h-9";
  if (logoUrl) return <img src={logoUrl} alt={siteName} className={`${h} max-w-40 shrink-0 object-contain`} />;
  return (
    <span className={`grid ${size === "md" ? "h-11 w-11" : "h-9 w-9"} shrink-0 place-items-center rounded-xl bg-[image:var(--gradient-brand)] text-lg font-black text-primary-foreground`}>
      {siteName.charAt(0).toUpperCase()}
    </span>
  );
}

function Landing({ c, siteName, logoUrl }: { c: LandingContent; siteName: string; logoUrl: string | null }) {
  const fetchStats = useServerFn(getPublicStats);
  const [stats, setStats] = useState<any>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    fetchStats().then(setStats);
  }, [fetchStats]);

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copied to clipboard");
  };

  const banner = c.hero.bannerImage?.url;

  const statIcons = [Boxes, Layers, ShoppingBag, Users];
  const customStats = c.stats?.items?.filter((s) => s.value?.trim() || s.label?.trim()) ?? [];
  const autoStats: StatItem[] = stats
    ? [
        { value: `${stats.totalProducts}+`, label: "প্রোডাক্ট" },
        { value: `${stats.totalCategories}+`, label: "ক্যাটেগরি" },
        { value: `${stats.totalSales}+`, label: "টোটাল সেল" },
        { value: "24/7", label: "সাপোর্ট" },
      ]
    : [];
  const statItems = customStats.length ? customStats : autoStats;

  const navLinks = [
    { href: "#about", label: "আমাদের সম্পর্কে" },
    { href: "#features", label: c.nav.features },
    { href: "#how", label: c.nav.how },
    { href: "#pricing", label: c.nav.pricing },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* ── Nav ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:h-18 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center" aria-label={siteName}>
            <Brand siteName={siteName} logoUrl={logoUrl} />
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground lg:flex">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="transition-colors hover:text-primary">{l.label}</a>
            ))}
            <Link to="/catalog" search={{}} className="font-semibold text-primary hover:opacity-80">Catalog</Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link to="/login" className="hidden rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-primary/50 hover:text-primary sm:inline-flex">
              {c.nav.signIn}
            </Link>
            <Link to="/login" search={{ mode: "signup" }} className="btn-brand inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold">
              {c.nav.cta} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-label="Menu"
              className="grid h-10 w-10 place-items-center rounded-lg border border-border lg:hidden"
            >
              {menu ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>

        {menu && (
          <nav className="border-t border-border/60 bg-background px-4 py-3 text-sm lg:hidden">
            {[...navLinks].map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenu(false)}
                className="block rounded-lg px-3 py-2.5 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
            <Link to="/catalog" search={{}} onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2.5 font-bold text-primary hover:bg-primary/10">
              Master Catalog
            </Link>
            <Link to="/login" onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2.5 font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              {c.nav.signIn}
            </Link>
          </nav>
        )}
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[image:var(--gradient-hero)]" />
        <div className="pointer-events-none absolute -top-40 -left-32 -z-10 h-96 w-96 rounded-full bg-primary/25 blur-3xl animate-blob-drift" />
        <div className="pointer-events-none absolute -bottom-40 -right-24 -z-10 h-96 w-96 rounded-full bg-accent/25 blur-3xl animate-blob-drift-slow" />

        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-14 sm:px-6 sm:pt-20 sm:pb-20 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-[11px] font-semibold text-primary sm:text-xs animate-fade-in-up animation-delay-100">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{c.hero.badge}</span>
            </div>

            <h1 className="mt-5 text-balance text-[30px] font-black leading-[1.22] tracking-tight sm:text-5xl sm:leading-[1.12] lg:text-[56px] animate-fade-in-up animation-delay-200">
              {c.hero.titleStart}{" "}
              <span className="bg-[image:var(--gradient-brand)] bg-clip-text text-transparent">{c.hero.titleHighlight}</span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-base lg:mx-0 lg:text-lg animate-fade-in-up animation-delay-300">
              {c.hero.subtitle}
            </p>

            <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start animate-fade-in-up animation-delay-400">
              <Link
                to="/login"
                search={{ mode: "signup" }}
                className="btn-brand inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold transition-transform hover:-translate-y-0.5 sm:text-base"
              >
                {c.hero.ctaPrimary} <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#about"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-7 py-3.5 text-sm font-bold transition hover:border-primary/50 hover:text-primary sm:text-base"
              >
                {c.hero.ctaSecondary}
              </a>
            </div>

            {c.hero.badges.length > 0 && (
              <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold sm:text-xs lg:justify-start animate-fade-in-up animation-delay-500">
                {c.hero.badges.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5">
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> {b}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="relative animate-scale-in-slow animation-delay-300">
            <div className="surface-card overflow-hidden p-2 shadow-[var(--shadow-elegant)] animate-float">
              {banner ? (
                <img src={banner} alt={siteName} className="aspect-[4/3] w-full rounded-xl object-cover" />
              ) : (
                <div className="grid aspect-[4/3] w-full place-items-center rounded-xl bg-[image:var(--gradient-brand)] text-primary-foreground">
                  <Boxes className="h-16 w-16 opacity-80" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats band ──────────────────────────────────── */}
      {statItems.length > 0 && (
        <section className="border-y border-border/60 bg-card">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4 md:py-12">
            {statItems.slice(0, 4).map((s, i) => {
              const Icon = statIcons[i] ?? Sparkles;
              return (
                <div key={i} className="text-center">
                  <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="text-2xl font-black sm:text-3xl">{s.value}</div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">{s.label}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── How we work (flow) ──────────────────────────── */}
      {((c.about?.flow?.length ?? 0) > 0 || c.about?.title || c.about?.body) && (
        <section id="about" className="relative overflow-hidden py-14 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-brand)] opacity-[0.06]" />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              {c.about?.badge && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  <Sparkles className="h-3 w-3" /> {c.about.badge}
                </span>
              )}
              {c.about?.title && (
                <h2 className="mt-3 text-xl font-extrabold leading-snug sm:text-3xl">{c.about.title}</h2>
              )}
              {c.about?.body && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.about.body}</p>
              )}
            </div>

            <ol className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3">
              <span className="pointer-events-none absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent lg:block" />
              {(c.about?.flow ?? []).map((f, i) => {
                const Icon = ICON_MAP[f.icon] ?? Sparkles;
                return (
                  <li key={i} className="surface-card group relative flex flex-col items-center p-5 text-center transition-transform hover:-translate-y-1">
                    <span className="absolute right-3 top-3 text-[11px] font-black text-muted-foreground/40">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[image:var(--gradient-brand)] text-primary-foreground shadow-md">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-3 text-sm font-bold leading-tight">{f.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                    {i < (c.about?.flow?.length ?? 0) - 1 && (
                      <ArrowRight className="absolute -right-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-primary/50 lg:block" />
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-[image:var(--gradient-brand)] px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md">
                {c.hero.ctaPrimary} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/catalog" search={{}} className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-bold hover:bg-muted">
                Master Catalog দেখুন
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Categories ──────────────────────────────────── */}
      {stats?.categories?.length > 0 && (
        <section className="border-y border-border/60 bg-muted/30 py-10 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
              {stats.categories.map((cat: any) => (
                <Link
                  key={cat.id}
                  to="/catalog"
                  search={{ category: cat.slug }}
                  className="group relative block aspect-square overflow-hidden rounded-2xl border border-border/60 bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)]"
                >
                  {cat.image_url ? (
                    <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-primary/5 text-2xl font-black text-primary">{cat.name.charAt(0)}</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/85 to-transparent p-3 pt-8">
                    <span className="block truncate text-xs font-bold text-background">{cat.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Featured products ───────────────────────────── */}
      {stats?.products?.length > 0 && (
        <section className="py-10 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {stats.products.map((p: any) => (
                <div key={p.id} className="group surface-card surface-card-hover flex flex-col overflow-hidden">
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {p.main_image ? (
                      <img src={p.main_image} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">No image</div>
                    )}
                    <div className="absolute right-2 top-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => copy(p.name)}
                        className="rounded-lg border border-border bg-card/95 p-1.5 shadow-sm backdrop-blur hover:text-primary"
                        title="Copy Title"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {p.main_image && (
                        <a
                          href={p.main_image}
                          download
                          className="rounded-lg border border-border bg-card/95 p-1.5 shadow-sm backdrop-blur hover:text-primary"
                          title="Download Image"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <Link to="/catalog/$slug" params={{ slug: p.slug }} className="line-clamp-2 text-sm font-bold leading-tight hover:text-primary">
                      {p.name}
                    </Link>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Resell For</span>
                        <span className="text-base font-black text-primary">{bdt(p.price)}</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your Profit</span>
                        <span className="block text-sm font-bold text-success">+{bdt(p.price - p.base_price)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Features ────────────────────────────────────── */}
      <section id="features" className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.features.items.map((f, i) => {
              const Icon = ICON_MAP[f.icon] ?? Sparkles;
              return (
                <div key={i} className="surface-card surface-card-hover group relative overflow-hidden p-5">
                  <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/20 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
                  <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-[image:var(--gradient-brand)] text-primary-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="relative mt-3 text-sm font-bold leading-tight">{f.title}</h3>
                  <p className="relative mt-1.5 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────── */}
      <section id="how" className="relative overflow-hidden border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="relative grid gap-6 md:grid-cols-3">
            {c.how.steps.map((s, i) => (
              <div key={i} className="surface-card surface-card-hover relative p-6 pt-8">
                <div className="absolute -top-5 left-6 grid h-11 w-11 place-items-center rounded-xl bg-[image:var(--gradient-brand)] text-base font-black text-primary-foreground ring-4 ring-background">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="text-base font-bold sm:text-lg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────── */}
      <section id="pricing" className="px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[image:var(--gradient-brand)] px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-primary-foreground/10 blur-3xl" />
          <div className="relative flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              search={{ mode: "signup" }}
              className="inline-flex items-center gap-2 rounded-xl bg-background px-7 py-3.5 text-sm font-bold text-foreground transition-transform hover:-translate-y-0.5 sm:text-base"
            >
              {c.cta.button} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/catalog"
              search={{}}
              className="inline-flex items-center gap-2 rounded-xl border border-primary-foreground/30 px-7 py-3.5 text-sm font-bold text-primary-foreground hover:bg-primary-foreground/10 sm:text-base"
            >
              <Layers className="h-4 w-4" /> Catalog
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-border/60 bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Brand siteName={siteName} logoUrl={logoUrl} size="sm" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">{c.footer.tagline}</p>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">প্ল্যাটফর্ম</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a href="#about" className="text-muted-foreground hover:text-primary">আমাদের সম্পর্কে</a></li>
              <li><a href="#features" className="text-muted-foreground hover:text-primary">{c.nav.features}</a></li>
              <li><a href="#how" className="text-muted-foreground hover:text-primary">{c.nav.how}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">অ্যাকাউন্ট</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/login" search={{ mode: "signup" }} className="text-muted-foreground hover:text-primary">{c.nav.cta}</Link></li>
              <li><Link to="/login" className="text-muted-foreground hover:text-primary">{c.nav.signIn}</Link></li>
              <li><Link to="/catalog" search={{}} className="text-muted-foreground hover:text-primary">Master Catalog</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60 px-4 py-5 text-center text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} {siteName}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
