import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { clearAppDataCache } from "@/lib/app-data";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import {
  ResellerProfile,
  type ResellerProfileData,
  type ResellerProfileSummary,
} from "@/components/ResellerProfile";
import { ResellerAccountForm } from "@/components/reseller-account-form";

export const Route = createFileRoute("/_authenticated/reseller/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Reseller panel" },
      { name: "description", content: "Your reseller ID, account details, payout information and finance snapshot." },
      { property: "og:title", content: "My Profile — Reseller panel" },
      { property: "og:description", content: "Your reseller ID, account details and finance snapshot." },
    ],
  }),
  component: ResellerProfilePage,
});

function ResellerProfilePage() {
  const { user } = useAuth();
  const [data, setData] = useState<ResellerProfileData | null>(null);
  const [summary, setSummary] = useState<ResellerProfileSummary>(null);
  const [orders, setOrders] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: r } = await supabase
        .from("resellers")
        .select(
          "id,code,avatar_url,business_name,status,contact_phone,address,nid_number,commission_rate,leader_id,notes,created_at,approved_at,payout_method,payout_account_name,payout_account_number,payout_bank_name,payout_branch,payout_routing,deposit_required,deposit_required_amount,frozen_amount",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (!r) {
        setLoading(false);
        return;
      }

      let leaderName: string | null = null;
      if (r.leader_id) {
        const { data: l } = await supabase
          .from("resellers")
          .select("business_name,code")
          .eq("id", r.leader_id)
          .maybeSingle();
        if (l) leaderName = `${l.business_name} (#${l.code})`;
      }

      setData({
        ...r,
        commission_rate: Number(r.commission_rate),
        deposit_required_amount: Number(r.deposit_required_amount),
        frozen_amount: Number(r.frozen_amount),
        leader_name: leaderName,
        email: user.email ?? null,
      });

      const [sumRes, countRes] = await Promise.all([
        supabase.rpc("reseller_profit_summary", { _reseller_id: r.id }),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("reseller_id", r.id),
      ]);
      const row = Array.isArray(sumRes.data) ? sumRes.data[0] : sumRes.data;
      if (row) {
        setSummary({
          delivered_profit: Number(row.delivered_profit),
          pending_payout: Number(row.pending_payout),
          paid_out: Number(row.paid_out),
          available: Number(row.available),
          deposit_balance: Number(row.deposit_balance),
          frozen_amount: Number(row.frozen_amount),
        });
      }
      setOrders(countRes.count ?? 0);
      setLoading(false);
    })();
  }, [user, reload]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="My profile"
        description="Your unique reseller ID and full account information."
      />
      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? (
        <EmptyState title="Profile not found" description="No reseller account is linked to this login." />
      ) : (
        <>
          <ResellerAccountForm
            reseller={{
              id: data.id,
              business_name: data.business_name,
              contact_phone: data.contact_phone,
              address: data.address,
              nid_number: data.nid_number ?? null,
              avatar_url: data.avatar_url ?? null,
            }}
            email={data.email ?? null}
            onSaved={() => {
              clearAppDataCache();
              setReload((n) => n + 1);
            }}
          />
          <ResellerProfile reseller={data} summary={summary} orders={orders} />
        </>
      )}
    </div>
  );
}
