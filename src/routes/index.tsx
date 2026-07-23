import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Store" },
      { name: "description", content: "Shop genuine products with cash on delivery across Bangladesh." },
      { property: "og:title", content: "Store" },
      { property: "og:description", content: "Shop genuine products with cash on delivery across Bangladesh." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RootResolver,
});

function RootResolver() {
  const nav = useNavigate();
  const [status, setStatus] = useState<"loading" | "no-store">("loading");

  useEffect(() => {
    (async () => {
      const host = typeof window !== "undefined" ? window.location.hostname : "";
      let code: string | null = null;

      // 1) Custom domain → reseller
      if (host) {
        const { data: dom } = await supabase
          .from("reseller_domains")
          .select("reseller_id, resellers(code, status)")
          .eq("hostname", host)
          .not("verified_at", "is", null)
          .maybeSingle();
        const r = (dom as any)?.resellers;
        if (r && r.status === "active") code = r.code;
      }

      // 2) Flagship on main / preview domain
      if (!code) {
        const { data: gs } = await supabase
          .from("global_settings")
          .select("flagship_reseller_code")
          .eq("id", 1)
          .maybeSingle();
        if (gs?.flagship_reseller_code) {
          const { data: r } = await supabase
            .from("resellers")
            .select("code")
            .eq("code", gs.flagship_reseller_code)
            .eq("status", "active")
            .maybeSingle();
          if (r) code = r.code;
        }
      }

      if (code) nav({ to: "/s/$code", params: { code }, replace: true });
      else setStatus("no-store");
    })();
  }, [nav]);

  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No store configured for this host — sign-in gateway.
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
          R
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Reseller platform</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ei domain-e ekhono kono store connected nei. Admin/reseller hisebe sign in korun ba flagship store code set korun (Admin → Settings).
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to="/auth" className="btn-brand rounded-md px-5 py-2.5 text-sm font-medium">
            Sign in
          </Link>
          <Link to="/auth" className="rounded-md border bg-background px-5 py-2.5 text-sm font-medium hover:bg-muted">
            Become a reseller
          </Link>
        </div>
      </div>
    </div>
  );
}
