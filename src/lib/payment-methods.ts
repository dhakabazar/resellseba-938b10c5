/**
 * Shared payment-method catalog.
 *
 * Two families, deliberately kept apart everywhere in the UI:
 * - manual  → mobile wallet / bank / cash. Customer (or reseller) sends money
 *             and types a TrxID; a human verifies it.
 * - api     → automatic gateways that confirm the payment themselves.
 *
 * Extra per-method options live in `payment_configs.config`:
 *   account        — the wallet/bank number shown to the payer
 *   account_type   — "Personal" / "Agent" / "Merchant" …
 *   allow_deposit  — reseller may use this method to pay the security deposit
 */
import { supabase } from "@/integrations/supabase/client";

export type PaymentMode = "manual" | "api";

export type PaymentMethodMeta = {
  value: string;
  label: string;
  mode: PaymentMode;
  hint: string;
};

export const MANUAL_METHODS: PaymentMethodMeta[] = [
  { value: "bkash", label: "bKash", mode: "manual", hint: "Send Money / Cash Out number" },
  { value: "nagad", label: "Nagad", mode: "manual", hint: "Send Money number" },
  { value: "rocket", label: "Rocket", mode: "manual", hint: "Send Money number" },
  { value: "other", label: "Bank / Cash / Other", mode: "manual", hint: "Bank account or cash handover" },
];

export function methodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  const found = MANUAL_METHODS.find((m) => m.value === method);
  return found?.label ?? method;
}

export type PaymentConfigRow = {
  id: string;
  method: string;
  label: string;
  mode: PaymentMode;
  is_active: boolean;
  instructions: string | null;
  config: Record<string, unknown> | null;
};

export const cfgString = (config: PaymentConfigRow["config"], key: string): string => {
  const v = config?.[key];
  return typeof v === "string" ? v : "";
};

export const cfgBool = (config: PaymentConfigRow["config"], key: string): boolean => Boolean(config?.[key]);

/**
 * Active manual methods a reseller may use to pay the security deposit.
 * Every active manual method qualifies — no separate toggle needed.
 */
export async function fetchDepositMethods(): Promise<PaymentConfigRow[]> {
  const { data } = await supabase
    .from("payment_configs")
    .select("id,method,label,mode,is_active,instructions,config")
    .is("reseller_id", null)
    .eq("is_active", true)
    .order("created_at");
  return ((data ?? []) as unknown as PaymentConfigRow[]).filter((r) => r.mode === "manual");
}


