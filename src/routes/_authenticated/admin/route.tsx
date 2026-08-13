import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
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
  Shield,
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

/** Which permission unlocks each admin route. Super admin always sees everything. */
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  "/admin": ["dashboard.view"],
  "/admin/products": ["products.view", "products.manage"],
  "/admin/brands": ["brands.manage"],
  "/admin/categories": ["categories.manage"],
  "/admin/orders": ["orders.view", "orders.edit", "orders.create", "orders.delete"],
  "/admin/financials": ["finance.view"],
  "/admin/business-report": ["reports.view"],
  "/admin/payouts": ["payouts.manage"],
  "/admin/commissions": ["commissions.manage"],
  "/admin/resellers": ["resellers.manage"],
  "/admin/marketing": ["marketing.manage"],
  "/admin/notifications": ["notifications.manage"],
  "/admin/landing": ["landing.manage"],
  "/admin/couriers": ["couriers.manage"],
  "/admin/payments": ["payments.manage"],
  "/admin/staff": ["staff.manage"],
  "/admin/audit": ["audit.view"],
  "/admin/settings": ["settings.manage"],
};

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

      { label: "Staff & Permissions", to: "/admin/staff", icon: <Users className="h-4 w-4" /> },
      { label: "Audit log", to: "/admin/audit", icon: <ScrollText className="h-4 w-4" /> },

      { label: "Settings", to: "/admin/settings", icon: <Settings className="h-4 w-4" /> },

    ],
  },
];

function allowed(to: string | undefined, permissions: string[], isSuperAdmin: boolean) {
  if (isSuperAdmin) return true;
  if (!to) return true;
  const needed = ROUTE_PERMISSIONS[to];
  if (!needed) return true;
  return needed.some((p) => permissions.includes(p));
}

function filterNav(nav: NavEntry[], permissions: string[], isSuperAdmin: boolean): NavEntry[] {
  if (isSuperAdmin) return nav;
  const out: NavEntry[] = [];
  for (const entry of nav) {
    const group = entry as { items?: { to?: string }[] };
    if (group.items) {
      const items = group.items.filter((i) => allowed(i.to, permissions, isSuperAdmin));
      if (items.length > 0) out.push({ ...(entry as any), items } as NavEntry);
      continue;
    }
    if (allowed((entry as { to?: string }).to, permissions, isSuperAdmin)) out.push(entry);
  }
  return out;
}

function AdminLayout() {
  const { user, roles, permissions, loading } = useAuth();
  const nav = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const isSuperAdmin = roles.includes("super_admin");
  const isStaff = roles.includes("staff");
  const canEnter = isSuperAdmin || (isStaff && permissions.length > 0);
  const routePermission = Object.entries(ROUTE_PERMISSIONS)
    .sort(([a], [b]) => b.length - a.length)
    .find(([route]) => pathname === route || pathname.startsWith(`${route}/`))?.[1];
  const canViewRoute =
    isSuperAdmin ||
    (isStaff && routePermission != null && routePermission.some((permission) => permissions.includes(permission)));
  const [brand, setBrand] = useState<{ name: string; logoUrl: string | null; primary: string | null }>({
    name: "Admin",
    logoUrl: null,
    primary: null,
  });

  useEffect(() => {
    if (loading) return;
    
    console.log(`[AdminLayout] Guard check: canEnter=${canEnter}, canViewRoute=${canViewRoute}, roles=${roles}`);

    if (!canEnter || !canViewRoute) {
      if (roles.includes("reseller") || roles.includes("leader")) {
        console.log("[AdminLayout] Redirecting to /reseller");
        nav({ to: "/reseller", replace: true });
      } else if (isStaff && permissions.length === 0) {
        console.log("[AdminLayout] Redirecting to /onboarding (staff with no perms)");
        nav({ to: "/onboarding", replace: true });
      } else if (pathname !== "/admin") {
        console.log("[AdminLayout] Redirecting to /admin (root)");
        nav({ to: "/admin", replace: true });
      } else if (roles.length > 0) {
        // Fallback for when they have a role but not an admin one
        console.log("[AdminLayout] Redirecting to /dashboard fallback");
        nav({ to: "/dashboard", replace: true });
      }
      // If roles.length === 0, they might be in the middle of a fetch
    }
  }, [loading, canEnter, canViewRoute, roles, permissions, pathname, nav]);

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

  if (loading || !user || !canEnter || !canViewRoute) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppShell
      title={isSuperAdmin ? "Super Admin" : "Staff Panel"}
      brand={{ name: brand.name, sub: isSuperAdmin ? "Admin panel" : "Staff panel", logoUrl: brand.logoUrl }}
      nav={filterNav(NAV, permissions, isSuperAdmin)}
      user={{
        name: user.user_metadata?.full_name ?? (isSuperAdmin ? "Admin" : "Staff"),
        email: user.email ?? "",
      }}
    >
      <Outlet />
    </AppShell>
  );
}
