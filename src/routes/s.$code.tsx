import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useStoreVisitLog } from "@/lib/store-visits";
import { storeThemeStyle } from "@/lib/store-theme";
import { useStoreLoader } from "@/components/store/store-context";
import { LegacyChromeBoundary, PoripatiChromeBoundary } from "@/components/store/theme-loader";


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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const params = new URLSearchParams(searchStr);
  const previewTheme = params.get("theme");
  const previewPalette = params.get("palette");
  const { state, store, Provider } = useStoreLoader(code, previewTheme, previewPalette);

  /** Panel previews (?theme / ?palette) are not counted as customer visits. */
  useStoreVisitLog(code, pathname.replace(`/s/${code}`, "") || "/", Boolean(previewTheme || previewPalette));

  if (state === "loading")
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  if (state === "closed")
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-semibold">Store temporarily unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This store is closed right now. Please try again later or contact the store owner.
          </p>
        </div>
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
  const body = store.theme.id === "poripati" ? (
    <PoripatiChromeBoundary><Outlet /></PoripatiChromeBoundary>
  ) : (
    <LegacyChromeBoundary><Outlet /></LegacyChromeBoundary>
  );

  return (
    <Provider value={store}>
      <div
        data-store-theme={store.theme.id}
        style={{ ...style, fontFamily: "var(--st-font-body)" }}
        className="min-h-screen bg-[var(--st-bg)] text-[var(--st-fg)] antialiased"
      >
        {body}
      </div>
    </Provider>
  );
}
