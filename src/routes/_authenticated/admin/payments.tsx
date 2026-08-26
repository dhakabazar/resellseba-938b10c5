import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import {
  BadgeCheck,
  Banknote,
  Hand,
  Loader2,
  Plug,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import {
  MANUAL_METHODS,
  cfgBool,
  cfgString,
  methodLabel,
  type PaymentConfigRow,
  type PaymentMode,
} from "@/lib/payment-methods";
import { GatewayAdmin } from "@/components/payments/gateway-admin";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: PaymentsPage,
  head: () => ({
    meta: [
      { title: "Payment methods · Admin" },
      {
        name: "description",
        content:
          "Manage manual wallet methods (bKash, Nagad, Rocket, bank) and automatic gateway integrations used at checkout and for reseller security deposits.",
      },
      { property: "og:title", content: "Payment methods · Admin" },
      {
        property: "og:description",
        content: "Manual wallets and automatic gateways, organised in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function PaymentsPage() {
  const [rows, setRows] = useState<PaymentConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<PaymentMode>("manual");
  const [activeGateways, setActiveGateways] = useState(0);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_configs")
      .select("id,method,label,mode,is_active,instructions,config")
      .is("reseller_id", null)
      .order("created_at");
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as PaymentConfigRow[]);
    setLoading(false);
  }

  const manual = useMemo(() => rows.filter((r) => r.mode === "manual"), [rows]);

  function patch(id: string, next: Partial<PaymentConfigRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }

  async function save(row: PaymentConfigRow) {
    const { error } = await supabase
      .from("payment_configs")
      .update({
        label: row.label,
        is_active: row.is_active,
        instructions: row.instructions,
        config: (row.config ?? {}) as never,
      })
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else toast.success(`${row.label} saved`);
  }

  async function remove(row: PaymentConfigRow) {
    if (
      !(await confirmAction({
        title: "Delete payment method",
        description: `"${row.label}" will be permanently removed from checkout and deposit options.`,
        confirmText: "Delete",
      }))
    )
      return;
    const { error } = await supabase.from("payment_configs").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    void load();
  }

  if (loading)
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );


  return (
    <div>
      <PageHeader
        title="Payment methods"
        description="Manual wallets are verified by hand (bKash, Nagad, Rocket, bank, cash). Automatic gateways confirm payments through their own API. Reseller payouts are managed separately."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <TabButton
          active={tab === "manual"}
          onClick={() => setTab("manual")}
          icon={<Hand className="h-3.5 w-3.5" />}
          label="Manual methods"
          count={manual.length}
        />
        <TabButton
          active={tab === "api"}
          onClick={() => setTab("api")}
          icon={<Plug className="h-3.5 w-3.5" />}
          label="Automatic (API)"
          count={activeGateways}
        />
      </div>

      <div
        className={
          "mb-5 rounded-xl border p-3 text-[11px] leading-relaxed " +
          (tab === "manual"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-primary/30 bg-primary/5 text-primary")
        }
      >
        {tab === "manual"
          ? "Customer sends money to your number and types the TrxID. Turn on “Reseller security deposit” to let resellers pay their deposit with that method — the payment then needs your approval in Finance → Deposit transactions."
          : "Every supported gateway is listed below. Fill in the credentials you have and switch the gateway on — inactive gateways never appear at checkout. Keys are stored server-side only."}
      </div>

      {tab === "manual" ? (
        <>
          <AddMethodForm mode="manual" onAdded={load} />
          <div className="grid gap-4">
            {manual.map((row) => (
              <MethodCard
                key={row.id}
                row={row}
                onPatch={(next) => patch(row.id, next)}
                onSave={() => save(row)}
                onDelete={() => remove(row)}
              />
            ))}
            {manual.length === 0 && (
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                No manual method yet — add bKash, Nagad, Rocket or a bank account above.
              </div>
            )}
          </div>
        </>
      ) : (
        <GatewayAdmin onCountChange={setActiveGateways} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors " +
        (active ? "border-transparent bg-primary text-primary-foreground" : "hover:bg-muted")
      }
    >
      {icon} {label}
      <span className={"rounded-full px-1.5 text-[10px] " + (active ? "bg-primary-foreground/20" : "bg-muted")}>
        {count}
      </span>
    </button>
  );
}

function AddMethodForm({ mode, onAdded }: { mode: PaymentMode; onAdded: () => void }) {
  const manualOptions = MANUAL_METHODS;
  const firstKey = manualOptions[0]!.value;
  const [choice, setChoice] = useState(firstKey);
  const [label, setLabel] = useState("");
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setChoice(manualOptions[0]!.value);
    setLabel("");
    setAccount("");
  }, [mode]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("payment_configs").insert({
      method: choice as never,
      label: label.trim(),
      mode,
      is_active: true,
      instructions: null,
      config: { account: account.trim(), allow_deposit: false } as never,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setLabel("");
    setAccount("");
    toast.success("Payment method added");
    onAdded();
  }

  return (
    <form onSubmit={add} className="surface-card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="mb-1 block text-xs font-medium">Provider</label>
        <select value={choice} onChange={(e) => setChoice(e.target.value)} className={inp}>
          {manualOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {manualOptions.find((m) => m.value === choice)?.hint}
        </p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Display label *</label>
        <input
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={inp}
          placeholder="bKash Personal"
        />
      </div>
      {mode === "manual" && (
        <div>
          <label className="mb-1 block text-xs font-medium">Account / number</label>
          <input value={account} onChange={(e) => setAccount(e.target.value)} className={inp} placeholder="01700000000" />
        </div>
      )}
      <div className="flex items-end">
        <button
          disabled={busy}
          className="btn-brand inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add method
        </button>
      </div>
    </form>
  );
}

function MethodCard({
  row,
  onPatch,
  onSave,
  onDelete,
}: {
  row: PaymentConfigRow;
  onPatch: (next: Partial<PaymentConfigRow>) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const config = row.config ?? {};
  const setConfig = (key: string, value: unknown) => onPatch({ config: { ...config, [key]: value } });

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/30 px-4 py-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400"
        >
          <Banknote className="h-4 w-4" />
        </span>
        <div className="min-w-[180px] flex-1">
          <input
            value={row.label}
            onChange={(e) => onPatch({ label: e.target.value })}
            className="w-full rounded-md border bg-background px-2 py-1 text-sm font-semibold"
          />
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>{methodLabel(row.method)}</span>
            <span>·</span>
            <span>manual</span>
            {cfgBool(config, "allow_deposit") && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-1.5 py-0.5 normal-case text-success">
                <ShieldCheck className="h-3 w-3" /> Deposit enabled
              </span>
            )}
          </div>
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs font-medium">
          <input type="checkbox" checked={row.is_active} onChange={(e) => onPatch({ is_active: e.target.checked })} />
          Active
        </label>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md border p-1.5 text-destructive hover:bg-destructive/10"
          aria-label="Delete method"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2">
        <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">Account / number</label>
                <input
                  value={cfgString(config, "account")}
                  onChange={(e) => setConfig("account", e.target.value)}
                  className={inp}
                  placeholder="01700000000"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Account type</label>
                <input
                  value={cfgString(config, "account_type")}
                  onChange={(e) => setConfig("account_type", e.target.value)}
                  className={inp}
                  placeholder="Personal / Agent / Merchant"
                />
              </div>
              <label className="flex items-start gap-2 rounded-lg border p-2.5 text-[11px] sm:col-span-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={cfgBool(config, "allow_deposit")}
                  onChange={(e) => setConfig("allow_deposit", e.target.checked)}
                />
                <span>
                  <span className="flex items-center gap-1 text-xs font-semibold">
                    <BadgeCheck className="h-3.5 w-3.5 text-success" /> Reseller security deposit
                  </span>
                  <span className="text-muted-foreground">
                    Resellers can pay their security deposit with this method and submit the TrxID for approval.
                  </span>
                </span>
              </label>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Payment instructions</label>
              <textarea
                rows={5}
                className={inp}
                value={row.instructions ?? ""}
                onChange={(e) => onPatch({ instructions: e.target.value })}
                placeholder="Send Money to 01700XXXXXXX (Personal). Use the order number as reference, then paste the TrxID."
              />
            </div>
        </>
      </div>

      <div className="flex justify-end border-t bg-muted/20 px-4 py-2.5">
        <button onClick={onSave} className="btn-brand rounded-md px-4 py-1.5 text-xs font-semibold">
          Save changes
        </button>
      </div>
    </div>
  );
}
