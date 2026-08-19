import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  LayoutDashboard,
  ShoppingBag,
  ClipboardList,
  Users,
  Palette,
  Globe,
  Wallet,
  Package,
  Award,
  Megaphone,
  Loader2,
  ExternalLink,
  Store,
  Rocket,
  TrendingUp,
  Headphones,
  UserCircle,
  ListTree,


} from "lucide-react";
import { AppShell, type NavEntry } from "@/components/AppShell";
import { useAuth } from "@/lib/use-auth";
import { useBrandingTheme } from "@/lib/branding";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/reseller")({
  component: ResellerLayout,
});

const NAV: NavEntry[] = [
  { label: "Dashboard", to: "/reseller", icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  {
    label: "Products",
    icon: <Package className="h-4 w-4" />,
    items: [
      { label: "Catalog", to: "/reseller/catalog", icon: <Package className="h-4 w-4" /> },
      { label: "My listings", to: "/reseller/listings", icon: <ShoppingBag className="h-4 w-4" /> },
    ],
  },
  { label: "Orders", to: "/reseller/orders", icon: <ClipboardList className="h-4 w-4" /> },
  { label: "Customers", to: "/reseller/customers", icon: <Users className="h-4 w-4" /> },

  {
    label: "Finance",
    icon: <Wallet className="h-4 w-4" />,
    items: [
      { label: "Transactions", to: "/reseller/earnings", icon: <TrendingUp className="h-4 w-4" /> },
      { label: "Payouts", to: "/reseller/payouts", icon: <Wallet className="h-4 w-4" /> },
      { label: "Leader commissions", to: "/reseller/commissions", icon: <Award className="h-4 w-4" /> },
    ],
  },
  {
    label: "Growth",
    icon: <Rocket className="h-4 w-4" />,
    items: [
      { label: "Marketing", to: "/reseller/marketing", icon: <Megaphone className="h-4 w-4" /> },
    ],
  },
  {
    label: "Store",
    icon: <Store className="h-4 w-4" />,
    items: [
      { label: "General settings", to: "/reseller/settings", icon: <Store className="h-4 w-4" /> },
      { label: "Theme", to: "/reseller/theme", icon: <Palette className="h-4 w-4" /> },
      { label: "Header menu", to: "/reseller/menus", icon: <ListTree className="h-4 w-4" /> },
      { label: "Domain", to: "/reseller/domain", icon: <Globe className="h-4 w-4" /> },

      { label: "Visitors", to: "/reseller/visitors", icon: <Activity className="h-4 w-4" /> },
    ],
  },
  { label: "My profile", to: "/reseller/profile", icon: <UserCircle className="h-4 w-4" /> },
  { label: "Support", to: "/reseller/support", icon: <Headphones className="h-4 w-4" /> },
];


function ResellerLayout() {
  const { user, roles, loading } = useAuth();
  const nav = useNavigate();
  const [storeName, setStoreName] = useState("My store");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [storeCode, setStoreCode] = useState<string | null>(null);
  const [primary, setPrimary] = useState<string | null>(null);
  const [approved, setApproved] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (roles.includes("super_admin") || roles.includes("staff")) {
      nav({ to: "/admin", replace: true });
      return;
    }
    if (!roles.includes("reseller") && !roles.includes("leader")) {
      nav({ to: "/onboarding", replace: true });
    }
  }, [loading, roles, nav]);

  useEffect(() => {
    if (approved === false) nav({ to: "/onboarding", replace: true });
  }, [approved, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: g } = await supabase
        .from("global_settings")
        .select("logo_url, primary_color")
        .eq("id", 1)
        .maybeSingle();
      let logo = g?.logo_url ?? null;
      let color = g?.primary_color ?? null;

      const { data: r } = await supabase
        .from("resellers")
        .select("id, business_name, code, status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (r) {
        setApproved(r.status === "active");
        setStoreName(r.business_name);
        setStoreCode(r.code);
        const { data: s } = await supabase
          .from("reseller_settings")
          .select("logo_url, primary_color")
          .eq("reseller_id", r.id)
          .maybeSingle();
        if (s?.logo_url) logo = s.logo_url;
        if (s?.primary_color) color = s.primary_color;
      } else {
        setApproved(false);
      }
      setLogoUrl(logo);
      setPrimary(color);
    })();
  }, [user]);

  useBrandingTheme(primary);


  if (
    loading ||
    !user ||
    approved !== true ||
    (!roles.includes("reseller") && !roles.includes("leader"))
  ) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }


  return (
    <AppShell
      title="Reseller panel"
      brand={{ name: storeName, sub: storeCode ? `/${storeCode}` : "Reseller", logoUrl }}
      nav={NAV}
      user={{
        name: user.user_metadata?.full_name ?? "Reseller",
        email: user.email ?? "",
      }}
      headerRight={
        storeCode ? (
          <a
            href={`/s/${storeCode}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm font-medium transition hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" /> Visit store
          </a>
        ) : null
      }
    >
      <Outlet />
    </AppShell>
  );
}
