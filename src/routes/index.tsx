import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Zap, Globe, PackageOpen, TrendingUp, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ResellHub — Bangladesh's #1 reseller platform" },
      {
        name: "description",
        content:
          "Launch your own store in minutes. Curated catalog, courier & payment integrations, and everything you need to grow as a reseller in Bangladesh.",
      },
      { property: "og:title", content: "ResellHub — Bangladesh's #1 reseller platform" },
      {
        property: "og:description",
        content:
          "Launch your own store in minutes with a curated catalog, courier & payment integrations, and everything you need to grow.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 font-bold text-primary-foreground">
              R
            </div>
            <span className="font-semibold tracking-tight">ResellHub</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/auth" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link
              to="/auth"
              className="btn-brand rounded-md px-4 py-2 text-sm font-medium"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live in Bangladesh
          </div>
          <h1 className="text-balance text-5xl font-semibold tracking-tight md:text-6xl">
            Sell curated products. <br />
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Build your own brand.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            ResellHub-e reseller ra super admin er full catalog theke bectechen — nijer
            price, nijer domain, nijer branding. Courier, payment, ads sob built-in.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="btn-brand rounded-md px-6 py-3 text-sm font-medium"
            >
              Become a reseller
            </Link>
            <Link
              to="/auth"
              className="rounded-md border bg-background px-6 py-3 text-sm font-medium hover:bg-muted"
            >
              Admin sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            Everything a reseller needs
          </h2>
          <p className="mt-2 text-muted-foreground">
            Store banano theke shuru kore order manage, courier booking, payment — sob
            ek jaigai.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: <PackageOpen className="h-5 w-5" />,
              t: "Curated catalog",
              d: "Super admin er verified products, transparent cost breakdown.",
            },
            {
              icon: <TrendingUp className="h-5 w-5" />,
              t: "Own pricing & profit",
              d: "Nijer profit margin bosao, real-time ledger e dekha jabe.",
            },
            {
              icon: <Globe className="h-5 w-5" />,
              t: "Custom domain",
              d: "Nijer domain, nijer logo — Cloudflare SSL automatic.",
            },
            {
              icon: <ShoppingBag className="h-5 w-5" />,
              t: "Courier & payment",
              d: "Steadfast, Pathao, bKash, Nagad, SSLCommerz — built-in.",
            },
            {
              icon: <Zap className="h-5 w-5" />,
              t: "Ads-ready",
              d: "Facebook Pixel + CAPI, TikTok Events API, GA4 — sob configurable.",
            },
            {
              icon: <ShieldCheck className="h-5 w-5" />,
              t: "Secure by default",
              d: "Row-level security, image malware scan, per-reseller data isolation.",
            },
          ].map((f) => (
            <div key={f.t} className="surface-card p-6">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft text-primary">
                {f.icon}
              </div>
              <div className="font-semibold">{f.t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ResellHub · Made in Bangladesh
      </footer>
    </div>
  );
}
