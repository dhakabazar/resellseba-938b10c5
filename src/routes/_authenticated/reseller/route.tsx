import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  ClipboardList,
  Palette,
  Globe,
  Wallet,
  Package,
  Award,
  Megaphone,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/reseller")({
  component: ResellerLayout,
});

const NAV = [
  { label: "Dashboard", to: "/reseller", icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { label: "Catalog", to: "/reseller/catalog", icon: <Package className="h-4 w-4" /> },
  { label: "My listings", to: "/reseller/listings", icon: <ShoppingBag className="h-4 w-4" /> },
  { label: "Orders", to: "/reseller/orders", icon: <ClipboardList className="h-4 w-4" /> },
  { label: "Payouts", to: "/reseller/payouts", icon: <Wallet className="h-4 w-4" /> },
  { label: "Leader commissions", to: "/reseller/commissions", icon: <Award className="h-4 w-4" /> },
  { label: "Marketing", to: "/reseller/marketing", icon: <Megaphone className="h-4 w-4" /> },
  { label: "Store design", to: "/reseller/design", icon: <Palette className="h-4 w-4" /> },
  { label: "Domain", to: "/reseller/domain", icon: <Globe className="h-4 w-4" /> },
];

function ResellerLayout() {
  const { user, roles, loading } = useAuth();
  const nav = useNavigate();
  const [storeName, setStoreName] = useState("My store");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (roles.includes("super_admin")) {
      nav({ to: "/admin", replace: true });
      return;
    }
    if (!roles.includes("reseller") && !roles.includes("leader")) {
      nav({ to: "/onboarding", replace: true });
    }
  }, [loading, roles, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: r } = await supabase
        .from("resellers")
        .select("id, business_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (r) {
        setStoreName(r.business_name);
        const { data: s } = await supabase
          .from("reseller_settings")
          .select("logo_url")
          .eq("reseller_id", r.id)
          .maybeSingle();
        if (s?.logo_url) {
          setLogoUrl(s.logo_url);
          return;
        }
      }
      const { data: g } = await supabase
        .from("global_settings")
        .select("logo_url")
        .eq("id", 1)
        .maybeSingle();
      if (g?.logo_url) setLogoUrl(g.logo_url);
    })();
  }, [user]);

  if (loading || !user || (!roles.includes("reseller") && !roles.includes("leader"))) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppShell
      title="Reseller panel"
      brand={{ name: storeName, sub: "Reseller", logoUrl }}
      nav={NAV}
      user={{
        name: user.user_metadata?.full_name ?? "Reseller",
        email: user.email ?? "",
      }}
    >
      <Outlet />
    </AppShell>
  );
}
