import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyReseller } from "@/lib/app-data";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { CustomersReport } from "@/components/customers-report";

export const Route = createFileRoute("/_authenticated/reseller/customers")({
  component: ResellerCustomersPage,
});

function ResellerCustomersPage() {
  const { user } = useAuth();
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      <PageHeader title="My customers" description="Your own buyers only — order history, value and quick contact." />
      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !resellerId ? (
        <EmptyState title="No store yet" description="Your store is not ready, so there are no customers yet." />
      ) : (
        <CustomersReport resellerId={resellerId} />
      )}
    </div>
  );
}
