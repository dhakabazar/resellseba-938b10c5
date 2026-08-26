import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BadgeCheck, Clock, Copy, Hand, Loader2, Send, XCircle, Zap } from "lucide-react";
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

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const bdt = (v: number) => `৳${Number(v || 0).toLocaleString("en-US")}`;

/** Reseller-facing: pay the security deposit with an admin-approved manual method. */
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
  const [configId, setConfigId] = useState("");
  const [amount, setAmount] = useState(due && due > 0 ? String(due) : "");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"manual" | "online">("manual");
  const [gateways, setGateways] = useState<{ provider: string; label: string }[]>([]);
  const [gateway, setGateway] = useState("");
  const [onlineAmount, setOnlineAmount] = useState(due && due > 0 ? String(due) : "");
  const loadGateways = useServerFn(listDepositGateways);
  const startOnline = useServerFn(startDepositPayment);

  useEffect(() => {
    void (async () => {
      const list = await fetchDepositMethods();
      setMethods(list);
      if (list[0]) setConfigId(list[0].id);
      setLoading(false);
      try {
        const gw = await loadGateways();
        setGateways(gw);
        if (gw[0]) setGateway(gw[0].provider);
        if (list.length === 0 && gw.length > 0) setMode("online");
      } catch {
        /* gateways unavailable */
      }
    })();
  }, [loadGateways]);

  async function payOnline() {
    const amt = Number(onlineAmount);
    if (!(amt > 0)) return toast.error("Enter a valid amount");
    if (!gateway) return toast.error("Select a gateway");
    setBusy(true);
    try {
      const res = await startOnline({ data: { provider: gateway, amount: amt } });
      if (res?.redirectUrl) window.location.href = res.redirectUrl;
      else toast.error("Could not start the payment");
    } catch (err: any) {
      toast.error(typeof err?.message === "string" ? err.message : "Could not start the payment");
    } finally {
      setBusy(false);
    }
  }

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

  const selected = methods.find((m) => m.id === configId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!resellerId) return;
    const amt = Number(amount);
    if (!(amt > 0)) return toast.error("Enter a valid amount");
    if (!selected) return toast.error("Select a payment method");
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
    setAmount("");
    setReference("");
    setNote("");
    toast.success("Deposit submitted — waiting for admin approval");
    void loadRequests();
    onSubmitted?.();
  }

  if (loading)
    return (
      <div className="grid place-items-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="space-y-4">
      {(methods.length > 0 || gateways.length > 0) && (
        <div className="inline-flex rounded-xl border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors " +
              (mode === "manual" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")
            }
          >
            <Hand className="h-3.5 w-3.5" /> Manual
          </button>
          <button
            type="button"
            onClick={() => setMode("online")}
            className={
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors " +
              (mode === "online" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")
            }
          >
            <Zap className="h-3.5 w-3.5" /> Automatic
          </button>
        </div>
      )}

      {mode === "online" ? (
        gateways.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
            No automatic gateway is enabled yet. Please use a manual method.
          </div>
        ) : (
          <div className="rounded-xl border p-4">
            <div className="mb-1 text-sm font-semibold">Pay online</div>
            <p className="mb-3 text-[11px] text-muted-foreground">
              You will be taken to the gateway. Once the payment is confirmed, the deposit is credited automatically —
              no admin approval needed.
            </p>
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              {gateways.map((g) => {
                const active = g.provider === gateway;
                return (
                  <button
                    type="button"
                    key={g.provider}
                    onClick={() => setGateway(g.provider)}
                    className={
                      "flex items-center justify-between gap-2 rounded-lg border p-3 text-left text-xs font-semibold transition-colors " +
                      (active ? "border-primary bg-primary/5" : "hover:bg-muted")
                    }
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <PaymentLogo method={g.provider} size={22} />
                      <span className="truncate">{g.label}</span>
                    </span>
                    {active && <BadgeCheck className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">Amount *</label>
                <input
                  value={onlineAmount}
                  onChange={(e) => setOnlineAmount(e.target.value)}
                  className={inp}
                  inputMode="decimal"
                  placeholder="5000"
                />
              </div>
              <div className="flex items-end justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void payOnline()}
                  className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Pay now
                </button>
              </div>
            </div>
          </div>
        )
      ) : methods.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
          No deposit payment method is enabled yet. Please contact support.
        </div>
      ) : (
        <form onSubmit={submit} className="rounded-xl border p-4">
          <div className="mb-3 text-sm font-semibold">Pay security deposit</div>

          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            {methods.map((m) => {
              const active = m.id === configId;
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setConfigId(m.id)}
                  className={
                    "rounded-lg border p-3 text-left text-xs transition-colors " +
                    (active ? "border-primary bg-primary/5" : "hover:bg-muted")
                  }
                >
                  <div className="flex items-center justify-between gap-2 font-semibold">
                    <span className="flex min-w-0 items-center gap-2">
                      <PaymentLogo method={m.method} size={22} />
                      <span className="truncate">{m.label}</span>
                    </span>
                    {active && <BadgeCheck className="h-4 w-4 text-primary" />}
                  </div>
                  {cfgString(m.config, "account") && (
                    <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                      <span className="tabular-nums">{cfgString(m.config, "account")}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          void navigator.clipboard.writeText(cfgString(m.config, "account"));
                          toast.success("Number copied");
                        }}
                        onKeyDown={() => {}}
                        className="rounded p-0.5 hover:bg-muted"
                      >
                        <Copy className="h-3 w-3" />
                      </span>
                      {cfgString(m.config, "account_type") && <span>· {cfgString(m.config, "account_type")}</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selected?.instructions && (
            <p className="mb-3 whitespace-pre-line rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
              {selected.instructions}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Amount *</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} inputMode="decimal" placeholder="5000" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">TrxID / reference *</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} className={inp} placeholder="8N7A2K9QX1" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Note</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className={inp} placeholder="Optional" />
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              disabled={busy}
              className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Submit deposit
            </button>
          </div>
        </form>
      )}

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
    pending: { cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: <Clock className="h-3 w-3" />, label: "Pending" },
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
