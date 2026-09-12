import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { canAccessResellerPanel } from "@/lib/reseller-status";

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
  GraduationCap,
  Loader2,
  ExternalLink,
  Store,
  Rocket,
  TrendingUp,
  Headphones,
  UserCircle,
  ListTree,
  CreditCard,
  Crown,
  UserCog,



} from "lucide-react";
import { AppShell, type NavEntry } from "@/components/AppShell";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { useAuth } from "@/lib/use-auth";
import { useVerification } from "@/lib/use-verification";
import { useBrandingTheme } from "@/lib/branding";
import { getGlobalSettings, getMyReseller } from "@/lib/app-data";
import { getPanelBootstrapPayload } from "@/lib/panel-bootstrap";
import { consumeImpersonationReturnTarget } from "@/lib/impersonation";
import { SubscriptionGate } from "@/components/subscription-lock";
import { RESELLER_ROUTE_PERMISSION, useResellerAccess } from "@/lib/reseller-staff";

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
      { label: "Transactions", to: "/reseller/transactions", icon: <TrendingUp className="h-4 w-4" /> },
      { label: "Payouts", to: "/reseller/payouts", icon: <Wallet className="h-4 w-4" /> },
      { label: "Leader commissions", to: "/reseller/commissions", icon: <Award className="h-4 w-4" /> },
    ],
  },
  {
    label: "Growth",
    icon: <Rocket className="h-4 w-4" />,
    items: [
      { label: "Marketing", to: "/reseller/marketing", icon: <Megaphone className="h-4 w-4" /> },
      { label: "Video tutorials", to: "/tutorials", icon: <GraduationCap className="h-4 w-4" />, external: true },
    ],
  },
  {
    label: "Store",
    icon: <Store className="h-4 w-4" />,
    items: [
      { label: "General settings", to: "/reseller/settings", icon: <Store className="h-4 w-4" /> },
      { label: "Payment methods", to: "/reseller/payments", icon: <CreditCard className="h-4 w-4" /> },
      { label: "Theme", to: "/reseller/theme", icon: <Palette className="h-4 w-4" /> },
      { label: "Header menu", to: "/reseller/menus", icon: <ListTree className="h-4 w-4" /> },
      { label: "Domain", to: "/reseller/domain", icon: <Globe className="h-4 w-4" /> },

      { label: "Visitors", to: "/reseller/visitors", icon: <Activity className="h-4 w-4" /> },
    ],
  },
  { label: "My staff", to: "/reseller/staff", icon: <UserCog className="h-4 w-4" />, ownerOnly: true } as NavEntry,
  { label: "My package", to: "/reseller/subscription", icon: <Crown className="h-4 w-4" /> },
  { label: "My profile", to: "/reseller/profile", icon: <UserCircle className="h-4 w-4" /> },
  { label: "Support", to: "/reseller/support", icon: <Headphones className="h-4 w-4" /> },
];

/** Hides menu entries a reseller staff account has no permission for. */
function filterNav(nav: NavEntry[], isOwner: boolean, can: (key?: string) => boolean): NavEntry[] {
  const keep = (entry: any) => {
    if (entry.ownerOnly) return isOwner;
    if (entry.external) return true;
    return can(RESELLER_ROUTE_PERMISSION[entry.to as string]);
  };
  const out: NavEntry[] = [];
  for (const entry of nav) {
    const group = entry as { items?: any[] };
    if (group.items) {
      const items = group.items.filter(keep);
      if (items.length) out.push({ ...(entry as any), items } as NavEntry);
      continue;
    }
    if (keep(entry)) out.push(entry);
  }
  return out;
}



function ResellerLayout() {
  const { user, roles, loading } = useAuth();
  const { required: needsVerify, loading: verifyLoading } = useVerification();
  const nav = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  const { isOwner, isStaff, staff, can } = useResellerAccess();
  const [storeName, setStoreName] = useState("My store");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [storeCode, setStoreCode] = useState<string | null>(null);
  const [primary, setPrimary] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [approved, setApproved] = useState<boolean | null>(null);

  const menu = filterNav(NAV, isOwner, can);
  const firstAllowed = (() => {
    for (const e of menu) {
      const g = e as { items?: { to?: string }[] };
      if (g.items) {
        const hit = g.items.find((i) => i.to?.startsWith("/reseller"));
        if (hit?.to) return hit.to;
        continue;
      }
      const to = (e as { to?: string }).to;
      if (to?.startsWith("/reseller")) return to;
    }
    return null;
  })();

  // Reseller staff may only open the menus their owner allowed.
  useEffect(() => {
    if (!isStaff || loading) return;
    if (pathname === "/reseller/staff") {
      nav({ to: (firstAllowed ?? "/reseller") as never, replace: true });
      return;
    }
    const needed = RESELLER_ROUTE_PERMISSION[pathname];
    if (needed && !can(needed) && firstAllowed && firstAllowed !== pathname) {
      nav({ to: firstAllowed as never, replace: true });
    }
  }, [isStaff, loading, pathname, can, firstAllowed, nav]);


  useEffect(() => {
    if (loading || verifyLoading || !user) return;
    if (needsVerify) {
      nav({ to: "/verify", replace: true });
      return;
    }
    if (roles.includes("super_admin") || roles.includes("staff")) {
      nav({ to: (consumeImpersonationReturnTarget() ?? "/admin") as never, replace: true });
      return;
    }
    if (approved === null) return;
    if (approved === false) {
      nav({ to: "/onboarding", replace: true });
    }
  }, [approved, loading, roles, nav, needsVerify, verifyLoading, user]);

  useEffect(() => {
    if (approved === false) nav({ to: "/onboarding", replace: true });
  }, [approved, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [g, r] = await Promise.all([getGlobalSettings(), getMyReseller(user.id)]);
      let logo = g?.logo_url ?? null;
      let color = g?.primary_color ?? null;

      if (r) {
        setApproved(canAccessResellerPanel(r.status));

        setStoreName(r.business_name);
        setStoreCode(r.code);
        setAvatarUrl(r.avatar_url ?? null);
        // Store branding rides along with the panel bootstrap.
        const s = getPanelBootstrapPayload()?.reseller_settings ?? null;
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
    verifyLoading ||
    approved !== true
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
        name: storeName || (user.user_metadata?.full_name ?? "Reseller"),
        email: user.email ?? "",
        avatarUrl,
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
      <ImpersonationBanner />
      <SubscriptionGate>
        <Outlet />
      </SubscriptionGate>
    </AppShell>
  );
}
