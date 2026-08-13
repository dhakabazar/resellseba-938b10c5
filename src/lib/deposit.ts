import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DepositRow = {
  id: string;
  amount: number;
  method: string | null;
  reference: string | null;
  note: string | null;
  created_at: string;
};

export type DepositStatus = {
  required: boolean;
  requiredAmount: number;
  frozenAmount: number;
  balance: number;
  due: number;
  /** true when the deposit rule is on and not yet fulfilled */
  blocked: boolean;
  rows: DepositRow[];
};

export const emptyDepositStatus: DepositStatus = {
  required: false,
  requiredAmount: 0,
  frozenAmount: 0,
  balance: 0,
  due: 0,
  blocked: false,
  rows: [],
};

export function buildDepositStatus(
  reseller: { deposit_required?: boolean | null; deposit_required_amount?: number | null; frozen_amount?: number | null } | null,
  rows: DepositRow[],
): DepositStatus {
  const requiredAmount = Number(reseller?.deposit_required_amount ?? 0);
  const required = Boolean(reseller?.deposit_required) && requiredAmount > 0;
  const balance = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const due = required ? Math.max(requiredAmount - balance, 0) : 0;
  return {
    required,
    requiredAmount,
    frozenAmount: Number(reseller?.frozen_amount ?? 0),
    balance,
    due,
    blocked: required && due > 0,
    rows,
  };
}

/** Loads the deposit rule + ledger for one reseller (own row for resellers, any row for admins). */
export function useDepositStatus(resellerId: string | null | undefined) {
  const [status, setStatus] = useState<DepositStatus>(emptyDepositStatus);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!resellerId) return;
    setLoading(true);
    const [rRes, dRes] = await Promise.all([
      supabase
        .from("resellers")
        .select("deposit_required,deposit_required_amount,frozen_amount")
        .eq("id", resellerId)
        .maybeSingle(),
      supabase
        .from("reseller_deposits")
        .select("id,amount,method,reference,note,created_at")
        .eq("reseller_id", resellerId)
        .order("created_at", { ascending: false }),
    ]);
    setStatus(buildDepositStatus(rRes.data as any, (dRes.data ?? []) as DepositRow[]));
    setLoading(false);
  }, [resellerId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { status, loading, reload };
}
