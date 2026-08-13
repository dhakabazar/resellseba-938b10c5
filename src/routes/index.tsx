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
  ShoppingBag,
  Layers,
  Users,
  ClipboardList,
  Send,
  PackageCheck,
  Coins,
  BanknoteArrowDown,
  type LucideIcon,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { CountUp } from "@/components/count-up";
import { PublicHeader, Brand } from "@/components/public-header";

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
  ClipboardList, Send, PackageCheck, Coins, BanknoteArrowDown, ShoppingBag, Users,
};

type Feature = { icon: string; title: string; desc: string };
type FlowStep = { icon: string; title: string; desc: string };
type Step = { title: string; desc: string };
type FaqItem = { q: string; a: string };
type HeroImage = { path: string; url: string; bytes: number } | null;
type StatItem = { value: string; label: string };
type LandingContent = {
  nav: { features: string; how: string; categories?: string; signIn: string; cta: string; faq?: string };
  hero: {
    badge: string; titleStart: string; titleHighlight: string; subtitle: string;
    ctaPrimary: string; ctaSecondary: string; badges: string[];
    bannerImage?: HeroImage;
  };
  stats?: { title?: string; items: StatItem[] };
  about?: { badge: string; title: string; body: string; points: string[]; flow?: FlowStep[] };
  features: { title: string; subtitle: string; items: Feature[] };
  how: { title: string; subtitle: string; steps: Step[] };
  faq?: { title: string; subtitle: string; items: FaqItem[] };
  cta: { badge: string; title: string; subtitle: string; button: string };
  footer: { tagline: string };
};


const FALLBACK: LandingContent = {
  nav: { features: "ফিচার", how: "কীভাবে কাজ করে", categories: "ক্যাটাগরি", faq: "FAQ", signIn: "সাইন ইন", cta: "শুরু করুন" },
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
    badge: "",
    title: "",
    body:
      "আপনি শুধু সেল করবেন, বাকি সব আমরা। অর্ডার জেনারেট করা থেকে প্রফিট উইথড্র পর্যন্ত প্রতিটি ধাপ পরিষ্কার ও ট্র্যাকেবল।",
    points: [],
    flow: [
      { icon: "ClipboardList", title: "অর্ডার জেনারেট", desc: "রিসেলার নিজের স্টোর থেকে কাস্টমারের অর্ডার প্যানেলে তোলে।" },
      { icon: "Send", title: "অ্যাডমিনে পাঠানো", desc: "কনফার্ম অর্ডার এক ক্লিকে অ্যাডমিনের কাছে ফরওয়ার্ড হয়।" },
      { icon: "PackageCheck", title: "প্যাকিং ও কুরিয়ার", desc: "অ্যাডমিন প্রোডাক্ট প্যাক করে কুরিয়ারে বুক ও ডেলিভারি ফলোআপ করে।" },
      { icon: "Coins", title: "প্রফিট জমা", desc: "ডেলিভারি সফল হলে প্রফিট রিসেলার প্যানেলে অটো যোগ হয়।" },
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
  faq: {
    title: "সাধারণ প্রশ্ন",
    subtitle: "রিসেলারদের মনে আসা কিছু প্রশ্ন ও উত্তর",
    items: [
      { q: "কীভাবে রিসেলার হতে পারব?", a: "সাইনআপ করে স্টোর সেটআপ করুন, প্রোডাক্ট লিস্ট করুন, আর কাস্টমারের অর্ডার প্যানেলে নিন। অ্যাডমিন অ্যাপ্রুভের পর সম্পূর্ণ অ্যাক্সেস পাবেন।" },
      { q: "কত টাকা দিয়ে শুরু করতে হয়?", a: "কোনো সেটআপ ফি বা মাসিক ফি নেই। প্রোডাক্ট কিনে স্টক রাখতে হয় না — অর্ডার পেলে অ্যাডমিন প্যাকিং ও ডেলিভারি করে।" },
      { q: "প্রোডাক্টের দাম কে ঠিক করে?", a: "অ্যাডমিন বেস কস্ট ও ডেলিভারি চার্জ দিয়ে দেয়। রিসেলার সেই কস্টের উপর নিজের মার্জিন/প্রফিট বসিয়ে বিক্রয় মূল্য ঠিক করেন।" },
      { q: "ডেলিভারি ও কুরিয়ার কে করবে?", a: "Steadfast, Pathao, CarryBee — যেকোনো সক্রিয় কুরিয়ারে অ্যাডমিন বুকিং করে। আপনাকে শুধু ট্র্যাকিং আইডি কাস্টমারকে শেয়ার করতে হবে।" },
      { q: "প্রফিট কীভাবে পাব?", a: "প্রতিটি ডেলিভারি সম্পন্ন অর্ডার থেকে আপনার প্যানেলে প্রফিট জমা হবে। উইথড্র রিকোয়েস্ট দিলে bKash/Nagad/ব্যাংকে পেমেন্ট করা হয়।" },
      { q: "কাস্টমার কি আমার স্টোরের বাইরে কিছু দেখতে পাবে?", a: "না। কাস্টমার শুধু আপনার ব্র্যান্ডেড স্টোর, আপনার লিস্টিং ও আপনার দেওয়া তথ্যই দেখবে। অ্যাডমিন বা প্ল্যাটফর্মের কোনো তথ্য লিক হয় না।" },
      { q: "কাস্টম ডোমেইন কীভাবে সেট করব?", a: "নিজের ডোমেইন কিনে Cloudflare nameserver আমাদের দেওয়া টার্গেটে পয়েন্ট করুন। রিসেলার সেটিংসে ডোমেইন যোগ করে ভেরিফাই করুন — আমরা HTTPS সার্টিফিকেট স্বয়ংক্রিয় করে দেই।" },
      { q: "রিটার্ন/রিফান্ড কীভাবে হয়?", a: "কাস্টমার রিফান্ড চাইলে রিসেলার অর্ডার প্যানেলে রিকোয়েস্ট তোলেন। অ্যাডমিন কুরিয়ার থেকে প্রোডাক্ট রিসিভ করে যাচাই করার পর রিফান্ড/রিপ্লেসমেন্ট প্রসেস হয়।" },
      { q: "কাস্টমার সাপোর্ট কে দেবে?", a: "রিসেলার নিজেই কাস্টমারের যোগাযোগ ও সাপোর্ট দেন। অ্যাডমিন শুধু প্যাকিং, কুরিয়ার বুকিং ও ডেলিভারি স্ট্যাটাস হ্যান্ডল করে।" },
      { q: "মোবাইল অ্যাপ আছে কি?", a: "এখনো পুরো মোবাইল অ্যাপ নেই, তবে স্টোর এবং প্যানেল পুরোপুরি মোবাইল-রেস্পন্সিভ — ফোন থেকেই অর্ডার, ট্র্যাকিং ও প্রফিট দেখা যায়।" },
    ],
  },
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
  const fetchStats = useServerFn(getPublicStats);
  const [stats, setStats] = useState<any>(null);
  

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


  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* ── Nav ─────────────────────────────────────────── */}
      <PublicHeader siteName={siteName} logoUrl={logoUrl} content={c} />

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
                className="btn-brand btn-live inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold sm:text-base"
              >
                {c.hero.ctaPrimary} <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#about"
                className="btn-live inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-7 py-3.5 text-sm font-bold transition hover:border-primary/50 hover:text-primary sm:text-base"
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
            {/* soft ambient glow behind the banner so any image blends in */}
            <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-[image:var(--gradient-brand)] opacity-20 blur-2xl" />
            <div className="animate-float relative overflow-hidden rounded-2xl shadow-[var(--shadow-elegant)]">
              {banner ? (
                <>
                  <img src={banner} alt={siteName} className="aspect-[4/3] w-full object-cover" />
                  {/* gentle vignette + tint keeps bright, dark or busy images looking consistent */}
                  <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background/35 via-transparent to-background/10" />
                </>
              ) : (
                <div className="grid aspect-[4/3] w-full place-items-center bg-[image:var(--gradient-brand)] text-primary-foreground">
                  <Boxes className="h-16 w-16 opacity-80" />
                </div>
              )}
              {/* hairline inner ring instead of a hard border */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-foreground/10" />
            </div>
          </div>

        </div>
      </section>

      {/* ── Stats band ──────────────────────────────────── */}
      {statItems.length > 0 && (
        <section className="border-y border-border/60 bg-card">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 sm:px-6 md:grid-cols-4 md:py-12">
            {statItems.slice(0, 4).map((s, i) => {
              const Icon = statIcons[i] ?? Sparkles;
              return (
                <div key={i} className="flex flex-col items-center text-center">
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground sm:text-sm">{s.label}</span>
                  </div>
                  <div className="mt-2 text-2xl font-black sm:text-3xl">
                    <CountUp value={s.value ?? ""} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}


      {/* ── Features ────────────────────────────────────── */}
      <section id="features" className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            {c.features.title && <h2 className="text-xl font-extrabold sm:text-3xl">{c.features.title}</h2>}
            {c.features.subtitle && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.features.subtitle}</p>}
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.features.items.map((f, i) => {
              const Icon = ICON_MAP[f.icon] ?? Sparkles;
              return (
                <div key={i} className="surface-card surface-card-hover group relative flex flex-col overflow-hidden p-4">
                  <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/20 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
                  <div className="relative flex items-start gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[image:var(--gradient-brand)] text-primary-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <h3 className="flex-1 pt-0.5 text-[13px] font-bold leading-tight">{f.title}</h3>
                  </div>
                  <p className="relative mt-2 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How we work (flow) ──────────────────────────── */}
      {((c.about?.flow?.length ?? 0) > 0 || c.about?.title || c.about?.body) && (
        <section id="about" className="relative overflow-hidden py-14 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-brand)] opacity-[0.06]" />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              {c.about?.title && (
                <h2 className="mt-3 text-xl font-extrabold leading-snug sm:text-3xl">{c.about.title}</h2>
              )}
              {c.about?.body && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.about.body}</p>
              )}
            </div>

            <div className="relative mt-10 sm:mt-14">
              {/* Desktop connecting line */}
              <div className="pointer-events-none absolute top-10 left-0 right-0 hidden h-1 rounded-full flow-line lg:block" />

              {/* Mobile connecting line — runs through the centre of the icon bubbles */}
              <div className="pointer-events-none absolute top-5 bottom-5 left-5 hidden w-1 rounded-full flow-line-vertical lg:hidden" />

              <ol className="relative flex flex-col gap-6 lg:flex-row lg:justify-between lg:gap-4">
                {(c.about?.flow ?? []).map((f, i) => {
                  const Icon = ICON_MAP[f.icon] ?? Sparkles;
                  const stepLabel = ["০১", "০২", "০৩", "০৪", "০৫"][i] ?? String(i + 1).padStart(2, "0");
                  const iconClass = [
                    "flow-icon-1",
                    "flow-icon-2",
                    "flow-icon-3",
                    "flow-icon-4",
                    "flow-icon-5",
                  ][i] ?? "flow-icon-1";

                  return (
                    <li
                      key={i}
                      className="group relative z-10 flex w-full items-start gap-3 lg:w-[18%] lg:max-w-[240px] lg:flex-col lg:items-center lg:gap-0"
                      style={{ animationDelay: `${(i + 1) * 100}ms` }}
                    >
                      {/* Icon bubble — smaller on mobile, stacked above on desktop */}
                      <div
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl shadow-lg shadow-primary/10 transition-transform duration-300 group-hover:scale-105 lg:h-20 lg:w-20 lg:group-hover:-translate-y-2 ${iconClass}`}
                      >
                        <Icon className="h-5 w-5 lg:h-9 lg:w-9" />
                      </div>

                      {/* Card — side-by-side with icon on mobile, below icon on desktop */}
                      <div className="flow-card flex-1 px-4 py-4 text-left transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-elegant lg:mt-6 lg:w-full lg:px-5 lg:py-5 lg:text-center">
                        <span className={`mb-1 block text-[11px] font-bold uppercase tracking-wider`} style={{ color: `var(--flow-step-${i + 1})` }}>
                          ধাপ {stepLabel}
                        </span>
                        <h3 className="text-sm font-bold leading-tight sm:text-[15px]">{f.title}</h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <Link to="/login" search={{ mode: "signup" }} className="btn-brand btn-live inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold">
                {c.hero.ctaPrimary} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/catalog" search={{}} className="btn-live inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-bold hover:bg-muted">
                Master Catalog দেখুন
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── How it works ────────────────────────────────── */}
      <section id="how" className="relative overflow-hidden border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-2xl text-center">
            {c.how.title && <h2 className="text-xl font-extrabold sm:text-3xl">{c.how.title}</h2>}
            {c.how.subtitle && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.how.subtitle}</p>}
          </div>
          <div className="relative mt-10 grid gap-6 md:grid-cols-3">
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

      {/* ── Categories ──────────────────────────────────── */}
      {stats?.categories?.length > 0 && (
        <section id="categories" className="border-y border-border/60 bg-muted/30 py-10 sm:py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-xl font-extrabold sm:text-3xl">ক্যাটাগরি</h2>
              <p className="mt-2 text-sm text-muted-foreground">আপনার নিশ অনুযায়ী ক্যাটাগরি বেছে নিয়ে প্রোডাক্ট লিস্ট করুন</p>
            </div>
            <div className="mt-8 grid grid-cols-5 gap-2 sm:grid-cols-6 sm:gap-3 md:grid-cols-8 lg:grid-cols-10">
              {stats.categories.map((cat: any) => (
                <Link
                  key={cat.id}
                  to="/catalog"
                  search={{ category: cat.slug }}
                  className="group flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card p-2 text-center transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)]"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-primary/5">
                    {cat.image_url ? (
                      <img
                        src={cat.image_url}
                        alt={cat.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-lg font-black text-primary">
                        {cat.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <span className="line-clamp-2 min-w-0 text-[11px] font-bold leading-tight group-hover:text-primary sm:text-xs">
                    {cat.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}



      {/* ── FAQ ─────────────────────────────────────────── */}
      {c.faq && c.faq.items.length > 0 && (
        <section id="faq" className="border-t border-border/60 bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="mx-auto max-w-2xl text-center">
              {c.faq.title && <h2 className="text-xl font-extrabold sm:text-3xl">{c.faq.title}</h2>}
              {c.faq.subtitle && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.faq.subtitle}</p>}
            </div>
            <div className="mt-8">
              <Accordion type="single" collapsible className="w-full">
                {c.faq.items.map((item, i) => (
                  <AccordionItem key={i} value={`item-${i}`}>
                    <AccordionTrigger className="text-sm font-semibold sm:text-base">
                      <span className="flex items-center gap-2 text-left">
                        <HelpCircle className="h-4 w-4 shrink-0 text-primary" />
                        {item.q}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ─────────────────────────────────────────── */}
      <section id="pricing" className="px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[image:var(--gradient-brand)] px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-primary-foreground/10 blur-3xl" />
          <div className="relative mx-auto max-w-2xl">
            {c.cta.title && <h2 className="text-2xl font-extrabold text-primary-foreground sm:text-3xl">{c.cta.title}</h2>}
            {c.cta.subtitle && <p className="mt-3 text-sm leading-relaxed text-primary-foreground/85">{c.cta.subtitle}</p>}
          </div>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              search={{ mode: "signup" }}
              className="btn-live inline-flex items-center gap-2 rounded-xl bg-background px-7 py-3.5 text-sm font-bold text-foreground sm:text-base"
            >
              {c.cta.button} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/catalog"
              search={{}}
              className="btn-live inline-flex items-center gap-2 rounded-xl border border-primary-foreground/30 px-7 py-3.5 text-sm font-bold text-primary-foreground hover:bg-primary-foreground/10 sm:text-base"
            >
              <Layers className="h-4 w-4" /> প্রোডাক্টস
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
              <li><a href="#about" className="text-muted-foreground hover:text-primary">কীভাবে কাজ করি</a></li>
              <li><a href="#features" className="text-muted-foreground hover:text-primary">{c.nav.features}</a></li>
              <li><a href="#how" className="text-muted-foreground hover:text-primary">{c.nav.how}</a></li>
              <li><a href="#faq" className="text-muted-foreground hover:text-primary">{c.nav.faq || "FAQ"}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">অ্যাকাউন্ট</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/login" search={{ mode: "signup" }} className="text-muted-foreground hover:text-primary">{c.nav.cta}</Link></li>
              <li><Link to="/login" className="text-muted-foreground hover:text-primary">{c.nav.signIn}</Link></li>
              <li><Link to="/catalog" search={{}} className="text-muted-foreground hover:text-primary">প্রোডাক্টস</Link></li>
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
