import { Link } from "@tanstack/react-router";
import { AlertTriangle, Lock, ShieldCheck, Wallet } from "lucide-react";
import { bdt } from "@/lib/finance-report";
import type { DepositStatus } from "@/lib/deposit";
import { fillText, useDepositSettings } from "@/lib/deposit-settings";

/** Reseller-side banner: shows the pending security deposit, or a calm "all clear" line. */
export function DepositNotice({
  status,
  compact,
  place = "payouts",
}: {
  status: DepositStatus;
  compact?: boolean;
  /** dashboard = only the "deposit due" warning; payouts = full info (done + frozen). */
  place?: "dashboard" | "payouts";
}) {
  const { texts } = useDepositSettings();
  if (!status.required && status.frozenAmount <= 0) return null;
  // Dashboard only nudges when a deposit is actually due; everything else lives in Payouts.
  if (place === "dashboard" && !status.blocked) return null;

  const vars = {
    due: status.due,
    required: status.requiredAmount,
    balance: status.balance,
    frozen: status.frozenAmount,
  };

  if (status.blocked)
    return (
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 text-sm">
            <div className="font-bold text-amber-700 dark:text-amber-300">
              {fillText(texts.dueTitle, vars)}
            </div>
            <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-200/80">
              {fillText(texts.dueBody, vars)}
            </p>
          </div>
        </div>
        {!compact && (
          <Link
            to="/reseller/payouts"
            className="shrink-0 rounded-lg border border-amber-600/40 bg-background px-3 py-2 text-center text-xs font-bold text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
          >
            View deposit info
          </Link>
        )}
      </div>
    );

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-muted/30 px-4 py-3 text-xs">
      {status.required && (
        <span className="inline-flex items-center gap-1.5 font-medium text-success">
          <ShieldCheck className="h-3.5 w-3.5" /> {fillText(texts.okText, vars)}
        </span>
      )}
      {status.frozenAmount > 0 && (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> {fillText(texts.frozenText, vars)}
        </span>
      )}
    </div>
  );
}

/** Small inline chips for cards/tables. */
export function DepositChips({ status }: { status: DepositStatus }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium">
      {status.required ? (
        status.blocked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" /> Deposit due {bdt(status.due)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-success">
            <ShieldCheck className="h-3 w-3" /> Deposit OK
          </span>
        )
      ) : null}
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
        <Wallet className="h-3 w-3" /> Balance {bdt(status.balance)}
      </span>
      {status.frozenAmount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
          <Lock className="h-3 w-3" /> Frozen {bdt(status.frozenAmount)}
        </span>
      )}
    </div>
  );
}
