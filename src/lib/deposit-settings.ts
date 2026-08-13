import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  sectionTitle: "সিকিউরিটি ডিপোজিট",
  dueTitle: "সিকিউরিটি ডিপোজিট বাকি — {due}",
  dueBody:
    "ডেলিভারি ফেইল হলে ডেলিভারি চার্জ কাভার করার জন্য {required} ডিপোজিট রাখতে হয়। ডিপোজিট না করা পর্যন্ত অর্ডার Confirmed করা যাবে না। জমা আছে {balance}।",
  okText: "ডিপোজিট সম্পন্ন · {balance}",
  frozenText: "{frozen} ফ্রিজ করা — এই অ্যামাউন্ট উইথড্র করা যাবে না",
  howToDeposit:
    "ডিপোজিট নিজে থেকে অ্যাড করা যায় না — bKash/Nagad/Bank-এ পাঠিয়ে admin কে TrxID সহ জানান, admin ভেরিফাই করে লেজারে যোগ করবেন।",
  withdrawWarning:
    "ডিপোজিট বা ফ্রিজ করা অ্যামাউন্ট উইথড্র করতে চাইলে আগে admin কে জানাতে হবে — এই অ্যামাউন্ট ফেরত নিলে আপনার reseller অ্যাকাউন্ট বন্ধ হয়ে যাবে এবং নতুন অর্ডার নেওয়া যাবে না।",
  orderBlockToast: "সিকিউরিটি ডিপোজিট বাকি — {due}। ডিপোজিট জমা না দিলে অর্ডার কনফার্ম করা যাবে না।",
  payoutFrozenHint: "{frozen} ফ্রিজ করা আছে — এই অ্যামাউন্ট উইথড্র করা যাবে না।",
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
    const { data } = await supabase
      .from("global_settings")
      .select("deposit_texts,deposit_trigger_default_on,deposit_default_amount,deposit_default_frozen")
      .eq("id", 1)
      .maybeSingle();
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
