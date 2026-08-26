import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sliders,
  Activity,
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
  ShieldCheck,
  Eraser,
  Globe,

  Bell,
  FileText,
  ShoppingBag,
  Store,
  Rocket,
  Cog,
  LineChart,
  PieChart,
  Percent,
  UserCheck,
  Target,
  Receipt,
} from "lucide-react";
import { AppShell, type NavEntry } from "@/components/AppShell";
import { BulkScanButton } from "@/components/BulkScanModal";
import { useAuth } from "@/lib/use-auth";
import { useBrandingTheme } from "@/lib/branding";
import { getGlobalSettings } from "@/lib/app-data";
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
  "/admin/orders": ["orders.view", "orders.edit", "orders.create", "orders.delete", "orders.status", "orders.ship"],
  "/admin/customers": ["orders.view", "orders.edit", "reports.view"],
  "/admin/transactions": ["finance.view"],
  "/admin/business-report": ["reports.view"],
  "/admin/expenses": ["expenses.manage", "finance.view", "reports.view", "settings.manage"],
  "/admin/payouts": ["payouts.manage"],
  "/admin/commissions": ["commissions.manage"],
  "/admin/resellers": ["resellers.manage"],
  "/admin/agents": ["agents.manage"],
  "/admin/agent-report": ["agents.view", "agents.manage"],
  "/admin/agent-payouts": ["agents.manage", "payouts.manage"],

  "/admin/visitors": ["visitors.view", "reports.view", "dashboard.view", "resellers.manage"],
  "/admin/marketing": ["marketing.manage"],
  "/admin/notifications": ["notifications.manage"],
  "/admin/notices": ["notifications.manage", "settings.manage"],
  "/admin/landing": ["landing.manage"],
  "/admin/couriers": ["couriers.manage"],
  "/admin/payments": ["payments.manage"],
  "/admin/staff": ["staff.manage"],
  "/admin/maintenance": ["maintenance.manage", "settings.manage"],
  "/admin/advanced": ["settings.advanced", "settings.manage"],
  "/admin/domains": ["domains.manage", "settings.manage"],
  "/admin/deposits": ["deposits.manage", "settings.manage", "resellers.manage", "finance.view"],
  "/admin/deposit-transactions": ["deposits.manage", "finance.view", "resellers.manage", "settings.manage"],
  "/admin/settings": ["settings.manage"],
  "/admin/privacy": ["settings.manage"],
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
  { label: "Customers", to: "/admin/customers", icon: <Users className="h-4 w-4" /> },

  {
    label: "Finance",
    icon: <Wallet className="h-4 w-4" />,
    items: [
      { label: "Transaction Report", to: "/admin/transactions", icon: <LineChart className="h-4 w-4" /> },
      { label: "Business report", to: "/admin/business-report", icon: <PieChart className="h-4 w-4" /> },
      { label: "Expenses", to: "/admin/expenses", icon: <Receipt className="h-4 w-4" /> },
      { label: "Payouts", to: "/admin/payouts", icon: <Wallet className="h-4 w-4" /> },
      { label: "Commissions", to: "/admin/commissions", icon: <Percent className="h-4 w-4" /> },
      { label: "Deposit transactions", to: "/admin/deposit-transactions", icon: <ShieldCheck className="h-4 w-4" /> },
    ],
  },
  { label: "Resellers", to: "/admin/resellers", icon: <Users className="h-4 w-4" /> },
  {
    label: "Agents",
    icon: <UserCheck className="h-4 w-4" />,
    items: [
      { label: "Commission Agents", to: "/admin/agents", icon: <UserCheck className="h-4 w-4" /> },
      { label: "Agent report", to: "/admin/agent-report", icon: <Target className="h-4 w-4" /> },
      { label: "Commission payout", to: "/admin/agent-payouts", icon: <Percent className="h-4 w-4" /> },

    ],
  },
  { label: "Store visitors", to: "/admin/visitors", icon: <Activity className="h-4 w-4" /> },
  {
    label: "Growth",
    icon: <Rocket className="h-4 w-4" />,
    items: [
      { label: "Marketing", to: "/admin/marketing", icon: <Megaphone className="h-4 w-4" /> },
      { label: "Notifications", to: "/admin/notifications", icon: <Bell className="h-4 w-4" /> },
      { label: "Reseller notices", to: "/admin/notices", icon: <Megaphone className="h-4 w-4" /> },
    ],
  },
  {
    label: "System",
    icon: <Cog className="h-4 w-4" />,
    items: [
      { label: "Landing page", to: "/admin/landing", icon: <FileText className="h-4 w-4" /> },
      { label: "Couriers", to: "/admin/couriers", icon: <Truck className="h-4 w-4" /> },
      { label: "Payment methods", to: "/admin/payments", icon: <Wallet className="h-4 w-4" /> },

      { label: "Staff & Permissions", to: "/admin/staff", icon: <Users className="h-4 w-4" /> },
      { label: "Custom domains", to: "/admin/domains", icon: <Globe className="h-4 w-4" /> },
      { label: "Cache & cleanup", to: "/admin/maintenance", icon: <Eraser className="h-4 w-4" /> },
      { label: "Advanced settings", to: "/admin/advanced", icon: <Sliders className="h-4 w-4" /> },

      { label: "Security deposit", to: "/admin/deposits", icon: <ShieldCheck className="h-4 w-4" /> },
      { label: "Privacy policy", to: "/admin/privacy", icon: <Shield className="h-4 w-4" /> },
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

/** First admin route this permission set can actually open (nav order). */
function firstAllowedRoute(nav: NavEntry[], permissions: string[]): string | null {
  for (const entry of nav) {
    const group = entry as { items?: { to?: string }[] };
    if (group.items) {
      for (const item of group.items) {
        if (item.to && allowed(item.to, permissions, false)) return item.to;
      }
      continue;
    }
    const to = (entry as { to?: string }).to;
    if (to && allowed(to, permissions, false)) return to;
  }
  return null;
}

function AdminLayout() {
  const { user, roles, permissions, loading } = useAuth();
  const nav = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const isSuperAdmin = roles.includes("super_admin");
  const isStaff = roles.includes("staff");
  const canEnter = isSuperAdmin || isStaff;
  const routePermission = Object.entries(ROUTE_PERMISSIONS)
    .sort(([a], [b]) => b.length - a.length)
    .find(([route]) => pathname === route || pathname.startsWith(`${route}/`))?.[1];
  const canViewRoute =
    isSuperAdmin ||
    (isStaff && routePermission != null && routePermission.some((permission) => permissions.includes(permission)));
  const landing = isSuperAdmin ? "/admin" : firstAllowedRoute(NAV, permissions);
  const [brand, setBrand] = useState<{ name: string; logoUrl: string | null; primary: string | null }>({
    name: "Admin",
    logoUrl: null,
    primary: null,
  });

  useEffect(() => {
    if (loading || !user) return;
    if (canEnter && canViewRoute) return;

    // Resellers never belong in the admin tree.
    if (!isSuperAdmin && !isStaff && (roles.includes("reseller") || roles.includes("leader"))) {
      nav({ to: "/reseller", replace: true });
      return;
    }
    // No admin access at all -> let the dashboard router decide.
    if (!canEnter) {
      nav({ to: "/dashboard", replace: true });
      return;
    }
    // Staff with permissions but not for THIS route: send them to the first
    // page they can open. Never bounce back to /admin or /dashboard, that
    // ping-pongs forever and shows an endless spinner.
    if (landing && landing !== pathname) {
      nav({ to: landing, replace: true });
    }
  }, [loading, user, canEnter, canViewRoute, roles, permissions, pathname, nav, isStaff, isSuperAdmin, landing]);

  useEffect(() => {
    let alive = true;
    void getGlobalSettings().then((data) => {
      if (!alive || !data) return;
      setBrand({
        name: data.site_name ?? "Admin",
        logoUrl: data.logo_url ?? null,
        primary: data.primary_color ?? null,
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  useBrandingTheme(brand.primary);

  // Staff account that has zero openable pages: show a message instead of a
  // spinner that never resolves.
  if (!loading && user && canEnter && !canViewRoute && !landing) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="surface-card max-w-sm p-8 text-center">
          <h1 className="text-lg font-semibold">No panel access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            আপনার অ্যাকাউন্টে এখনো কোনো পেজের পারমিশন দেওয়া হয়নি। সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            className="mt-6 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

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
      headerRight={<BulkScanButton compact />}
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
