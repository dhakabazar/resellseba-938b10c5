import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getGlobalSettings } from "@/lib/app-data";
import { bdt } from "@/lib/finance-report";

/** Every deposit-related text is editable from Admin → System → Security deposit. */
export type DepositTexts = {
  sectionTitle: string;
  dueTitle: string;
  dueBody: string;
  okText: string;
  frozenText: string;
  howToDeposit: string;
  withdrawWarning: string;
  orderBlockToast: string;
  payoutFrozenHint: string;
};

export const DEFAULT_DEPOSIT_TEXTS: DepositTexts = {
  sectionTitle: "Security Deposit",
  dueTitle: "Security deposit due — {due}",
  dueBody:
    "A {required} security deposit is required to cover delivery charges if a delivery fails. Orders cannot be confirmed until the deposit is paid. Current balance: {balance}.",
  okText: "Deposit paid · {balance}",
  frozenText: "{frozen} frozen — this amount cannot be withdrawn",
  howToDeposit:
    "You cannot add the deposit yourself — send it via bKash/Nagad/Bank and share the TrxID with admin. Admin will verify and add it to your ledger.",
  withdrawWarning:
    "To withdraw your deposit or frozen amount you must contact admin first — taking this money back will close your reseller account and stop new orders.",
  orderBlockToast: "Security deposit due — {due}. Orders cannot be confirmed until the deposit is paid.",
  payoutFrozenHint: "{frozen} is frozen — this amount cannot be withdrawn.",
};

export type DepositDefaults = {
  triggerOn: boolean;
  amount: number;
  frozen: number;
};

export const DEFAULT_DEPOSIT_DEFAULTS: DepositDefaults = { triggerOn: false, amount: 0, frozen: 0 };

export function mergeTexts(raw: unknown): DepositTexts {
  const src = (raw ?? {}) as Partial<Record<keyof DepositTexts, unknown>>;
  const out = { ...DEFAULT_DEPOSIT_TEXTS };
  for (const key of Object.keys(DEFAULT_DEPOSIT_TEXTS) as (keyof DepositTexts)[]) {
    const v = src[key];
    if (typeof v === "string" && v.trim()) out[key] = v;
  }
  return out;
}

/** Fills {due} {required} {balance} {frozen} placeholders with formatted BDT amounts. */
export function fillText(
  template: string,
  vars: { due?: number; required?: number; balance?: number; frozen?: number },
) {
  return template.replace(/\{(due|required|balance|frozen)\}/g, (_m, key: keyof typeof vars) =>
    bdt(Number(vars[key] ?? 0)),
  );
}

export function useDepositSettings() {
  const [texts, setTexts] = useState<DepositTexts>(DEFAULT_DEPOSIT_TEXTS);
  const [defaults, setDefaults] = useState<DepositDefaults>(DEFAULT_DEPOSIT_DEFAULTS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await getGlobalSettings();
    const row = data as any;
    setTexts(mergeTexts(row?.deposit_texts));
    setDefaults({
      triggerOn: Boolean(row?.deposit_trigger_default_on),
      amount: Number(row?.deposit_default_amount ?? 0),
      frozen: Number(row?.deposit_default_frozen ?? 0),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { texts, defaults, loading, reload };
}
