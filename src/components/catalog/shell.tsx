import { createContext, useContext, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Copy, Download } from "lucide-react";
import { toast } from "sonner";

export type CatalogBrand = {
  siteName: string;
  logoUrl: string | null;
  banner: string | null;
  tagline: string;
};

const Ctx = createContext<CatalogBrand>({ siteName: "Catalog", logoUrl: null, banner: null, tagline: "" });
export const useCatalogBrand = () => useContext(Ctx);
export const CatalogBrandProvider = Ctx.Provider;

export function useLoadCatalogBrand() {
  const [brand, setBrand] = useState<CatalogBrand>({
    siteName: "Catalog",
    logoUrl: null,
    banner: null,
    tagline: "",
  });
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("global_settings")
        .select("site_name, logo_url, landing_content")
        .eq("id", 1)
        .maybeSingle();
      if (!data) return;
      const lc = (data as Record<string, any>).landing_content ?? {};
      setBrand({
        siteName: data.site_name ?? "Catalog",
        logoUrl: (data as Record<string, any>).logo_url ?? null,
        banner: lc?.hero?.bannerImage?.url ?? null,
        tagline: lc?.footer?.tagline ?? "",
      });
    })();
  }, []);
  return brand;
}

export function CatalogHeader() {
  const { siteName, logoUrl } = useCatalogBrand();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2" aria-label={siteName}>
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="h-10 max-w-36 shrink-0 object-contain sm:h-12" />
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
              {siteName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="hidden truncate text-sm font-bold sm:inline">{siteName}</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-4">
          <Link to="/" className="rounded-md px-2 py-1.5 text-muted-foreground hover:text-foreground">
            Home
          </Link>
          <Link
            to="/catalog"
            className="rounded-md px-2 py-1.5 font-semibold text-primary"
            activeProps={{ className: "rounded-md px-2 py-1.5 font-semibold text-primary" }}
          >
            Catalog
          </Link>
          <Link
            to="/login"
            search={{ mode: "signup" }}
            className="btn-brand inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-semibold sm:text-sm"
          >
            Reseller হোন <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function CatalogFooter() {
  const { siteName, tagline } = useCatalogBrand();
  return (
    <footer className="mt-16 border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <span>
          © {new Date().getFullYear()} {siteName} {tagline ? `· ${tagline}` : ""}
        </span>
        <span>Master catalog · শুধু দেখার জন্য, অর্ডার রিসেলার স্টোর থেকে</span>
      </div>
    </footer>
  );
}

export function copyText(text: string, label = "Copied") {
  navigator.clipboard.writeText(text).then(
    () => toast.success(label),
    () => toast.error("Copy failed"),
  );
}

export function CopyBtn({ text, label, title }: { text: string; label?: string; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        copyText(text, label ?? "Copied");
      }}
      className="inline-flex items-center gap-1 rounded-lg border bg-card/90 px-2 py-1.5 text-[11px] font-semibold shadow-sm backdrop-blur hover:border-primary/50 hover:text-primary"
    >
      <Copy className="h-3.5 w-3.5" /> {title}
    </button>
  );
}

export function DownloadBtn({ url }: { url: string }) {
  return (
    <a
      href={url}
      download
      target="_blank"
      rel="noreferrer"
      title="Download image"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 rounded-lg border bg-card/90 px-2 py-1.5 text-[11px] font-semibold shadow-sm backdrop-blur hover:border-primary/50 hover:text-primary"
    >
      <Download className="h-3.5 w-3.5" /> Image
    </a>
  );
}
