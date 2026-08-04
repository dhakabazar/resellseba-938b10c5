import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Package,
  Tag,
  FolderTree,
  Users,
  Settings,
  Truck,
  Wallet,
  ShoppingCart,
  Megaphone,
  Award,
  ScrollText,
  Bell,
  FileText,
  ShoppingBag,
  Store,
  Rocket,
  Cog,
  LineChart,
  PieChart,
  Percent,
} from "lucide-react";
import { AppShell, type NavEntry } from "@/components/AppShell";
import { useAuth } from "@/lib/use-auth";
import { useBrandingTheme } from "@/lib/branding";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const NAV: NavEntry[] = [
  { label: "Dashboard", to: "/admin", icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  {
    label: "Catalog",
    icon: <Store className="h-4 w-4" />,
    items: [
      { label: "Products", to: "/admin/products", icon: <Package className="h-4 w-4" /> },
      { label: "Brands", to: "/admin/brands", icon: <Tag className="h-4 w-4" /> },
      { label: "Categories", to: "/admin/categories", icon: <FolderTree className="h-4 w-4" /> },
    ],
  },
  { label: "Orders", to: "/admin/orders", icon: <ShoppingCart className="h-4 w-4" /> },

  {
    label: "Finance",
    icon: <Wallet className="h-4 w-4" />,
    items: [
      { label: "Financials", to: "/admin/financials", icon: <LineChart className="h-4 w-4" /> },
      { label: "Business report", to: "/admin/business-report", icon: <PieChart className="h-4 w-4" /> },
      { label: "Payouts", to: "/admin/payouts", icon: <Wallet className="h-4 w-4" /> },
      { label: "Commissions", to: "/admin/commissions", icon: <Percent className="h-4 w-4" /> },
    ],
  },
  { label: "Resellers", to: "/admin/resellers", icon: <Users className="h-4 w-4" /> },
  {
    label: "Growth",
    icon: <Rocket className="h-4 w-4" />,
    items: [
      { label: "Marketing", to: "/admin/marketing", icon: <Megaphone className="h-4 w-4" /> },
      { label: "Notifications", to: "/admin/notifications", icon: <Bell className="h-4 w-4" /> },
      { label: "Landing page", to: "/admin/landing", icon: <FileText className="h-4 w-4" /> },
    ],
  },
  {
    label: "System",
    icon: <Cog className="h-4 w-4" />,
    items: [
      { label: "Couriers", to: "/admin/couriers", icon: <Truck className="h-4 w-4" /> },
      { label: "Payment methods", to: "/admin/payments", icon: <Wallet className="h-4 w-4" /> },

      { label: "Audit log", to: "/admin/audit", icon: <ScrollText className="h-4 w-4" /> },
      { label: "Settings", to: "/admin/settings", icon: <Settings className="h-4 w-4" /> },

    ],
  },
];

function AdminLayout() {
  const { user, roles, loading } = useAuth();
  const nav = useNavigate();
  const [brand, setBrand] = useState<{ name: string; logoUrl: string | null; primary: string | null }>({
    name: "Admin",
    logoUrl: null,
    primary: null,
  });

  useEffect(() => {
    if (loading) return;
    if (!roles.includes("super_admin")) nav({ to: "/dashboard", replace: true });
  }, [loading, roles, nav]);

  useEffect(() => {
    supabase
      .from("global_settings")
      .select("site_name, logo_url, primary_color")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data)
          setBrand({
            name: data.site_name ?? "Admin",
            logoUrl: data.logo_url ?? null,
            primary: data.primary_color ?? null,
          });
      });
  }, []);

  useBrandingTheme(brand.primary);

  if (loading || !user || !roles.includes("super_admin")) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppShell
      title="Super Admin"
      brand={{ name: brand.name, sub: "Admin panel", logoUrl: brand.logoUrl }}
      nav={NAV}
      user={{
        name: user.user_metadata?.full_name ?? "Admin",
        email: user.email ?? "",
      }}
    >
      <Outlet />
    </AppShell>
  );
}
