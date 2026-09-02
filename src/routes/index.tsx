import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getLpBootstrap, type LpBootstrap } from "@/lib/bootstrap";
import { bdt } from "@/lib/finance-report";
import {
  ArrowRight,
  Boxes,
  Sparkles,
  Check,
  ShoppingBag,
  Layers,
  Users,
  HelpCircle,
  Quote,
  Star,
  Play,
  Phone,
  Mail,
  MessageCircle,
  Headset,
  MapPin,

} from "lucide-react";
import { APP_ICONS } from "@/lib/icons";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { CountUp } from "@/components/count-up";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { youtubeEmbed, youtubeThumb } from "@/lib/tutorials";
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

const ICON_MAP = APP_ICONS;

type Feature = { icon: string; title: string; desc: string };
type FlowStep = { icon: string; title: string; desc: string };
type Step = { title: string; desc: string };
type FaqItem = { q: string; a: string };
type Story = {
  name: string;
  role?: string;
  location?: string;
  quote: string;
  metric?: string;
  metricLabel?: string;
  rating?: number;
  avatar?: HeroImage;
};
type HeroImage = { path: string; url: string; bytes: number } | null;
type ContactPerson = {
  name: string;
  role?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  photo?: HeroImage;
};
type StatItem = { value: string; label: string };

type LandingContent = {
  nav: { features: string; how: string; categories?: string; signIn: string; cta: string; faq?: string; stories?: string };
  hero: {
    badge: string; titleStart: string; titleHighlight: string; subtitle: string;
    ctaPrimary: string; ctaSecondary: string; badges: string[];
    bannerImage?: HeroImage;
    videoUrl?: string;
    videoTitle?: string;
  };
  stats?: { title?: string; items: StatItem[] };
  about?: { badge: string; title: string; body: string; points: string[]; flow?: FlowStep[] };
  features: { title: string; subtitle: string; items: Feature[] };
  how: { title: string; subtitle: string; steps: Step[] };
  faq?: { title: string; subtitle: string; items: FaqItem[] };
  stories?: { title?: string; subtitle?: string; items: Story[] };
  contacts?: { badge?: string; title?: string; subtitle?: string; items: ContactPerson[] };
  cta: { badge: string; title: string; subtitle: string; button: string };

  footer: { tagline: string; address?: string; phone?: string; email?: string };
};


const FALLBACK: LandingContent = {
  nav: { features: "ফিচার", how: "কীভাবে কাজ করে", categories: "ক্যাটাগরি", stories: "সাকসেস স্টোরি", faq: "FAQ", signIn: "সাইন ইন", cta: "শুরু করুন" },
  hero: {
    badge: "বাংলাদেশের রিসেলার প্ল্যাটফর্ম",
    titleStart: "নিজের অনলাইন স্টোর চালু করুন",
    titleHighlight: "জিরো ইনভেস্টমেন্টে",
    subtitle: "মাস্টার ক্যাটালগ থেকে প্রোডাক্ট নিয়ে লিস্ট করুন।",
    ctaPrimary: "সাইনআপ করুন",
    ctaSecondary: "অ্যাডমিন সাইন ইন",
    badges: ["সেটআপ ফি নেই"],
    bannerImage: null,
    videoUrl: "",
    videoTitle: "দেখুন কিভাবে রেজিস্ট্রেশন করবেন",
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
  stories: {
    title: "রিসেলারদের সাকসেস স্টোরি",
    subtitle: "যারা জিরো ইনভেস্টমেন্টে শুরু করে আজ নিজের ব্র্যান্ড দাঁড় করিয়েছেন",
    items: [
      {
        name: "সাদিয়া আফরিন",
        role: "স্টুডেন্ট রিসেলার",
        location: "রাজশাহী",
        quote:
          "ক্লাসের ফাঁকে ফেসবুক পেজে প্রোডাক্ট পোস্ট করি, অর্ডার এলে প্যানেলে তুলে দিই। প্যাকিং-কুরিয়ার নিয়ে ভাবতেই হয় না। প্রথম মাসেই টিউশনের চেয়ে বেশি ইনকাম হয়েছে।",
        metric: "৳৩২,০০০",
        metricLabel: "মাসিক প্রফিট",
        rating: 5,
      },
      {
        name: "রাকিব হাসান",
        role: "ফেসবুক পেজ অ্যাডমিন",
        location: "চট্টগ্রাম",
        quote:
          "আগে স্টক কিনে টাকা আটকে রাখতাম। এখন লিস্টিং থেকেই সেল হয়, প্রফিট রিপোর্ট রিয়েল-টাইমে দেখি। কাস্টম ডোমেইনে নিজের ব্র্যান্ডেড স্টোর — কাস্টমার আমাকেই চেনে।",
        metric: "১,২০০+",
        metricLabel: "ডেলিভারড অর্ডার",
        rating: 5,
      },
      {
        name: "নুসরাত জাহান",
        role: "হোম-বেইজড সেলার",
        location: "ঢাকা",
        quote:
          "বাচ্চা সামলে ঘরে বসেই স্টোর চালাই। কুরিয়ার ট্র্যাকিং আর প্রফিট উইথড্র একদম ঝামেলাহীন — bKash-এ টাকা চলে আসে।",
        metric: "৳৪৫,০০০",
        metricLabel: "সেরা মাসের সেল",
        rating: 5,
      },
      {
        name: "তানভীর আলম",
        role: "ফুলটাইম রিসেলার",
        location: "সিলেট",
        quote:
          "দিনে ২০-৩০টা অর্ডার হ্যান্ডল করি একজনেই। বাল্ক কুরিয়ার বুকিং আর থার্মাল লেবেল সিস্টেম সময় বাঁচিয়ে দিয়েছে।",
        metric: "৯৭%",
        metricLabel: "ডেলিভারি সাকসেস",
        rating: 5,
      },
    ],
  },
  contacts: { badge: "", title: "", subtitle: "", items: [] },
  cta: { badge: "", title: "শুরু করুন", subtitle: "", button: "সাইনআপ" },

  footer: { tagline: "বাংলাদেশের সেরা রিসেলার প্ল্যাটফর্ম", address: "", phone: "", email: "" },
};

type LandingStats = LpBootstrap["stats"] & {
  categories: LpBootstrap["categories"];
  products: LpBootstrap["products"];
};

function RootResolver() {
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);
  const [content, setContent] = useState<LandingContent>(FALLBACK);
  const [siteName, setSiteName] = useState("Reseller");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<LandingStats | null>(null);
  const [contact, setContact] = useState<{ phone: string | null; email: string | null }>({
    phone: null,
    email: null,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const host = typeof window !== "undefined" ? window.location.hostname : "";
      const isPlatformHost =
        !host ||
        host === "localhost" ||
        host.endsWith(".lovable.app") ||
        host.endsWith(".lovableproject.com");

      // ONE call: branding + landing content + stats + categories + products,
      // and (for custom domains) the reseller this hostname belongs to.
      const data = await getLpBootstrap(isPlatformHost ? "" : host);
      if (!alive) return;

      const store = data?.store;
      if (!isPlatformHost && store && store.status === "active") {
        nav({ to: "/s/$code", params: { code: store.code }, replace: true });
        return;
      }

      const s = data?.settings as
        | {
            site_name?: string | null;
            logo_url?: string | null;
            contact_phone?: string | null;
            contact_email?: string | null;
            landing_content?: LandingContent;
          }
        | null
        | undefined;
      if (s) {
        setSiteName(s.site_name ?? "Reseller");
        setLogoUrl(s.logo_url ?? null);
        setContact({ phone: s.contact_phone ?? null, email: s.contact_email ?? null });
        if (s.landing_content) setContent(s.landing_content);
      }
      setStats(
        data
          ? { ...data.stats, categories: data.categories ?? [], products: data.products ?? [] }
          : null,
      );
      setChecking(false);
    })();
    return () => {
      alive = false;
    };
  }, [nav]);

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="h-8 w-8 animate-pulse rounded-full bg-primary/20" />
      </div>
    );
  }

  return (
    <Landing c={content} siteName={siteName} logoUrl={logoUrl} stats={stats} contact={contact} />
  );
}


function Landing({
  c,
  siteName,
  logoUrl,
  stats,
  contact,
}: {
  c: LandingContent;
  siteName: string;
  logoUrl: string | null;
  stats: LandingStats | null;
  contact: { phone: string | null; email: string | null };
}) {


  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copied to clipboard");
  };

  const banner = c.hero.bannerImage?.url;
  const videoUrl = c.hero.videoUrl?.trim() || "";
  const videoEmbed = videoUrl ? youtubeEmbed(videoUrl) : null;
  const poster = banner || (videoUrl ? youtubeThumb(videoUrl) : null);
  const [videoOpen, setVideoOpen] = useState(false);

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
        <div className="pointer-events-none absolute -top-40 -left-32 -z-10 h-96 w-96 rounded-full bg-brand-1/25 blur-3xl animate-blob-drift" />
        <div className="pointer-events-none absolute -bottom-40 -right-24 -z-10 h-96 w-96 rounded-full bg-brand-2/25 blur-3xl animate-blob-drift-slow" />
        <div className="pointer-events-none absolute top-10 right-1/4 -z-10 h-72 w-72 rounded-full bg-brand-3/20 blur-3xl animate-blob-drift-slow" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 -z-10 h-64 w-64 rounded-full bg-brand-4/20 blur-3xl animate-blob-drift" />

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
              <Link
                to="/login"
                className="btn-live inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-7 py-3.5 text-sm font-bold transition hover:border-primary/50 hover:text-primary sm:text-base"
              >
                {c.hero.ctaSecondary}
              </Link>

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
              {poster ? (
                <>
                  <img src={poster} alt={c.hero.videoTitle || siteName} className="aspect-[4/3] w-full object-cover" />
                  {/* gentle vignette + tint keeps bright, dark or busy images looking consistent */}
                  <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background/35 via-transparent to-background/10" />
                </>
              ) : (
                <div className="grid aspect-[4/3] w-full place-items-center bg-[image:var(--gradient-brand)] text-primary-foreground">
                  <Boxes className="h-16 w-16 opacity-80" />
                </div>
              )}

              {/* Video mode: play button in the center + optional title */}
              {videoUrl && (
                <button
                  type="button"
                  onClick={() => setVideoOpen(true)}
                  aria-label={c.hero.videoTitle || "Video play korun"}
                  className="group absolute inset-0 grid place-items-center bg-foreground/25 transition hover:bg-foreground/35"
                >
                  <span className="relative grid h-16 w-16 place-items-center rounded-full bg-background/95 shadow-[var(--shadow-elegant)] transition group-hover:scale-110 sm:h-20 sm:w-20">
                    <span className="absolute inset-0 animate-ping rounded-full bg-background/50" />
                    <Play className="relative ml-0.5 h-7 w-7 fill-primary text-primary sm:h-8 sm:w-8" />
                  </span>
                  {c.hero.videoTitle && (
                    <span className="absolute inset-x-3 bottom-3 rounded-xl bg-background/85 px-3 py-2 text-center text-xs font-bold backdrop-blur-sm sm:text-sm">
                      {c.hero.videoTitle}
                    </span>
                  )}
                </button>
              )}
              {/* hairline inner ring instead of a hard border */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-foreground/10" />
            </div>
          </div>

        </div>

        {/* video popup */}
        <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
          <DialogContent className="max-w-3xl overflow-hidden p-0">
            <DialogHeader className="px-5 pt-5">
              <DialogTitle className="text-base sm:text-lg">
                {c.hero.videoTitle || siteName}
              </DialogTitle>
            </DialogHeader>
            <div className="aspect-video w-full bg-black">
              {videoEmbed ? (
                <iframe
                  src={`${videoEmbed}&autoplay=1`}
                  title={c.hero.videoTitle || siteName}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              ) : videoUrl ? (
                <video src={videoUrl} controls autoPlay playsInline className="h-full w-full" />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
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
      {!!stats?.categories?.length && (
        <section id="categories" className="border-y border-border/60 bg-muted/30 py-10 sm:py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-xl font-extrabold sm:text-3xl">ক্যাটাগরি</h2>
              <p className="mt-2 text-sm text-muted-foreground">আপনার নিশ অনুযায়ী ক্যাটাগরি বেছে নিয়ে প্রোডাক্ট লিস্ট করুন</p>
            </div>
            <div className="mt-8 grid grid-cols-5 gap-2 sm:grid-cols-6 sm:gap-3 md:grid-cols-8 lg:grid-cols-10">
              {(stats?.categories ?? []).map((cat: any) => (
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

      {/* ── Products ────────────────────────────────────── */}
      {stats?.products && stats.products.length > 0 && (
        <section id="products" className="border-y border-border/60 bg-muted/30 py-10 sm:py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-xl font-extrabold sm:text-3xl">ফিচার্ড প্রোডাক্টস</h2>
              <p className="mt-2 text-sm text-muted-foreground">এই মাসের সেরা ও সবচেয়ে বেশি সেল হওয়া প্রোডাক্টস</p>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {stats.products.map((p: any) => (
                <div key={p.id} className="group surface-card surface-card-hover flex flex-col overflow-hidden">
                  <div className="relative aspect-square overflow-hidden bg-primary/5">
                    {p.main_image ? (
                      <img
                        src={p.main_image}
                        alt={p.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-2xl font-black text-primary">
                        {p.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="line-clamp-2 text-sm font-bold leading-tight">{p.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                    <div className="mt-auto pt-3">
                      <span className="text-sm font-black text-primary">{bdt(p.price)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              <Link
                to="/catalog"
                search={{}}
                className="btn-live inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-bold hover:border-primary/50 hover:text-primary"
              >
                <ShoppingBag className="h-4 w-4" /> সব প্রোডাক্টস দেখুন
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Reseller stories ────────────────────────────── */}
      {c.stories && c.stories.items.length > 0 && (
        <section id="stories" className="relative overflow-hidden border-t border-border/60 py-12 sm:py-20">
          <div className="pointer-events-none absolute -top-24 right-0 -z-10 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 -left-20 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                <Quote className="h-3.5 w-3.5" /> সাকসেস স্টোরি
              </span>
              {c.stories.title && (
                <h2 className="mt-3 text-xl font-extrabold sm:text-3xl">{c.stories.title}</h2>
              )}
              {c.stories.subtitle && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.stories.subtitle}</p>
              )}
            </div>

            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {c.stories.items.map((s, i) => (
                <article
                  key={i}
                  className="surface-card surface-card-hover relative flex h-full flex-col gap-4 overflow-hidden p-5"
                >
                  <Quote className="pointer-events-none absolute -right-2 -top-3 h-16 w-16 text-primary/10" />
                  {typeof s.rating === "number" && s.rating > 0 && (
                    <div className="flex gap-0.5">
                      {Array.from({ length: Math.min(5, Math.round(s.rating)) }).map((_, k) => (
                        <Star key={k} className="h-3.5 w-3.5 fill-primary text-primary" />
                      ))}
                    </div>
                  )}
                  <p className="relative text-sm leading-relaxed text-muted-foreground">“{s.quote}”</p>

                  {(s.metric || s.metricLabel) && (
                    <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2">
                      <div className="text-base font-black text-primary">{s.metric}</div>
                      {s.metricLabel && (
                        <div className="text-[11px] font-medium text-muted-foreground">{s.metricLabel}</div>
                      )}
                    </div>
                  )}

                  <div className="mt-auto flex items-center gap-3 border-t border-border/60 pt-4">
                    {s.avatar?.url ? (
                      <img
                        src={s.avatar.url}
                        alt={s.name}
                        loading="lazy"
                        decoding="async"
                        className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-primary/25"
                      />
                    ) : (
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[image:var(--gradient-brand)] text-sm font-black text-primary-foreground">
                        {s.name?.charAt(0) || "R"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{s.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {[s.role, s.location].filter(Boolean).join(" • ")}
                      </div>
                    </div>
                  </div>
                </article>
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

      {/* ── Contact team (last section) ──────────────────── */}
      {(c.contacts?.items?.length ?? 0) > 0 && (
        <section id="contact" className="relative overflow-hidden border-t border-border/60 px-4 py-14 sm:px-6 sm:py-20">
          <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                <Headset className="h-3.5 w-3.5" />
                {c.contacts?.badge || "যোগাযোগ"}
              </span>
              {c.contacts?.title && (
                <h2 className="mt-3 text-xl font-extrabold sm:text-3xl">{c.contacts.title}</h2>
              )}
              {c.contacts?.subtitle && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.contacts.subtitle}</p>
              )}
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {(c.contacts?.items ?? []).map((p, i) => (
                <div
                  key={i}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card p-5 text-center transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[image:var(--gradient-brand)] opacity-10 transition group-hover:opacity-20" />
                  <div className="relative mx-auto">
                    {p.photo?.url ? (
                      <img
                        src={p.photo.url}
                        alt={p.name}
                        loading="lazy"
                        decoding="async"
                        className="h-20 w-20 rounded-full object-cover ring-4 ring-primary/20"
                      />
                    ) : (
                      <div className="grid h-20 w-20 place-items-center rounded-full bg-[image:var(--gradient-brand)] text-2xl font-black text-primary-foreground ring-4 ring-primary/20">
                        {p.name?.charAt(0) || "?"}
                      </div>
                    )}
                  </div>
                  <div className="relative mt-4">
                    <h3 className="text-sm font-bold sm:text-base">{p.name}</h3>
                    {p.role && (
                      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-primary">{p.role}</p>
                    )}
                  </div>

                  <div className="relative mt-4 space-y-2 text-left">
                    {p.phone && (
                      <a
                        href={`tel:${p.phone}`}
                        className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs font-medium hover:border-primary/40 hover:text-primary"
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Phone className="h-3.5 w-3.5" />
                        </span>
                        {p.phone}
                      </a>
                    )}
                    {p.whatsapp && (
                      <a
                        href={`https://wa.me/${p.whatsapp.replace(/[^\d]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs font-medium hover:border-primary/40 hover:text-primary"
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <MessageCircle className="h-3.5 w-3.5" />
                        </span>
                        WhatsApp
                      </a>
                    )}
                    {p.email && (
                      <a
                        href={`mailto:${p.email}`}
                        className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs font-medium hover:border-primary/40 hover:text-primary"
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Mail className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate">{p.email}</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-border/60 bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr]">

          <div>
            <Brand siteName={siteName} logoUrl={logoUrl} size="sm" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">{c.footer.tagline}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {c.footer.address && (
                <li className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="max-w-xs leading-relaxed">{c.footer.address}</span>
                </li>
              )}
              {(c.footer.phone || contact.phone) && (
                <li>
                  <a href={`tel:${c.footer.phone || contact.phone}`} className="inline-flex items-center gap-2 font-medium text-foreground hover:text-primary">
                    <Phone className="h-4 w-4 shrink-0 text-primary" />
                    {c.footer.phone || contact.phone}
                  </a>
                </li>
              )}
              {(c.footer.email || contact.email) && (
                <li>
                  <a href={`mailto:${c.footer.email || contact.email}`} className="inline-flex items-center gap-2 break-all font-medium text-foreground hover:text-primary">
                    <Mail className="h-4 w-4 shrink-0 text-primary" />
                    {c.footer.email || contact.email}
                  </a>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">প্ল্যাটফর্ম</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a href="#about" className="text-muted-foreground hover:text-primary">কীভাবে কাজ করি</a></li>
              <li><a href="#features" className="text-muted-foreground hover:text-primary">{c.nav.features}</a></li>
              <li><a href="#how" className="text-muted-foreground hover:text-primary">{c.nav.how}</a></li>
              <li><a href="#faq" className="text-muted-foreground hover:text-primary">{c.nav.faq || "FAQ"}</a></li>
              <li><a href="#contact" className="text-muted-foreground hover:text-primary">যোগাযোগ</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">অ্যাকাউন্ট</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/login" search={{ mode: "signup" }} className="text-muted-foreground hover:text-primary">{c.nav.cta}</Link></li>
              <li><Link to="/login" className="text-muted-foreground hover:text-primary">{c.nav.signIn}</Link></li>
              <li><Link to="/catalog" search={{}} className="text-muted-foreground hover:text-primary">প্রোডাক্টস</Link></li>
              <li><Link to="/tutorials" className="text-muted-foreground hover:text-primary">ভিডিও টিউটোরিয়াল</Link></li>
              <li><Link to="/privacy" className="text-muted-foreground hover:text-primary">Privacy Policy</Link></li>
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
