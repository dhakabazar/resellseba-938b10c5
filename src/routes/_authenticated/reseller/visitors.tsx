import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyReseller } from "@/lib/app-data";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Loader2 } from "lucide-react";
import { RangeTabs, StoreVisitsReport } from "@/components/store-visits-report";
import type { VisitRange } from "@/lib/store-visits";

export const Route = createFileRoute("/_authenticated/reseller/visitors")({
  component: ResellerVisitorsPage,
});

function ResellerVisitorsPage() {
  const { user } = useAuth();
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<VisitRange>("today");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const data = await getMyReseller(user.id);
      setResellerId(data?.id ?? null);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div>
      <PageHeader
        title="Store visitors"
        description="Live traffic on your storefront — pageviews, unique visitors and top pages."
      />
      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !resellerId ? (
        <EmptyState title="No store yet" description="Your store is not ready, so there is no traffic to show." />
      ) : (
        <StoreVisitsReport
          resellerId={resellerId}
          range={range}
          extraHeader={<RangeTabs value={range} onChange={setRange} />}
        />
      )}
    </div>
  );
}
