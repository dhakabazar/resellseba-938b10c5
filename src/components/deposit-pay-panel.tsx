import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BadgeCheck, Clock, Copy, Loader2, Send, XCircle, Zap } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listDepositGateways, startDepositPayment } from "@/lib/gateways.functions";
import { cfgString, fetchDepositMethods, type PaymentConfigRow } from "@/lib/payment-methods";
import { PaymentLogo } from "@/components/payments/payment-brand";

type RequestRow = {
  id: string;
  amount: number;
  method: string | null;
  payment_config_id: string | null;
  reference: string | null;
  note: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
};

/** One unified selectable row — manual wallet OR automatic gateway. */
type UnifiedMethod = {
  id: string;
  label: string;
  kind: "manual" | "online";
  method: string;
  account?: string;
  accountType?: string;
  instructions?: string | null;
};

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const bdt = (v: number) => `৳${Number(v || 0).toLocaleString("en-US")}`;

/** Reseller-facing: pay the security deposit with any active method. */
export function DepositPayPanel({
  resellerId,
  due,
  onSubmitted,
}: {
  resellerId: string | null;
  /** Outstanding deposit, used to prefill the amount fields. */
  due?: number;
  onSubmitted?: () => void;
}) {
  const [methods, setMethods] = useState<PaymentConfigRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [amount, setAmount] = useState(due && due > 0 ? String(due) : "");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gateways, setGateways] = useState<{ provider: string; label: string }[]>([]);
  const loadGateways = useServerFn(listDepositGateways);
  const startOnline = useServerFn(startDepositPayment);

  useEffect(() => {
    void (async () => {
      // Manual wallets and automatic gateways live in two tables — load both.
      const [list, gw] = await Promise.all([
        fetchDepositMethods(),
        supabase.rpc("get_active_payment_gateways"),
      ]);
      setMethods(list);
      setGateways(
        (gw.data ?? []).map((g) => ({
          provider: g.provider,
          label: g.label || gatewayLabel(g.provider),
        })),
      );
      setLoading(false);
    })();
  }, []);


  /** Unified, deduplicated list — manual first, then online gateways. */
  const unified = useMemo<UnifiedMethod[]>(() => {
    const manual: UnifiedMethod[] = methods.map((m) => ({
      id: m.id,
      label: m.label,
      kind: "manual",
      method: m.method,
      account: cfgString(m.config, "account") || undefined,
      accountType: cfgString(m.config, "account_type") || undefined,
      instructions: m.instructions,
    }));
    const online: UnifiedMethod[] = gateways.map((g) => ({
      id: `gw:${g.provider}`,
      label: g.label,
      kind: "online",
      method: g.provider,
    }));
    return [...manual, ...online];
  }, [methods, gateways]);

  // Auto-select the first available method once the list loads.
  useEffect(() => {
    if (!selectedId && unified.length > 0) setSelectedId(unified[0]!.id);
  }, [unified, selectedId]);

  const selected = unified.find((m) => m.id === selectedId) ?? null;

  useEffect(() => {
    if (resellerId) void loadRequests();
  }, [resellerId]);

  async function loadRequests() {
    const { data } = await supabase
      .from("deposit_requests")
      .select("id,amount,method,payment_config_id,reference,note,status,admin_note,created_at")
      .eq("reseller_id", resellerId!)
      .order("created_at", { ascending: false })
      .limit(30);
    setRequests((data ?? []) as RequestRow[]);
  }

  async function payOnline() {
    const amt = Number(amount);
    if (!(amt > 0)) return toast.error("Enter a valid amount");
    if (!selected || selected.kind !== "online") return toast.error("Select a payment method");
    const provider = selected.id.replace(/^gw:/, "");
    setBusy(true);
    try {
      const res = await startOnline({ data: { provider, amount: amt } });
      if (res?.redirectUrl) window.location.href = res.redirectUrl;
      else toast.error("Could not start the payment");
    } catch (err: any) {
      toast.error(typeof err?.message === "string" ? err.message : "Could not start the payment");
    } finally {
      setBusy(false);
    }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!resellerId) return;
    const amt = Number(amount);
    if (!(amt > 0)) return toast.error("Enter a valid amount");
    if (!selected || selected.kind !== "manual") return toast.error("Select a payment method");
    if (!reference.trim()) return toast.error("Transaction ID (TrxID) is required");
    setBusy(true);
    const { error } = await supabase.from("deposit_requests").insert({
      reseller_id: resellerId,
      amount: amt,
      method: selected.method,
      payment_config_id: selected.id,
      reference: reference.trim(),
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setReference("");
    setNote("");
    toast.success("Deposit submitted — waiting for admin verification");
    void loadRequests();
    onSubmitted?.();
  }

  if (loading)
    return (
      <div className="grid place-items-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  if (unified.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
        No payment method is active yet. Please contact support.
      </div>
    );
  }

  return (
    <div className="space-y-4">


      {/* Unified method grid — manual + automatic together */}
      <div className="grid gap-2 sm:grid-cols-2">
        {unified.map((m) => {
          const active = m.id === selectedId;
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={
                "rounded-xl border p-3 text-left transition-colors " +
                (active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:bg-muted")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border bg-background p-1">
                    <PaymentLogo method={m.method} size={24} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{m.label}</span>
                    <span
                      className={
                        "inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide " +
                        (m.kind === "online" ? "text-primary" : "text-muted-foreground")
                      }
                    >
                      {m.kind === "online" ? (
                        <>
                          <Zap className="h-3 w-3" /> Automatic
                        </>
                      ) : (
                        "Manual"
                      )}
                    </span>
                  </span>
                </span>
                {active && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
              </div>

              {m.account && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">{m.account}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      void navigator.clipboard.writeText(m.account!);
                      toast.success("Number copied");
                    }}
                    onKeyDown={() => {}}
                    className="rounded p-0.5 hover:bg-muted"
                  >
                    <Copy className="h-3 w-3" />
                  </span>
                  {m.accountType && <span>· {m.accountType}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>




      {/* Amount is shared */}
      <div className="rounded-xl border p-4">
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Amount *</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inp}
              inputMode="decimal"
              placeholder="5000"
            />
          </div>

          {selected?.kind === "manual" ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium">TrxID / reference *</label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className={inp}
                  placeholder="8N7A2K9QX1"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Note</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} className={inp} placeholder="Optional" />
              </div>
            </>
          ) : (
            <div className="flex items-end justify-end sm:col-span-2">
              <p className="text-[11px] text-muted-foreground">
                You'll be taken to the gateway. The deposit is credited automatically once payment is confirmed — no
                admin approval needed.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          {selected?.kind === "manual" ? (
            <button
              type="button"
              disabled={busy}
              onClick={(e) => void submitManual(e as unknown as React.FormEvent)}
              className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Submit deposit
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void payOnline()}
              className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Pay now
            </button>
          )}
        </div>
      </div>

      {requests.length > 0 && (
        <div className="rounded-xl border">
          <div className="border-b bg-muted/30 px-4 py-2 text-xs font-semibold">My deposit submissions</div>
          <div className="divide-y">
            {requests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-xs">
                <span className="font-semibold tabular-nums">{bdt(r.amount)}</span>
                <span className="text-muted-foreground">{r.reference ?? "—"}</span>
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                <span className="ml-auto">
                  <StatusChip status={r.status} />
                </span>
                {r.admin_note && <div className="w-full text-muted-foreground">Admin: {r.admin_note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    pending: { cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: <Clock className="h-3 w-3" />, label: "Pending verification" },
    approved: { cls: "bg-success/15 text-success", icon: <BadgeCheck className="h-3 w-3" />, label: "Approved" },
    rejected: { cls: "bg-destructive/15 text-destructive", icon: <XCircle className="h-3 w-3" />, label: "Rejected" },
  };
  const it = map[status] ?? map.pending!;
  return (
    <span className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold " + it.cls}>
      {it.icon} {it.label}
    </span>
  );
}
