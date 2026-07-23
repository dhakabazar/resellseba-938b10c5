import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/s/$code")({
  component: StoreLayout,
  head: ({ params }) => ({
    meta: [
      { title: `Store ${params.code}` },
      { name: "description", content: `Shop from ${params.code} — genuine products with cash-on-delivery across Bangladesh.` },
      { property: "og:title", content: `Store ${params.code}` },
      { property: "og:description", content: `Shop from ${params.code} — genuine products with cash-on-delivery.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Store = {
  id: string;
  code: string;
  business_name: string;
  settings: {
    store_name: string | null;
    tagline: string | null;
    logo_url: string | null;
    og_image_url: string | null;
    primary_color: string | null;
    accent_color: string | null;
    whatsapp: string | null;
    facebook_url: string | null;
    instagram_url: string | null;
    footer_text: string | null;
  } | null;
};

function StoreLayout() {
  const { code } = Route.useParams();
  const [store, setStore] = useState<Store | null | "missing">(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("resellers")
        .select("id, code, business_name, reseller_settings(*)")
        .eq("code", code)
        .eq("status", "active")
        .maybeSingle();
      if (!data) return setStore("missing");
      const s = Array.isArray(data.reseller_settings) ? data.reseller_settings[0] : data.reseller_settings;
      setStore({
        id: data.id,
        code: data.code,
        business_name: data.business_name,
        settings: s ?? null,
      });
    })();
  }, [code]);

  if (store === null)
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (store === "missing")
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Store not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">/s/{code} — ei code er kono active store nei.</p>
        </div>
      </div>
    );

  const name = store.settings?.store_name || store.business_name;
  const primary = store.settings?.primary_color || "oklch(0.55 0.20 260)";
  const styleVars = { "--store-primary": primary } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-background" style={styleVars}>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/s/$code" params={{ code }} className="flex items-center gap-3">
            {store.settings?.logo_url ? (
              <img src={store.settings.logo_url} alt={name} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div
                className="grid h-9 w-9 place-items-center rounded-lg font-bold text-white"
                style={{ background: primary }}
              >
                {name.charAt(0)}
              </div>
            )}
            <div>
              <div className="text-sm font-semibold">{name}</div>
              {store.settings?.tagline && (
                <div className="text-[11px] text-muted-foreground">{store.settings.tagline}</div>
              )}
            </div>
          </Link>
          <div className="flex items-center gap-2 text-xs">
            {store.settings?.whatsapp && (
              <a
                href={`https://wa.me/${store.settings.whatsapp.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border px-3 py-1.5 hover:bg-muted"
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </header>

      <Outlet />

      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground">
          {store.settings?.footer_text || `© ${new Date().getFullYear()} ${name}. All rights reserved.`}
          <div className="mt-1 flex justify-center gap-3">
            {store.settings?.facebook_url && (
              <a href={store.settings.facebook_url} target="_blank" rel="noreferrer" className="hover:text-foreground">
                Facebook
              </a>
            )}
            {store.settings?.instagram_url && (
              <a href={store.settings.instagram_url} target="_blank" rel="noreferrer" className="hover:text-foreground">
                Instagram
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Store context helpers for children */
export function useStoreCode() {
  const { code } = Route.useParams();
  return code;
}

/** Small util shared with children */
export { ShoppingBag };
