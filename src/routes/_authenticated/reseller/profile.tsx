import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyReseller } from "@/lib/app-data";
import { getPanelBootstrapPayload } from "@/lib/panel-bootstrap";
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
      // One call: reseller row + leader name + money summary + order count.
      // Verification state is already carried by the panel bootstrap.
      const mine = await getMyReseller(user.id);
      const { data: ov } = mine
        ? await supabase.rpc("reseller_account_overview" as never, { _reseller_id: mine.id, _with_history: false } as never)
        : { data: null };
      const o = (ov ?? null) as any;
      const r = o?.reseller;
      if (!r) {
        setLoading(false);
        return;
      }
      const primedVerify = getPanelBootstrapPayload()?.verify as any;
      const vs = primedVerify ?? (await supabase.rpc("verify_state")).data;
      const v = Array.isArray(vs) ? (vs as any[])[0] : (vs as any);

      setData({
        ...r,
        commission_rate: Number(r.commission_rate),
        deposit_required_amount: Number(r.deposit_required_amount),
        frozen_amount: Number(r.frozen_amount),
        leader_name: o.leader_name ?? null,
        email: user.email ?? null,
        email_verified: Boolean(v?.email_verified_at),
        phone_verified: Boolean(v?.phone_verified_at),
      });

      const row = o.summary;
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
      const countRes = { count: Number(o.orders ?? 0) };
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
