import { useEffect, useState, type ReactNode } from "react";
import { getLpBootstrap } from "@/lib/bootstrap";
import { useStoreLoader } from "@/components/store/store-context";
import { useStoreVisitLog } from "@/lib/store-visits";
import { storeThemeStyle } from "@/lib/store-theme";
import { LegacyChromeBoundary, PoripatiChromeBoundary } from "@/components/store/theme-loader";
import { Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { resolveDomainToStoreCode } from "@/lib/domain-lookup.functions";

export function CustomDomainStoreLayout({
  code: propCode,
  children,
  path = "/",
}: {
  code?: string;
  children: (props: { code: string }) => ReactNode;
  path?: string;
}) {
  const [storeCode, setStoreCode] = useState<string | null>(propCode || null);
  const [loading, setLoading] = useState(!propCode);
  const resolveDomain = useServerFn(resolveDomainToStoreCode);

  useEffect(() => {
    if (propCode) {
      setStoreCode(propCode);
      setLoading(false);
      return;
    }

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
        setLoading(false);
        return;
      }

      // Try 1: bootstrap cache/RPC
      try {
        const data = await getLpBootstrap(host);
        if (alive && data?.store?.code && data.store.status === "active") {
          setStoreCode(data.store.code);
          setLoading(false);
          return;
        }
      } catch {
        // Fallback to server function below
      }

      // Try 2: Server function with admin database access
      try {
        const code = await resolveDomain({ data: { hostname: host } });
        if (alive && code) {
          setStoreCode(code);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("[CustomDomainStoreLayout] Domain resolution error:", err);
      }

      if (alive) {
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [propCode, resolveDomain]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!storeCode) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-semibold">Store Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No active store is connected to this domain address.
          </p>
        </div>
      </div>
    );
  }

  return (
    <StoreShell code={storeCode} path={path}>
      {children({ code: storeCode })}
    </StoreShell>
  );
}

export function StoreShell({
  code,
  path,
  children,
}: {
  code: string;
  path: string;
  children: ReactNode;
}) {
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
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
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
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
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
