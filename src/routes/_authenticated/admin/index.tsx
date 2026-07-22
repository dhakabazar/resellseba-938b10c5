import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { Package, Users, ShoppingCart, Tag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [stats, setStats] = useState({
    products: 0,
    resellers: 0,
    pendingResellers: 0,
    brands: 0,
  });

  useEffect(() => {
    (async () => {
      const [p, r, pr, b] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("resellers").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("resellers").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("brands").select("*", { count: "exact", head: true }),
      ]);
      setStats({
        products: p.count ?? 0,
        resellers: r.count ?? 0,
        pendingResellers: pr.count ?? 0,
        brands: b.count ?? 0,
      });
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Ekhane apnar business er overall picture dekhben."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total products" value={stats.products} icon={<Package className="h-4 w-4" />} />
        <StatCard label="Active resellers" value={stats.resellers} icon={<Users className="h-4 w-4" />} />
        <StatCard
          label="Pending applications"
          value={stats.pendingResellers}
          hint="Review korte hobe"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard label="Brands" value={stats.brands} icon={<Tag className="h-4 w-4" />} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="h-4 w-4 text-primary" /> Recent orders
          </div>
          <p className="text-sm text-muted-foreground">
            Order module Phase 3 e implement hobe. Reseller-forwarded orders ekhane
            asbe.
          </p>
        </div>
        <div className="surface-card p-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" /> Growth
          </div>
          <p className="text-sm text-muted-foreground">
            Analytics chart Phase 5 e add hobe (per-reseller commission, due,
            payout).
          </p>
        </div>
      </div>
    </div>
  );
}
