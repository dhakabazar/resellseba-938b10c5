import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { Loader2, Wallet, TrendingUp, Clock, CheckCircle2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { useDepositStatus } from "@/lib/deposit";
import { DepositNotice } from "@/components/deposit-notice";
import { fillText, useDepositSettings } from "@/lib/deposit-settings";

export const Route = createFileRoute("/_authenticated/reseller/payouts")({
  component: PayoutsPage,
});

type Payout = { id: string; amount: number; status: string; method: string | null; notes: string | null; reference: string | null; created_at: string; paid_at: string | null };
type LedgerRow = {
  at: string;
  kind: "deposit" | "profit" | "payout" | string;
  direction: "in" | "out" | "void" | string;
  label: string;
  reference: string | null;
  status: string;
  amount: number;
  running: number;
};
type PayoutMethod = "bkash" | "nagad" | "rocket" | "bank";
type Profile = {
  payout_method: PayoutMethod | null;
  payout_account_name: string | null;
  payout_account_number: string | null;
  payout_bank_name: string | null;
  payout_branch: string | null;
  payout_routing: string | null;
};

const emptyProfile: Profile = {
  payout_method: null,
  payout_account_name: null,
  payout_account_number: null,
  payout_bank_name: null,
  payout_branch: null,
  payout_routing: null,
};

function PayoutsPage() {
  const { user } = useAuth();
  const [rid, setRid] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [sum, setSum] = useState({ delivered_profit: 0, pending_payout: 0, paid_out: 0, available: 0, deposit_balance: 0, frozen_amount: 0 });
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [rows, setRows] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const { status: deposit } = useDepositStatus(rid);
  const { texts: depositTexts } = useDepositSettings();

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    setLoading(true);
    const { data: r } = await supabase
      .from("resellers")
      .select("id,payout_method,payout_account_name,payout_account_number,payout_bank_name,payout_branch,payout_routing")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (!r) return setLoading(false);
    setRid(r.id);
    setProfile({
      payout_method: (r.payout_method as PayoutMethod) ?? null,
      payout_account_name: r.payout_account_name,
      payout_account_number: r.payout_account_number,
      payout_bank_name: r.payout_bank_name,
      payout_branch: r.payout_branch,
      payout_routing: r.payout_routing,
    });
    if (!r.payout_method) setEditing(true);
    const { data: s } = await supabase.rpc("reseller_profit_summary", { _reseller_id: r.id });
    const row = Array.isArray(s) ? s[0] : s;
    if (row) setSum({
      delivered_profit: Number(row.delivered_profit), pending_payout: Number(row.pending_payout),
      paid_out: Number(row.paid_out), available: Number(row.available),
    });
    const { data: p } = await supabase.from("payouts").select("*").eq("reseller_id", r.id).order("created_at", { ascending: false });
    setRows((p ?? []) as Payout[]);
    setLoading(false);
  }

  async function saveProfile() {
    if (!rid) return;
    if (!profile.payout_method) return toast.error("Select a method");
    if (!profile.payout_account_number) return toast.error("Enter account/mobile number");
    setBusy(true);
    const isBank = profile.payout_method === "bank";
    const { error } = await supabase.from("resellers").update({
      payout_method: profile.payout_method,
      payout_account_name: profile.payout_account_name,
      payout_account_number: profile.payout_account_number,
      payout_bank_name: isBank ? profile.payout_bank_name : null,
      payout_branch: isBank ? profile.payout_branch : null,
      payout_routing: isBank ? profile.payout_routing : null,
    }).eq("id", rid);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Payout information saved");
    setEditing(false);
    load();
  }

  const blockReason = !profile.payout_method
    ? "প্রথমে উপরে পেমেন্ট (পেআউট) ইনফরমেশন সেভ করুন।"
    : deposit.blocked
      ? "সিকিউরিটি ডিপোজিট বাকি থাকলে উইথড্র রিকোয়েস্ট দেওয়া যাবে না।"
      : sum.available <= 0
        ? sum.delivered_profit <= 0
          ? "এখনও কোনো ডেলিভার্ড অর্ডার নেই — ডেলিভারি হলে প্রফিট এখানে জমা হবে।"
          : "উইথড্র করার মতো ব্যালান্স নেই (আগের রিকোয়েস্ট/ফ্রিজ বাদ দিয়ে ০)।"
        : null;

  async function request(e: React.FormEvent) {
    e.preventDefault();
    if (!rid) return;
    if (blockReason) return toast.error(blockReason);
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("সঠিক অ্যামাউন্ট লিখুন");
    if (amt > sum.available)
      return toast.error(`সর্বোচ্চ ৳${sum.available.toLocaleString()} উইথড্র করা যাবে`);
    setBusy(true);

    const enumMethod = (profile.payout_method === "bank" ? "other" : profile.payout_method) as
      | "bkash" | "nagad" | "rocket" | "other";
    const ref = profile.payout_method === "bank"
      ? `${profile.payout_bank_name ?? ""} · ${profile.payout_account_number} · ${profile.payout_account_name ?? ""}`
      : `${profile.payout_account_number} · ${profile.payout_account_name ?? ""}`;
    const { error } = await supabase.from("payouts").insert({
      reseller_id: rid, amount: amt, method: enumMethod, reference: ref, status: "pending",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setAmount("");
    toast.success("Payout request submitted");
    load();
  }

  if (loading) return <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <PageHeader title="Payouts" description="Profit from delivered orders accumulates here. Request a withdrawal to your saved account." />

      <DepositNotice status={deposit} />

      {(deposit.required || deposit.frozenAmount > 0 || deposit.rows.length > 0) && (
        <div className="surface-card mb-6 p-5">
          <div className="mb-3 text-sm font-semibold">{depositTexts.sectionTitle}</div>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="জমা (Paid)" value={deposit.balance} />
            <MiniStat label="বাকি (Due)" value={deposit.due} tone={deposit.due > 0 ? "bad" : "good"} />
            <MiniStat label="প্রয়োজনীয়" value={deposit.requiredAmount} />
            <MiniStat label="ফ্রিজ" value={deposit.frozenAmount} />
          </div>

          <ul className="mb-3 space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
            <li>• {depositTexts.howToDeposit}</li>
            <li>• {depositTexts.withdrawWarning}</li>
          </ul>

          {deposit.rows.length > 0 && (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2">তারিখ</th>
                    <th>অ্যামাউন্ট</th>
                    <th>মেথড</th>
                    <th>রেফারেন্স</th>
                    <th>নোট</th>
                  </tr>
                </thead>
                <tbody>
                  {deposit.rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="font-medium">৳{Number(r.amount).toLocaleString()}</td>
                      <td className="capitalize">{r.method ?? "—"}</td>
                      <td className="text-muted-foreground">{r.reference ?? "—"}</td>
                      <td className="text-muted-foreground">{r.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Delivered profit" value={`৳${sum.delivered_profit.toLocaleString()}`} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Available" value={`৳${sum.available.toLocaleString()}`} hint="Ready to request" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Pending" value={`৳${sum.pending_payout.toLocaleString()}`} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Paid out" value={`৳${sum.paid_out.toLocaleString()}`} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <div className="surface-card mb-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Payout information</div>
            <p className="text-xs text-muted-foreground">Admin will send your profit to this account.</p>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>

        {!editing ? (
          profile.payout_method ? (
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <Info label="Method" value={<span className="capitalize">{profile.payout_method}</span>} />
              <Info label="Account name" value={profile.payout_account_name || "—"} />
              <Info label={profile.payout_method === "bank" ? "Account number" : "Mobile number"} value={profile.payout_account_number || "—"} />
              {profile.payout_method === "bank" && (
                <>
                  <Info label="Bank" value={profile.payout_bank_name || "—"} />
                  <Info label="Branch" value={profile.payout_branch || "—"} />
                  <Info label="Routing" value={profile.payout_routing || "—"} />
                </>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No payout information saved yet.</div>
          )
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">Method</label>
                <select
                  value={profile.payout_method ?? "bkash"}
                  onChange={(e) => setProfile({ ...profile, payout_method: e.target.value as PayoutMethod })}
                  className={inp}
                >
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Account holder name</label>
                <input
                  value={profile.payout_account_name ?? ""}
                  onChange={(e) => setProfile({ ...profile, payout_account_name: e.target.value })}
                  className={inp}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">
                  {profile.payout_method === "bank" ? "Account number" : "Mobile number"}
                </label>
                <input
                  value={profile.payout_account_number ?? ""}
                  onChange={(e) => setProfile({ ...profile, payout_account_number: e.target.value })}
                  className={inp}
                />
              </div>
              {profile.payout_method === "bank" && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Bank name</label>
                    <input
                      value={profile.payout_bank_name ?? ""}
                      onChange={(e) => setProfile({ ...profile, payout_bank_name: e.target.value })}
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Branch</label>
                    <input
                      value={profile.payout_branch ?? ""}
                      onChange={(e) => setProfile({ ...profile, payout_branch: e.target.value })}
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Routing number</label>
                    <input
                      value={profile.payout_routing ?? ""}
                      onChange={(e) => setProfile({ ...profile, payout_routing: e.target.value })}
                      className={inp}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2">
              {profile.payout_method && (
                <button onClick={() => { setEditing(false); load(); }} className="rounded-md border px-3 py-1.5 text-xs">Cancel</button>
              )}
              <button
                onClick={saveProfile}
                disabled={busy}
                className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
              </button>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={request} className="surface-card mb-6 grid gap-3 p-5 md:grid-cols-[1fr_auto]">
        <div>
          <label className="mb-1 block text-xs font-medium">Amount (৳)</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min={1}
            max={sum.available > 0 ? sum.available : undefined}
            className={inp}
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            উইথড্র করা যাবে সর্বোচ্চ <span className="font-semibold text-foreground">৳{sum.available.toLocaleString()}</span>
            {sum.pending_payout > 0 && <> · অনুরোধে আছে ৳{sum.pending_payout.toLocaleString()}</>}
          </p>
          {deposit.frozenAmount > 0 && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              {fillText(depositTexts.payoutFrozenHint, { frozen: deposit.frozenAmount })}
            </p>
          )}
          {blockReason ? (
            <p className="mt-1 text-xs font-medium text-destructive">{blockReason}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Payout <span className="capitalize font-medium">{profile.payout_method}</span> · {profile.payout_account_number}
            </p>
          )}
        </div>
        <div className="flex items-end">
          <button
            disabled={busy}
            className="btn-brand w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Sending…" : "Request payout"}
          </button>
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
                <td className="text-muted-foreground">{p.notes ?? p.reference}</td>
              </tr>
            ))}
            {rows.length === 0 && (<tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No payouts yet.</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
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

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={
          "text-sm font-bold " + (tone === "bad" ? "text-destructive" : tone === "good" ? "text-success" : "")
        }
      >
        ৳{Number(value ?? 0).toLocaleString()}
      </div>
    </div>
  );
}
