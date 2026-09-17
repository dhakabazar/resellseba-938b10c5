import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { SearchableSelect } from "@/components/searchable-select";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { Loader2, Check, X, Wallet, Copy, Phone, Landmark, ChevronDown, Search, Trash2 } from "lucide-react";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { useAuth } from "@/lib/use-auth";
import { DataToolbar, Pagination, usePaginated } from "@/components/data-list";
import { toast } from "sonner";
import { PayoutOverview, ResellerPayoutSummary } from "@/components/payout-overview";

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  validateSearch: (s: Record<string, unknown>): { reseller?: string; status?: string } => ({
    reseller: typeof s.reseller === "string" && s.reseller ? s.reseller : undefined,
    status: typeof s.status === "string" && s.status ? s.status : undefined,
  }),
  component: AdminPayouts,
});

type Reseller = {
  code: string;
  business_name: string;
  payout_method: string | null;
  payout_account_name: string | null;
  payout_account_number: string | null;
  payout_bank_name: string | null;
  payout_branch: string | null;
  payout_routing: string | null;
};

type Row = {
  id: string; reseller_id: string; amount: number; status: string; method: string | null; reference: string | null;
  notes: string | null; created_at: string; paid_at: string | null;
  reseller: Reseller | null;
};

const FILTERS = ["pending", "approved", "paid", "rejected", "all"] as const;
type Filter = (typeof FILTERS)[number];

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Copy failed");
  }
}

function CopyChip({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => copy(value, label)}
      title={`Copy ${label}`}
      className="inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px] hover:bg-muted"
    >
      <span className="truncate">{value}</span>
      <Copy className="h-3 w-3 shrink-0 opacity-70" />
    </button>
  );
}

function PayoutAccount({ r, fallback }: { r: Reseller | null; fallback: string | null }) {
  if (!r?.payout_account_number) {
    return <span className="text-xs text-muted-foreground">{fallback || "No account saved"}</span>;
  }
  const isBank = r.payout_method === "bank";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium capitalize">
        {isBank ? <Landmark className="h-3.5 w-3.5 opacity-70" /> : <Phone className="h-3.5 w-3.5 opacity-70" />}
        {r.payout_method ?? "—"}
      </div>
      <CopyChip value={r.payout_account_number} label={isBank ? "Account number" : "Mobile number"} />
      <div className="text-[11px] text-muted-foreground">
        {r.payout_account_name || "—"}
        {isBank && r.payout_bank_name ? ` · ${r.payout_bank_name}` : ""}
        {isBank && r.payout_branch ? ` · ${r.payout_branch}` : ""}
        {isBank && r.payout_routing ? ` · Routing ${r.payout_routing}` : ""}
      </div>
    </div>
  );
}

function StatusPill({ s }: { s: string }) {
  return <span className={"rounded-full px-2 py-0.5 text-[10px] capitalize " + statusStyle(s)}>{s}</span>;
}

function AdminPayouts() {
  const sp = Route.useSearch();
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>(
    (FILTERS as readonly string[]).includes(sp.status ?? "") ? (sp.status as Filter) : "pending",
  );
  const [resellerFilter, setResellerFilter] = useState(sp.reseller ?? "");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"requests" | "report">("requests");
  const [reportSearch, setReportSearch] = useState("");
  const [openReport, setOpenReport] = useState<string | null>(null);
  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<{ row: Row; status: "approved" | "paid" | "rejected" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("payouts")
      .select(
        "*, reseller:resellers(code, business_name, payout_method, payout_account_name, payout_account_number, payout_bank_name, payout_branch, payout_routing)",
      )
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setAllRows((data ?? []) as any);
    setLoading(false);
  }

  const resellerOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of allRows) {
      if (r.reseller_id && r.reseller) m.set(r.reseller_id, `${r.reseller.business_name} (${r.reseller.code})`);
    }
    return [...m].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [allRows]);

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows.filter((r) => {
      if (resellerFilter && r.reseller_id !== resellerFilter) return false;
      if (!q) return true;
      return [r.reseller?.business_name, r.reseller?.code, r.reference, r.method, String(r.amount)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [allRows, resellerFilter, query]);

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === "all" ? scoped.length : scoped.filter((r) => r.status === f).length;
    return acc;
  }, {} as Record<Filter, number>);

  const filteredRows = filter === "all" ? scoped : scoped.filter((r) => r.status === filter);
  const rows = usePaginated(filteredRows, page, perPage);

  useEffect(() => { setPage(1); }, [filter, resellerFilter, query, perPage]);

  async function submitAction() {
    if (!action) return;
    const { row, status } = action;
    if (status === "rejected" && !note.trim()) return toast.error("Please write a reason for rejection");
    const patch: any = { status };
    if (status === "paid") patch.paid_at = new Date().toISOString();
    if (note.trim()) patch.notes = note.trim();
    setBusy(true);
    const { error } = await supabase.from("payouts").update(patch).eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    setAction(null);
    setNote("");
    load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("payouts").delete().eq("id", toDelete.id);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Payout deleted");
    setToDelete(null);
    load();
  }

  function open(row: Row, status: "approved" | "paid" | "rejected") {
    setAction({ row, status });
    setNote(row.notes ?? "");
  }

  return (
    <div>
      <PageHeader title="Payout Management" description="Review withdrawal requests, check payout accounts and process payments." />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {([["requests", "Withdrawal requests"], ["report", "Reseller report"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors " +
              (tab === key ? "border-transparent bg-primary text-primary-foreground" : "hover:bg-muted")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "report" ? <PayoutOverview /> : <>

      <DataToolbar
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Search reseller, account, reference…"
        perPage={perPage}
        onPerPage={setPerPage}
        right={<SearchableSelect options={resellerOptions.map((o) => ({ value: o.id, label: o.label }))} value={resellerFilter} onChange={setResellerFilter} placeholder="All resellers" searchPlaceholder="Search reseller…" className="w-full sm:w-[240px]" align="end" />}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs capitalize transition-colors " + (filter === f ? "border-transparent bg-primary text-primary-foreground" : "hover:bg-muted")}>
            {f}
            <span className={"rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums " + (filter === f ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground")}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filteredRows.length === 0 ? (
        <div className="surface-card p-12 text-center">
          <Wallet className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No {filter} payouts.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {rows.map((r) => (
              <div key={r.id} className="surface-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{r.reseller?.business_name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold tabular-nums">৳{Number(r.amount).toLocaleString()}</div>
                    <StatusPill s={r.status} />
                  </div>
                </div>
                <div className="mt-3 rounded-md border bg-muted/30 p-3">
                  <PayoutAccount r={r.reseller} fallback={r.reference} />
                </div>
                {r.notes && (
                  <p className="mt-2 rounded-md border border-dashed p-2 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">Admin note:</span> {r.notes}
                  </p>
                )}
                <div className="mt-3">{actions(r)}</div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="surface-card hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Reseller</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Payout account</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Admin note</th>
                  <th className="p-3">Date</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="p-3">
                      <div className="font-medium">{r.reseller?.business_name ?? "—"}</div>
                    </td>
                    <td className="p-3 font-semibold tabular-nums">৳{Number(r.amount).toLocaleString()}</td>
                    <td className="p-3"><PayoutAccount r={r.reseller} fallback={r.reference} /></td>
                    <td className="p-3"><StatusPill s={r.status} /></td>
                    <td className="p-3 max-w-[220px] text-xs text-muted-foreground">{r.notes || "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="p-3">{actions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} perPage={perPage} total={filteredRows.length} onPage={setPage} />
        </>
      )}
      </>}

      <ConfirmModal
        isOpen={!!toDelete}
        onClose={() => !deleting && setToDelete(null)}
        onConfirm={confirmDelete}
        isLoading={deleting}
        variant="danger"
        title="Delete this payout?"
        description={
          toDelete
            ? `${toDelete.reseller?.business_name ?? "Reseller"} · BDT ${Number(toDelete.amount).toLocaleString()} (${toDelete.status}). This permanently removes the record from payout history and the reseller timeline, and the amount becomes withdrawable again. This cannot be undone.`
            : ""
        }
        confirmText="Delete payout"
      />

      {action && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => !busy && setAction(null)}>
          <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold capitalize">Mark payout {action.status}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {action.row.reseller?.business_name} · ৳{Number(action.row.amount).toLocaleString()}
            </p>
            <label className="mt-4 mb-1 block text-xs font-medium">
              Admin note {action.status === "rejected" ? "(reason — required)" : "(optional)"}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={action.status === "rejected" ? "Why is this request rejected?" : "Transaction ID or remarks…"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">The reseller will see this note in their payout list and timeline.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAction(null)} disabled={busy} className="rounded-md border px-3 py-1.5 text-xs">Cancel</button>
              <button onClick={submitAction} disabled={busy} className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium disabled:opacity-50">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function actions(r: Row) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {r.status === "pending" && (
          <>
            <button onClick={() => open(r, "approved")} className="rounded-md border px-2 py-1 text-xs hover:bg-muted">Approve</button>
            <button onClick={() => open(r, "rejected")} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
              <X className="h-3 w-3" /> Reject
            </button>
          </>
        )}
        {r.status === "approved" && (
          <>
            <button onClick={() => open(r, "paid")} className="btn-brand inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs">
              <Check className="h-3 w-3" /> Mark paid
            </button>
            <button onClick={() => open(r, "rejected")} className="rounded-md border px-2 py-1 text-xs text-destructive hover:bg-destructive/10">Reject</button>
          </>
        )}
        {(r.status === "paid" || r.status === "rejected") && (
          <span className="text-[11px] text-muted-foreground">
            {r.paid_at ? `Paid ${new Date(r.paid_at).toLocaleDateString()}` : "Closed"}
          </span>
        )}
        {isSuperAdmin && (
          <button
            onClick={() => setToDelete(r)}
            title="Delete payout (super admin only)"
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        )}
      </div>
    );
  }
}

function statusStyle(s: string) {
  return s === "paid" ? "bg-success/20 text-success"
    : s === "approved" ? "bg-primary/15 text-primary"
    : s === "rejected" ? "bg-destructive/20 text-destructive"
    : "bg-warning/20 text-warning-foreground";
}
