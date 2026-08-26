import { useEffect, useState } from "react";
import { Loader2, Plus, ShieldCheck, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppModal } from "@/components/ui-kit/AppModal";
import { confirmAction } from "@/lib/confirm";
import {
  MANUAL_METHODS,
  cfgBool,
  cfgString,
  methodLabel,
  type PaymentConfigRow,
} from "@/lib/payment-methods";
import { Label, StatusDot, Switch, field } from "./shared";
import { PaymentLogo, paymentLogo } from "./payment-brand";

/**
 * Manual (human verified) payment methods: wallet / bank / cash.
 * Cards give the at-a-glance state, all editing happens in one modal.
 */

type Draft = PaymentConfigRow & { config: Record<string, unknown> };

const emptyDraft = (): Draft => ({
  id: "",
  method: MANUAL_METHODS[0]!.value,
  label: "",
  mode: "manual",
  is_active: true,
  instructions: null,
  config: { account: "", account_type: "", allow_deposit: false },
});

export function ManualMethods({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const [rows, setRows] = useState<PaymentConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("payment_configs")
      .select("id,method,label,mode,is_active,instructions,config")
      .is("reseller_id", null)
      .eq("mode", "manual")
      .order("created_at");
    if (error) toast.error(error.message);
    const list = (data ?? []) as unknown as PaymentConfigRow[];
    setRows(list);
    onCountChange?.(list.length);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(row: PaymentConfigRow, is_active: boolean) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active } : r)));
    const { error } = await supabase.from("payment_configs").update({ is_active }).eq("id", row.id);
    if (error) {
      toast.error(error.message);
      void load();
    }
  }

  async function remove(row: PaymentConfigRow) {
    const ok = await confirmAction({
      title: "Delete payment method",
      description: `"${row.label}" will be removed from checkout and from reseller deposit options.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    const { error } = await supabase.from("payment_configs").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    void load();
  }

  if (loading)
    return (
      <div className="grid place-items-center py-14">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3">
        <p className="max-w-[62ch] text-[11px] leading-relaxed text-muted-foreground">
          The customer sends money to your number and types the transaction ID. Mark a method as{" "}
          <strong>deposit friendly</strong> to let resellers pay their security deposit with it — those payments wait for
          your approval in Finance → Deposit transactions.
        </p>
        <button
          type="button"
          onClick={() => setDraft(emptyDraft())}
          className="btn-brand inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5" /> Add method
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Wallet className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-semibold">No manual method yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Add bKash, Nagad, Rocket or a bank account.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <div key={row.id} className="surface-card flex flex-col p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border bg-background p-1">
                  {paymentLogo(row.method) ? (
                    <PaymentLogo method={row.method} size={32} alt={`${methodLabel(row.method)} logo`} />
                  ) : (
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{row.label}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <StatusDot on={row.is_active} />
                    {methodLabel(row.method)} · {row.is_active ? "active" : "off"}
                  </div>
                </div>
                <Switch
                  checked={row.is_active}
                  onChange={(v) => void toggle(row, v)}
                  label={`Toggle ${row.label}`}
                />
              </div>

              <dl className="mt-3 space-y-1 text-[11px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Account</dt>
                  <dd className="truncate font-medium">{cfgString(row.config, "account") || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="truncate font-medium">{cfgString(row.config, "account_type") || "—"}</dd>
                </div>
              </dl>

              {cfgBool(row.config, "allow_deposit") && (
                <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                  <ShieldCheck className="h-3 w-3" /> Deposit friendly
                </span>
              )}

              <div className="mt-auto flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setDraft({ ...row, config: (row.config ?? {}) as Record<string, unknown> })}
                  className="flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void remove(row)}
                  className="rounded-lg border p-2 text-destructive hover:bg-destructive/10"
                  aria-label={`Delete ${row.label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <MethodModal
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function MethodModal({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [row, setRow] = useState<Draft>(draft);
  const [busy, setBusy] = useState(false);
  const setConfig = (key: string, value: unknown) => setRow((r) => ({ ...r, config: { ...r.config, [key]: value } }));
  const meta = MANUAL_METHODS.find((m) => m.value === row.method);

  async function save() {
    if (!row.label.trim()) return toast.error("Display label is required");
    setBusy(true);
    const payload = {
      method: row.method as never,
      label: row.label.trim(),
      mode: "manual" as const,
      is_active: row.is_active,
      instructions: row.instructions?.trim() || null,
      config: row.config as never,
    };
    const { error } = row.id
      ? await supabase.from("payment_configs").update(payload).eq("id", row.id)
      : await supabase.from("payment_configs").insert({ ...payload, reseller_id: null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(row.id ? "Saved" : "Payment method added");
    onSaved();
  }

  return (
    <AppModal
      title={row.id ? row.label || "Edit method" : "Add manual method"}
      subtitle="Wallet, bank or cash — verified by your team."
      size="md"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-xs font-semibold hover:bg-muted">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="btn-brand inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label required>Provider</Label>
          <select
            value={row.method}
            onChange={(e) => setRow((r) => ({ ...r, method: e.target.value }))}
            className={field}
          >
            {MANUAL_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          {meta && <p className="mt-1 text-[10px] text-muted-foreground">{meta.hint}</p>}
        </div>
        <div>
          <Label required>Display label</Label>
          <input
            value={row.label}
            onChange={(e) => setRow((r) => ({ ...r, label: e.target.value }))}
            className={field}
            placeholder={`${meta?.label ?? "bKash"} Personal`}
          />
        </div>
        <div>
          <Label>Account / number</Label>
          <input
            value={cfgString(row.config, "account")}
            onChange={(e) => setConfig("account", e.target.value)}
            className={field}
            placeholder="01700000000"
          />
        </div>
        <div>
          <Label>Account type</Label>
          <input
            value={cfgString(row.config, "account_type")}
            onChange={(e) => setConfig("account_type", e.target.value)}
            className={field}
            placeholder="Personal / Agent / Merchant"
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Payment instructions</Label>
          <textarea
            rows={4}
            value={row.instructions ?? ""}
            onChange={(e) => setRow((r) => ({ ...r, instructions: e.target.value }))}
            className={field}
            placeholder="Send Money to 01700XXXXXXX (Personal). Use the order number as reference, then paste the TrxID."
          />
        </div>




        <label className="flex items-center justify-between gap-3 rounded-xl border p-3 sm:col-span-2">
          <span>
            <span className="block text-xs font-semibold">Show at checkout</span>
            <span className="text-[11px] text-muted-foreground">Turn off to hide without deleting.</span>
          </span>
          <Switch
            checked={row.is_active}
            onChange={(v) => setRow((r) => ({ ...r, is_active: v }))}
            label="Show at checkout"
          />
        </label>
      </div>
    </AppModal>
  );
}
