import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { ShoppingBag, TrendingUp, ClipboardList, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reseller/")({
  component: ResellerDashboard,
});

function ResellerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ listings: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: r } = await supabase
        .from("resellers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!r) return;
      const { count } = await supabase
        .from("reseller_listings")
        .select("*", { count: "exact", head: true })
        .eq("reseller_id", r.id);
      setStats({ listings: count ?? 0 });
    })();
  }, [user]);

  return (
    <div>
      <PageHeader
        title="Welcome back"
        description="Apnar store er quick overview — listing, orders, income."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active listings" value={stats.listings} icon={<ShoppingBag className="h-4 w-4" />} />
        <StatCard label="Orders (30d)" value={0} icon={<ClipboardList className="h-4 w-4" />} />
        <StatCard label="Gross profit" value="৳0" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Payout due" value="৳0" icon={<Wallet className="h-4 w-4" />} />
      </div>

      <div className="mt-8 surface-card p-6">
        <h3 className="text-sm font-semibold">Quick tips</h3>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• Catalog theke products browse kore listing add korun.</li>
          <li>• Nijer profit margin bosao — real-time e calculator dekhabe.</li>
          <li>• Store design e logo, color, tagline set korun.</li>
          <li>• Domain connect korle nijer brand-e customers ashbe.</li>
        </ul>
      </div>
    </div>
  );
}
