import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { methodLabel } from "@/lib/payment-methods";
import { StatusChip } from "@/components/deposit-pay-panel";
import { confirmAction } from "@/lib/confirm";

type Row = {
  id: string;
  reseller_id: string;
  amount: number;
  method: string | null;
  reference: string | null;
  note: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  resellers?: { code: string; business_name: string } | null;
};

const bdt = (v: number) => `৳${Number(v || 0).toLocaleString("en-US")}`;

/** Admin review queue for reseller-submitted security deposits. */
export function DepositRequestsAdmin({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [tab]);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("deposit_requests")
      .select("id,reseller_id,amount,method,reference,note,status,admin_note,created_at,resellers(code,business_name)")
      .order("created_at", { ascending: false })
      ;
    if (tab === "pending") q = q.eq("status", "pending");
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }

  async function review(row: Row, approve: boolean) {
    const ok = await confirmAction({
      title: approve ? "Approve deposit" : "Reject & delete",
      description: approve
        ? `${bdt(row.amount)} will be added to ${row.resellers?.business_name ?? "this reseller"}'s deposit balance.`
        : `This ${bdt(row.amount)} submission will be removed everywhere. No balance change.`,
      confirmText: approve ? "Approve" : "Reject & delete",
    });
    if (!ok) return;
    setBusyId(row.id);
    const { error } = await supabase.rpc("deposit_request_review", { _id: row.id, _approve: approve });
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Deposit approved" : "Submission deleted");

    void load();
    onChanged?.();
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {(["pending", "all"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors " +
              (tab === k ? "border-transparent bg-primary text-primary-foreground" : "hover:bg-muted")
            }
          >
            {k}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
          {tab === "pending" ? "No deposit awaiting approval." : "No deposit submission yet."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left uppercase text-muted-foreground">
              <tr>
                <th className="p-2">Date</th>
                <th>Reseller</th>
                <th>Amount</th>
                <th>Method</th>
                <th>TrxID</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="font-medium">{r.resellers?.business_name ?? "—"}</div>
                    <div className="text-muted-foreground">{r.resellers?.code ?? ""}</div>
                  </td>
                  <td className="font-semibold tabular-nums">{bdt(r.amount)}</td>
                  <td>{methodLabel(r.method)}</td>
                  <td className="text-muted-foreground">
                    {r.reference ?? "—"}
                    {r.note && <div>{r.note}</div>}
                  </td>
                  <td>
                    <StatusChip status={r.status} />
                  </td>
                  <td className="p-2 text-right">
                    {r.status === "pending" ? (
                      <div className="inline-flex gap-1.5">
                        <button
                          disabled={busyId === r.id}
                          onClick={() => review(r, true)}
                          className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-1 font-semibold text-success hover:bg-success/25 disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" /> Approve
                        </button>
                        <button
                          disabled={busyId === r.id}
                          onClick={() => review(r, false)}
                          className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50"
                        >
                          <X className="h-3 w-3" /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
