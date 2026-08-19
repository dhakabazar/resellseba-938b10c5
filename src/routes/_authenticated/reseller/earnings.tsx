import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { TransactionReport } from "@/components/transaction-report";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reseller/earnings")({
  component: EarningsPage,
  head: () => ({
    meta: [
      { title: "Transaction report — Reseller earnings" },
      {
        name: "description",
        content: "Every order settlement, security deposit and withdraw of your store in one running-balance report.",
      },
      { property: "og:title", content: "Transaction report — Reseller earnings" },
      { property: "og:description", content: "Order profit, loss, deposits and withdrawals with running balance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function EarningsPage() {
  const { user } = useAuth();
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("resellers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setResellerId(data?.id ?? null);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !resellerId ? (
        <div className="surface-card p-8 text-center text-xs text-muted-foreground">No reseller account found.</div>
      ) : (
        <TransactionReport resellerId={resellerId} />
      )}
    </div>
  );
}
