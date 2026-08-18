/** Shared money timeline (ledger) UI — used by reseller payouts and admin reseller earning report. */

export type LedgerRow = {
  at: string;
  kind: "deposit" | "profit" | "payout" | string;
  direction: "in" | "out" | "void" | string;
  label: string;
  reference: string | null;
  status: string;
  amount: number;
  running: number;
};

export function LedgerTotals({
  ledger,
  frozen,
  available,
  className = "",
}: {
  ledger: LedgerRow[];
  frozen: number;
  available: number;
  className?: string;
}) {
  const inflow = ledger.filter((e) => e.direction === "in").reduce((s, e) => s + Number(e.amount), 0);
  const outflow = ledger.filter((e) => e.direction === "out").reduce((s, e) => s + Number(e.amount), 0);
  return (
    <div className={"grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-5 " + className}>
      <TotalCell label="Total in" value={inflow} tone="good" />
      <TotalCell label="Total out" value={outflow} tone="bad" />
      <TotalCell label="Balance" value={inflow - outflow} />
      <TotalCell label="Frozen" value={frozen} />
      <TotalCell label="Withdrawable" value={available} tone="good" />
    </div>
  );
}

function TotalCell({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={
          "text-sm font-bold tabular-nums " +
          (tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "")
        }
      >
        ৳{Number(value || 0).toLocaleString()}
      </div>
    </div>
  );
}

export function LedgerTimeline({
  ledger,
  frozen,
  available,
  emptyText = "No transactions yet.",
}: {
  ledger: LedgerRow[];
  frozen: number;
  available: number;
  emptyText?: string;
}) {
  if (ledger.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">{emptyText}</div>
    );
  }
  return (
    <>
      <LedgerTotals ledger={ledger} frozen={frozen} available={available} />
      <ol className="relative mt-4 space-y-3 border-l pl-5">
        {ledger.map((e, i) => {
          const inflow = e.direction === "in";
          const voided = e.direction === "void";
          return (
            <li key={i} className="relative">
              <span
                className={
                  "absolute -left-[26px] top-1.5 h-3 w-3 rounded-full ring-4 ring-background " +
                  (voided ? "bg-muted-foreground/40" : inflow ? "bg-success" : "bg-destructive")
                }
              />
              <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{e.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(e.at).toLocaleString()} · <span className="capitalize">{e.status}</span>
                  </div>
                  {e.reference && e.reference !== "—" && (
                    <div className="mt-0.5 break-words text-[11px] text-muted-foreground">{e.reference}</div>
                  )}
                </div>
                <div className="text-right">
                  <div
                    className={
                      "text-sm font-bold tabular-nums " +
                      (voided ? "text-muted-foreground line-through" : inflow ? "text-success" : "text-destructive")
                    }
                  >
                    {inflow ? "+" : "−"}৳{Number(e.amount).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    Balance ৳{Number(e.running).toLocaleString()}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <LedgerTotals ledger={ledger} frozen={frozen} available={available} className="mt-4" />
    </>
  );
}
