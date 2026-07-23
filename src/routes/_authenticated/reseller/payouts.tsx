import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { Loader2, Wallet, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reseller/payouts")({
  component: PayoutsPage,
});

type Payout = { id: string; amount: number; status: string; method: string; note: string | null; created_at: string; paid_at: string | null };

function PayoutsPage() {
  const { user } = useAuth();
  const [rid, setRid] = useState<string | null>(null);
  const [sum, setSum] = useState({ delivered_profit: 0, pending_payout: 0, paid_out: 0, available: 0 });
  const [rows, setRows] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bkash");
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    setLoading(true);
    const { data: r } = await supabase.from("resellers").select("id").eq("user_id", user!.id).maybeSingle();
    if (!r) return setLoading(false);
    setRid(r.id);
    const { data: s } = await supabase.rpc("reseller_profit_summary", { _reseller_id: r.id });
    const row = Array.isArray(s) ? s[0] : s;
    if (row) setSum({
      delivered_profit: Number(row.delivered_profit), pending_payout: Number(row.pending_payout),
      paid_out: Number(row.paid_out), available: Number(row.available),
    });
    const { data: p } = await supabase.from("payouts").select("*").eq("reseller_id", r.id).order("created_at", { ascending: false });
    setRows((p ?? []) as any);
    setLoading(false);
  }

  async function request(e: React.FormEvent) {
    e.preventDefault();
    if (!rid) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Invalid amount");
    if (amt > sum.available) return toast.error("Amount available balance er cheye beshi");
    setBusy(true);
    const { error } = await supabase.from("payouts").insert({
      reseller_id: rid, amount: amt, method, account_details: account, status: "pending",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setAmount(""); setAccount("");
    toast.success("Payout request submitted");
    load();
  }

  if (loading) return <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <PageHeader title="Payouts" description="Delivered order er profit ekhane jomma hoy. Request diye admin theke withdraw korte parben." />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Delivered profit" value={`৳${sum.delivered_profit.toLocaleString()}`} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Available" value={`৳${sum.available.toLocaleString()}`} hint="Ready to request" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Pending" value={`৳${sum.pending_payout.toLocaleString()}`} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Paid out" value={`৳${sum.paid_out.toLocaleString()}`} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <form onSubmit={request} className="surface-card mb-6 grid gap-3 p-5 md:grid-cols-[1fr_1fr_2fr_auto]">
        <div>
          <label className="mb-1 block text-xs font-medium">Amount (৳)</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={1} max={sum.available} className={inp} required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inp}>
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
            <option value="rocket">Rocket</option>
            <option value="bank">Bank</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Account (number / IBAN)</label>
          <input value={account} onChange={(e) => setAccount(e.target.value)} className={inp} required />
        </div>
        <div className="flex items-end">
          <button disabled={busy || sum.available <= 0} className="btn-brand w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">Request payout</button>
        </div>
      </form>

      <div className="surface-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Date</th><th>Amount</th><th>Method</th><th>Status</th><th>Note</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="font-medium">৳{Number(p.amount).toLocaleString()}</td>
                <td className="capitalize">{p.method}</td>
                <td><span className={"rounded-full px-2 py-0.5 text-[10px] " + statusStyle(p.status)}>{p.status}</span></td>
                <td className="text-muted-foreground">{p.note}</td>
              </tr>
            ))}
            {rows.length === 0 && (<tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No payouts yet.</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function statusStyle(s: string) {
  return s === "paid" ? "bg-success/20 text-success"
    : s === "approved" ? "bg-primary/15 text-primary"
    : s === "rejected" ? "bg-destructive/20 text-destructive"
    : "bg-warning/20 text-warning-foreground";
}
const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
