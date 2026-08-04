import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { loadTrackingForReseller } from "@/lib/tracking";
import { storeThemeStyle } from "@/lib/store-theme";
import { useStoreLoader } from "@/components/store/store-context";
import { StoreFooter, StoreHeader } from "@/components/store/chrome";


export const Route = createFileRoute("/s/$code")({
  component: StoreLayout,
  head: ({ params }) => ({
    meta: [
      { title: `${params.code} — Online Store` },
      {
        name: "description",
        content: `Shop from ${params.code} — genuine products with cash-on-delivery across Bangladesh.`,
      },
      { property: "og:title", content: `${params.code} — Online Store` },
      { property: "og:description", content: `Shop from ${params.code} — cash on delivery nationwide.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function StoreLayout() {
  const { code } = Route.useParams();
  /** `?theme=` / `?palette=` let the reseller panel preview any combination. */
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const params = new URLSearchParams(searchStr);
  const previewTheme = params.get("theme");
  const previewPalette = params.get("palette");
  const { state, store, Provider } = useStoreLoader(code, previewTheme, previewPalette);


  useEffect(() => {
    if (store?.resellerId) loadTrackingForReseller(store.resellerId).catch(() => {});
  }, [store?.resellerId]);

  if (state === "loading")
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  if (state === "missing" || !store)
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Store not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">No active store exists for this address.</p>
        </div>
      </div>
    );

  const style = storeThemeStyle(store.theme, store.palette.id);

  return (
    <Provider value={store}>
      <div
        data-store-theme={store.theme.id}
        style={{ ...style, fontFamily: "var(--st-font-body)" }}
        className="min-h-screen bg-[var(--st-bg)] text-[var(--st-fg)] antialiased"
      >
        <StoreHeader />
        <main>
          <Outlet />
        </main>
        <StoreFooter />
      </div>
    </Provider>
  );
}
