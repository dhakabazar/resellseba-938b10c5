import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Menu, X } from "lucide-react";

type NavContent = {
  features?: string;
  how?: string;
  pricing?: string;
  signIn?: string;
  cta?: string;
  faq?: string;
};

export type PublicHeaderContent = {
  nav: NavContent;
};

const FALLBACK: PublicHeaderContent = {
  nav: {
    features: "ফিচার",
    how: "কীভাবে কাজ করে",
    pricing: "প্রাইসিং",
    faq: "FAQ",
    signIn: "সাইন ইন",
    cta: "শুরু করুন",
  },
};

export function Brand({
  siteName,
  logoUrl,
  size = "md",
}: {
  siteName: string;
  logoUrl: string | null;
  size?: "md" | "sm";
}) {
  const h = size === "md" ? "h-11 sm:h-12" : "h-9";
  if (logoUrl) return <img src={logoUrl} alt={siteName} className={`${h} max-w-40 shrink-0 object-contain`} />;
  return (
    <span
      className={`grid ${size === "md" ? "h-11 w-11" : "h-9 w-9"} shrink-0 place-items-center rounded-xl bg-[image:var(--gradient-brand)] text-lg font-black text-primary-foreground`}
    >
      {siteName.charAt(0).toUpperCase()}
    </span>
  );
}

export function PublicHeader({
  siteName: siteNameProp,
  logoUrl: logoUrlProp,
  content,
}: {
  siteName?: string;
  logoUrl?: string | null;
  content?: PublicHeaderContent;
}) {
  const [menu, setMenu] = useState(false);
  const [loadedBrand, setLoadedBrand] = useState<{ siteName: string; logoUrl: string | null }>({
    siteName: "Reseller",
    logoUrl: null,
  });
  const [loadedContent, setLoadedContent] = useState<PublicHeaderContent | null>(null);

  useEffect(() => {
    const needsBrand = siteNameProp === undefined || logoUrlProp === undefined;
    const needsContent = !content;
    if (!needsBrand && !needsContent) return;
    (async () => {
      const { data } = await supabase
        .from("global_settings")
        .select("site_name, logo_url, landing_content")
        .eq("id", 1)
        .maybeSingle();
      if (!data) return;
      const d = data as Record<string, any>;
      if (needsBrand) {
        setLoadedBrand({ siteName: d.site_name ?? "Reseller", logoUrl: d.logo_url ?? null });
      }
      if (needsContent && d.landing_content?.nav) {
        setLoadedContent(d.landing_content);
      }
    })();
  }, [siteNameProp, logoUrlProp, content]);

  const siteName = siteNameProp ?? loadedBrand.siteName;
  const logoUrl = logoUrlProp ?? loadedBrand.logoUrl;
  const c = content ?? loadedContent ?? FALLBACK;

  const navLinks: Array<{ href?: string; to?: "/catalog"; label?: string }> = [
    { href: "#features", label: c.nav.features },
    { href: "#how", label: c.nav.how },
    { href: "#pricing", label: c.nav.pricing },
    { to: "/catalog" as const, label: "প্রোডাক্টস" },
    { href: "#faq", label: c.nav.faq || "FAQ" },
  ];


  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:h-18 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center" aria-label={siteName}>
          <Brand siteName={siteName} logoUrl={logoUrl} />
        </Link>

        <nav className="hidden items-center gap-7 text-base font-semibold text-muted-foreground lg:flex">
          {navLinks.map((l) =>
            l.to ? (
              <Link key={l.to} to={l.to} search={{}} className="font-bold text-primary hover:opacity-80">
                {l.label}
              </Link>
            ) : (
              <a key={l.href} href={l.href} className="transition-colors hover:text-primary">
                {l.label}
              </a>
            ),
          )}
        </nav>


        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/login"
            className="hidden rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-primary/50 hover:text-primary sm:inline-flex"
          >
            {c.nav.signIn}
          </Link>
          <Link
            to="/login"
            search={{ mode: "signup" }}
            className="btn-brand btn-live inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold"
          >
            {c.nav.cta} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-label="Menu"
            className="grid h-10 w-10 place-items-center rounded-lg border border-border lg:hidden"
          >
            {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menu && (
        <nav className="border-t border-border/60 bg-background px-4 py-3 text-base lg:hidden">
          {navLinks.map((l) =>
            l.to ? (
              <Link
                key={l.to}
                to={l.to}
                search={{}}
                onClick={() => setMenu(false)}
                className="block rounded-lg px-3 py-2.5 font-bold text-primary hover:bg-primary/10"
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenu(false)}
                className="block rounded-lg px-3 py-2.5 font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </a>
            ),
          )}

          <Link
            to="/login"
            onClick={() => setMenu(false)}
            className="block rounded-lg px-3 py-2.5 font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {c.nav.signIn}
          </Link>
        </nav>
      )}
    </header>
  );
}
