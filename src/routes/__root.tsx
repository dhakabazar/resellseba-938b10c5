import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBrandingTheme } from "@/lib/branding";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
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
      { name: "twitter:title", content: "Reseller Platform — Nijer online store, zero investment" },
      { name: "twitter:description", content: "Bangladesh er first-class reseller platform. Product listing, courier, payment, marketing — ekta panel-e sob." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e6e3679e-dac1-4202-9aa4-535009bfced2/id-preview-750e03de--5d73bd1b-e372-42fe-87de-7efb4128bd67.lovable.app-1785176212947.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e6e3679e-dac1-4202-9aa4-535009bfced2/id-preview-750e03de--5d73bd1b-e372-42fe-87de-7efb4128bd67.lovable.app-1785176212947.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const [brand, setBrand] = useState<{ primary: string | null; accent: string | null }>({
    primary: null,
    accent: null,
  });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        router.navigate({ to: "/login", replace: true });
      }
      // Note: Removed automatic query invalidation on SIGNED_IN to prevent reloads
      // The session is already managed by the client.
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  useEffect(() => {
    supabase
      .from("global_settings")
      .select("favicon_url, primary_color, accent_color")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        const d = data as { favicon_url?: string | null; primary_color?: string | null; accent_color?: string | null } | null;
        if (d?.favicon_url) {
          document.querySelectorAll("link[rel~='icon']").forEach((el) => el.remove());
          const link = document.createElement("link");
          link.rel = "icon";
          link.href = d.favicon_url;
          document.head.appendChild(link);
        }
        setBrand({ primary: d?.primary_color ?? null, accent: d?.accent_color ?? null });
      });
  }, []);

  useBrandingTheme(brand.primary, brand.accent);


  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
