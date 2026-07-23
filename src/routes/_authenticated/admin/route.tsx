import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
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
  Percent,
  Award,
  ScrollText,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const NAV = [
  { label: "Dashboard", to: "/admin", icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { label: "Products", to: "/admin/products", icon: <Package className="h-4 w-4" /> },
  { label: "Brands", to: "/admin/brands", icon: <Tag className="h-4 w-4" /> },
  { label: "Categories", to: "/admin/categories", icon: <FolderTree className="h-4 w-4" /> },
  { label: "Orders", to: "/admin/orders", icon: <ShoppingCart className="h-4 w-4" /> },
  { label: "Delivery rules", to: "/admin/delivery", icon: <Percent className="h-4 w-4" /> },
  { label: "Resellers", to: "/admin/resellers", icon: <Users className="h-4 w-4" /> },
  { label: "Couriers", to: "/admin/couriers", icon: <Truck className="h-4 w-4" /> },
  { label: "Payments", to: "/admin/payments", icon: <Wallet className="h-4 w-4" /> },
  { label: "Payouts", to: "/admin/payouts", icon: <Wallet className="h-4 w-4" /> },
  { label: "Commissions", to: "/admin/commissions", icon: <Award className="h-4 w-4" /> },
  { label: "Marketing", to: "/admin/marketing", icon: <Megaphone className="h-4 w-4" /> },
  { label: "Audit log", to: "/admin/audit", icon: <ScrollText className="h-4 w-4" /> },
  { label: "Settings", to: "/admin/settings", icon: <Settings className="h-4 w-4" /> },
];

function AdminLayout() {
  const { user, roles, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!roles.includes("super_admin")) nav({ to: "/dashboard", replace: true });
  }, [loading, roles, nav]);

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
      brand={{ name: "ResellHub", sub: "Admin panel" }}
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
