import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { Loader2, Wallet, TrendingUp, Clock, CheckCircle2, Pencil, Save, ShieldCheck, History, Banknote } from "lucide-react";
import { toast } from "sonner";
import { useDepositStatus } from "@/lib/deposit";
import { DepositNotice } from "@/components/deposit-notice";
import { fillText, useDepositSettings } from "@/lib/deposit-settings";
import { LedgerTimeline, type LedgerRow } from "@/components/ledger-timeline";

export const Route = createFileRoute("/_authenticated/reseller/payouts")({
  component: PayoutsPage,
});

type Payout = { id: string; amount: number; status: string; method: string | null; notes: string | null; reference: string | null; created_at: string; paid_at: string | null };
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

type TabKey = "deposit" | "payout" | "timeline";

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
  const [tab, setTab] = useState<TabKey>("payout");
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
      deposit_balance: Number((row as any).deposit_balance ?? 0),
      frozen_amount: Number((row as any).frozen_amount ?? 0),
    });
    const { data: p } = await supabase.from("payouts").select("*").eq("reseller_id", r.id).order("created_at", { ascending: false });
    setRows((p ?? []) as Payout[]);
    const { data: lg } = await supabase.rpc("reseller_ledger", { _reseller_id: r.id, _limit: 200 } as any);
    setLedger(((lg ?? []) as any[]).map((x) => ({ ...x, amount: Number(x.amount), running: Number(x.running) })) as LedgerRow[]);
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
    ? "Save your payout information first."
    : deposit.blocked
      ? "Withdrawal is not allowed while a security deposit is due."
      : sum.available <= 0
        ? sum.delivered_profit <= 0
          ? "No delivered orders yet — profit will appear here once orders are delivered."
          : "No withdrawable balance (previous requests / frozen amount deducted)."
        : null;

  async function request(e: React.FormEvent) {
    e.preventDefault();
    if (!rid) return;
    if (blockReason) return toast.error(blockReason);
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (amt > sum.available)
      return toast.error(`Maximum withdrawable amount is ৳${sum.available.toLocaleString()}`);
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

  const showDepositTab = deposit.required || deposit.frozenAmount > 0 || deposit.rows.length > 0;
  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    ...(showDepositTab ? [{ key: "deposit" as TabKey, label: "Security deposit", icon: <ShieldCheck className="h-3.5 w-3.5" /> }] : []),
    { key: "payout", label: "Payout", icon: <Banknote className="h-3.5 w-3.5" /> },
    { key: "timeline", label: "Timeline", icon: <History className="h-3.5 w-3.5" /> },
  ];

  return (
    <div>
      <PageHeader title="Payouts" description="Profit from delivered orders accumulates here. Request a withdrawal to your saved account." />

      <DepositNotice status={deposit} />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Delivered profit" value={`৳${sum.delivered_profit.toLocaleString()}`} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Deposit balance" value={`৳${sum.deposit_balance.toLocaleString()}`} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Frozen" value={`৳${sum.frozen_amount.toLocaleString()}`} hint="Not withdrawable" icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Available" value={`৳${sum.available.toLocaleString()}`} hint="Ready to request" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Pending" value={`৳${sum.pending_payout.toLocaleString()}`} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Paid out" value={`৳${sum.paid_out.toLocaleString()}`} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors " +
              (tab === t.key ? "border-transparent bg-primary text-primary-foreground" : "hover:bg-muted")
            }
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "deposit" && showDepositTab && (
        <div className="surface-card p-4 sm:p-5">
          <div className="mb-3 text-sm font-semibold">{depositTexts.sectionTitle}</div>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Paid" value={deposit.balance} />
            <MiniStat label="Due" value={deposit.due} tone={deposit.due > 0 ? "bad" : "good"} />
            <MiniStat label="Required" value={deposit.requiredAmount} />
            <MiniStat label="Frozen" value={deposit.frozenAmount} />
          </div>

          <ul className="mb-3 space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
            <li>• {depositTexts.howToDeposit}</li>
            <li>• {depositTexts.withdrawWarning}</li>
          </ul>

          {deposit.rows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">No deposit records yet.</div>
          ) : (
            <div className="space-y-2 sm:hidden">
              {deposit.rows.map((r) => (
                <div key={r.id} className="rounded-md border p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold tabular-nums">৳{Number(r.amount).toLocaleString()}</span>
                    <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-1 capitalize text-muted-foreground">{r.method ?? "—"} · {r.reference ?? "—"}</div>
                  {r.note && <div className="mt-1 text-muted-foreground">{r.note}</div>}
                </div>
              ))}
            </div>
          )}

          {deposit.rows.length > 0 && (
            <div className="hidden overflow-hidden rounded-md border sm:block">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2">Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Note</th>
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

      {tab === "payout" && (
        <>
          <p className="mb-4 rounded-lg border bg-muted/30 px-4 py-2 text-[11px] leading-relaxed text-muted-foreground">
            Calculation: delivered profit (৳{sum.delivered_profit.toLocaleString()}) + deposit (৳{sum.deposit_balance.toLocaleString()}) − requested/paid (৳{(sum.pending_payout + sum.paid_out).toLocaleString()}) − frozen (৳{sum.frozen_amount.toLocaleString()}) = <span className="font-bold text-foreground">৳{sum.available.toLocaleString()}</span> withdrawable. Deposit above the frozen amount is also withdrawable.
          </p>

          <div className="surface-card mb-6 p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
                <div className="grid gap-2 text-sm sm:grid-cols-2">
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
                <div className="grid gap-3 sm:grid-cols-2">
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

          <form onSubmit={request} className="surface-card mb-6 grid gap-3 p-4 sm:p-5 md:grid-cols-[1fr_auto]">
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
                Maximum withdrawable <span className="font-semibold text-foreground">৳{sum.available.toLocaleString()}</span>
                {sum.pending_payout > 0 && <> · in request ৳{sum.pending_payout.toLocaleString()}</>}
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

          {/* Payout history — mobile cards */}
          <div className="space-y-2 md:hidden">
            {rows.length === 0 ? (
              <div className="surface-card p-8 text-center text-sm text-muted-foreground">No payouts yet.</div>
            ) : rows.map((p) => (
              <div key={p.id} className="surface-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold tabular-nums">৳{Number(p.amount).toLocaleString()}</div>
                    <div className="text-[11px] capitalize text-muted-foreground">{p.method} · {new Date(p.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={"rounded-full px-2 py-0.5 text-[10px] capitalize " + statusStyle(p.status)}>{p.status}</span>
                </div>
                {p.notes && (
                  <p className="mt-2 rounded-md border border-dashed p-2 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">Admin note:</span> {p.notes}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="surface-card hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Date</th><th className="p-3">Amount</th><th className="p-3">Method</th><th className="p-3">Status</th><th className="p-3">Admin note</th></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="p-3 font-medium tabular-nums">৳{Number(p.amount).toLocaleString()}</td>
                    <td className="p-3 capitalize">{p.method}</td>
                    <td className="p-3"><span className={"rounded-full px-2 py-0.5 text-[10px] capitalize " + statusStyle(p.status)}>{p.status}</span></td>
                    <td className="p-3 text-xs text-muted-foreground">{p.notes || p.reference || "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (<tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No payouts yet.</td></tr>)}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "timeline" && (
        <div className="surface-card p-4 sm:p-5">
          <div className="mb-1 text-sm font-semibold">Money timeline (Ledger)</div>
          <p className="mb-4 text-xs text-muted-foreground">How money comes in (deposit + delivered profit) and how it goes out (withdrawals) — all in one place.</p>
          <LedgerTimeline ledger={ledger} frozen={sum.frozen_amount} available={sum.available} />
        </div>
      )}
    </div>
  );
}

function LedgerTotals({
  ledger,
  frozen,
  available,
  className = "",
}: {
  ledger: LedgerRow[];
  frozen: number;
  available: number;
  className?: string;
}) {
  const inflow = ledger.filter((e) => e.direction === "in").reduce((s, e) => s + Number(e.amount), 0);
  const outflow = ledger.filter((e) => e.direction === "out").reduce((s, e) => s + Number(e.amount), 0);
  const balance = inflow - outflow;
  return (
    <div className={"grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-5 " + className}>
      <TotalCell label="Total in" value={inflow} tone="good" />
      <TotalCell label="Total out" value={outflow} tone="bad" />
      <TotalCell label="Balance" value={balance} />
      <TotalCell label="Frozen" value={frozen} />
      <TotalCell label="Withdrawable" value={available} tone="good" />
    </div>
  );
}

function TotalCell({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={
          "text-sm font-bold tabular-nums " +
          (tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "")
        }
      >
        ৳{Number(value || 0).toLocaleString()}
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
