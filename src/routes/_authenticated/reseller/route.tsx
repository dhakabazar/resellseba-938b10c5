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
  { label: "Store design", to: "/reseller/design", icon: <Palette className="h-4 w-4" /> },
  { label: "Domain", to: "/reseller/domain", icon: <Globe className="h-4 w-4" /> },
];

function ResellerLayout() {
  const { user, roles, loading } = useAuth();
  const nav = useNavigate();
  const [storeName, setStoreName] = useState("My store");

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
    supabase
      .from("resellers")
      .select("business_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => data && setStoreName(data.business_name));
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
      brand={{ name: storeName, sub: "Reseller" }}
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
