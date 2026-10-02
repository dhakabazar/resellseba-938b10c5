import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getLpBootstrap } from "@/lib/bootstrap";
import { useStoreLoader } from "@/components/store/store-context";
import { useStoreVisitLog } from "@/lib/store-visits";
import { storeThemeStyle } from "@/lib/store-theme";
import { LegacyChromeBoundary, PoripatiChromeBoundary } from "@/components/store/theme-loader";
import { Loader2 } from "lucide-react";

export function CustomDomainStoreLayout({
  children,
  path = "/",
}: {
  children: (props: { code: string }) => ReactNode;
  path?: string;
}) {
  const [storeCode, setStoreCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      const host = typeof window !== "undefined" ? window.location.hostname : "";
      const isPlatform =
        !host ||
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.endsWith(".lovable.app") ||
        host.endsWith(".lovableproject.com") ||
        (host === "ecomsellerbd.com" || (host.endsWith(".ecomsellerbd.com") && host !== "fallback.ecomsellerbd.com"));

      if (isPlatform) {
        nav({ to: "/", replace: true });
        return;
      }

      const data = await getLpBootstrap(host);
      if (!alive) return;
      if (data?.store?.code && data.store.status === "active") {
        setStoreCode(data.store.code);
      } else {
        nav({ to: "/", replace: true });
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [nav]);

  if (loading || !storeCode) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <StoreShell code={storeCode} path={path}>
      {children({ code: storeCode })}
    </StoreShell>
  );
}

function StoreShell({ code, path, children }: { code: string; path: string; children: ReactNode }) {
  const { state, store, Provider } = useStoreLoader(code);
  useStoreVisitLog(code, path, false);

  if (state === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "closed") {
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
  }

  if (state === "missing" || !store) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Store not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">No active store exists for this address.</p>
        </div>
      </div>
    );
  }

  const style = storeThemeStyle(store.theme, store.palette.id);
  const body =
    store.theme.id === "poripati" ? (
      <PoripatiChromeBoundary>{children}</PoripatiChromeBoundary>
    ) : (
      <LegacyChromeBoundary>{children}</LegacyChromeBoundary>
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
