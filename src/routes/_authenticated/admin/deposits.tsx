import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw, ShieldCheck } from "lucide-react";
import {
  DEFAULT_DEPOSIT_TEXTS,
  mergeTexts,
  fillText,
  type DepositTexts,
} from "@/lib/deposit-settings";

export const Route = createFileRoute("/_authenticated/admin/deposits")({
  component: DepositSettingsPage,
  head: () => ({
    meta: [
      { title: "Security deposit rules · Admin" },
      { name: "description", content: "Reseller security deposit defaults, freeze amount and all reseller-facing deposit texts." },
      { property: "og:title", content: "Security deposit rules · Admin" },
      { property: "og:description", content: "Manage deposit defaults, freeze rules and dynamic notice texts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const FIELDS: { key: keyof DepositTexts; label: string; help: string; long?: boolean }[] = [
  { key: "sectionTitle", label: "Section title (reseller panel)", help: "No variable" },
  { key: "dueTitle", label: "Deposit due — notice title", help: "{due}" },
  { key: "dueBody", label: "Deposit due — notice body", help: "{required} {balance} {due}", long: true },
  { key: "okText", label: "Deposit paid — text", help: "{balance}" },
  { key: "frozenText", label: "Frozen amount — text", help: "{frozen}" },
  { key: "howToDeposit", label: "How to deposit — hint", help: "No variable", long: true },
  { key: "withdrawWarning", label: "Deposit/frozen withdraw warning", help: "No variable", long: true },
  { key: "orderBlockToast", label: "Order confirm block — toast", help: "{due}" },
  { key: "payoutFrozenHint", label: "Payout form — frozen hint", help: "{frozen}" },
];

function DepositSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [triggerOn, setTriggerOn] = useState(false);
  const [amount, setAmount] = useState("0");
  const [frozen, setFrozen] = useState("0");
  const [texts, setTexts] = useState<DepositTexts>(DEFAULT_DEPOSIT_TEXTS);

  const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("global_settings")
        .select("deposit_texts,deposit_trigger_default_on,deposit_default_amount,deposit_default_frozen")
        .eq("id", 1)
        .maybeSingle();
      if (error) toast.error(error.message);
      const row = data as any;
      setTriggerOn(Boolean(row?.deposit_trigger_default_on));
      setAmount(String(row?.deposit_default_amount ?? 0));
      setFrozen(String(row?.deposit_default_frozen ?? 0));
      setTexts(mergeTexts(row?.deposit_texts));
      setLoading(false);
    })();
  }, []);

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("global_settings")
      .update({
        deposit_trigger_default_on: triggerOn,
        deposit_default_amount: Number(amount) || 0,
        deposit_default_frozen: Number(frozen) || 0,
        deposit_texts: texts as any,
      } as any)
      .eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Deposit settings saved");
  }

  if (loading)
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const preview = {
    due: Math.max((Number(amount) || 0) - 0, 0),
    required: Number(amount) || 0,
    balance: 0,
    frozen: Number(frozen) || 0,
  };

  return (
    <div>
      <PageHeader
        title="Security deposit"
        description="Configure the deposit trigger, default amounts, and all reseller-facing hints and notification texts from here."
        actions={
          <button
            onClick={save}
            disabled={busy}
            className="btn-brand inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card space-y-3 p-6">
          <h3 className="text-sm font-semibold">Default rule (new reseller)</h3>
          <p className="text-xs text-muted-foreground">
            New resellers will get these values on signup — you can override each reseller later from their “Deposit &amp; freeze” modal.
          </p>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border bg-muted/30 p-3">
            <input
              type="checkbox"
              checked={triggerOn}
              onChange={(e) => setTriggerOn(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span className="text-xs">
              <span className="block font-medium">Enable deposit trigger by default</span>
              <span className="text-muted-foreground">If off, new resellers can work without a deposit.</span>
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Default deposit amount (৳)</label>
              <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Default freeze amount (৳)</label>
              <input type="number" min={0} value={frozen} onChange={(e) => setFrozen(e.target.value)} className={inp} />
            </div>
          </div>
        </div>

        <div className="surface-card space-y-3 p-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" /> Live preview
          </h3>
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <div className="font-bold text-amber-700 dark:text-amber-300">{fillText(texts.dueTitle, preview)}</div>
            <p className="mt-1 text-amber-700/80 dark:text-amber-200/80">{fillText(texts.dueBody, preview)}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-xs">
            <div className="font-medium text-success">{fillText(texts.okText, { balance: preview.required })}</div>
            <div className="mt-1 text-muted-foreground">{fillText(texts.frozenText, preview)}</div>
          </div>
          <ul className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
            <li>• {texts.howToDeposit}</li>
            <li>• {texts.withdrawWarning}</li>
          </ul>
        </div>

        <div className="surface-card space-y-4 p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Reseller-facing text (dynamic)</h3>
              <p className="text-xs text-muted-foreground">
                Use <code>{"{due}"}</code>, <code>{"{required}"}</code>, <code>{"{balance}"}</code>,{" "}
                <code>{"{frozen}"}</code> and the matching amount will be inserted automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTexts(DEFAULT_DEPOSIT_TEXTS)}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset to default
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.long ? "md:col-span-2" : undefined}>
                <label className="mb-1 flex items-center justify-between text-xs font-medium">
                  <span>{f.label}</span>
                  <span className="font-normal text-muted-foreground">{f.help}</span>
                </label>
                {f.long ? (
                  <textarea
                    rows={3}
                    value={texts[f.key]}
                    onChange={(e) => setTexts({ ...texts, [f.key]: e.target.value })}
                    className={inp}
                  />
                ) : (
                  <input
                    value={texts[f.key]}
                    onChange={(e) => setTexts({ ...texts, [f.key]: e.target.value })}
                    className={inp}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={busy}
              className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
