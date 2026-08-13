import { createContext, useContext, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { PublicHeaderContent } from "@/components/public-header";

export type CatalogBrand = {
  siteName: string;
  logoUrl: string | null;
  banner: string | null;
  tagline: string;
  landingContent?: PublicHeaderContent | null;
};

const Ctx = createContext<CatalogBrand>({
  siteName: "Catalog",
  logoUrl: null,
  banner: null,
  tagline: "",
  landingContent: null,
});

export const useCatalogBrand = () => useContext(Ctx);
export const CatalogBrandProvider = Ctx.Provider;

export function useLoadCatalogBrand() {
  const [brand, setBrand] = useState<CatalogBrand>({
    siteName: "Catalog",
    logoUrl: null,
    banner: null,
    tagline: "",
    landingContent: null,
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
        landingContent: lc ?? null,
      });
    })();
  }, []);
  return brand;
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
