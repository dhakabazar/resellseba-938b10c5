import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, Search, X, Wallet } from "lucide-react";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { SearchableSelect } from "@/components/searchable-select";

export type DepositLedgerRow = {
  id: string;
  reseller_id: string;
  amount: number;
  method: string | null;
  reference: string | null;
  note: string | null;
  created_at: string;
};

const METHODS = ["bkash", "nagad", "rocket", "bank", "cash", "adjustment"];

const bdt = (v: number) => `৳${Number(v || 0).toLocaleString("en-US")}`;

/**
 * Deposit transaction list with edit + delete.
 * Pass `resellerId` to scope it to a single reseller (deposit modal),
 * omit it for the platform-wide admin list.
 */
export function DepositLedger({
  resellerId,
  onChanged,
  compact,
}: {
  resellerId?: string;
  onChanged?: () => void;
  compact?: boolean;
}) {
  const [rows, setRows] = useState<DepositLedgerRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [resellers, setResellers] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterReseller, setFilterReseller] = useState("");
  const [editRow, setEditRow] = useState<DepositLedgerRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<DepositLedgerRow | null>(null);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("reseller_deposits")
      .select("id,reseller_id,amount,method,reference,note,created_at")
      .order("created_at", { ascending: false })
      ;
    if (resellerId) q = q.eq("reseller_id", resellerId);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data ?? []) as DepositLedgerRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [resellerId]);

  useEffect(() => {
    if (resellerId) return;
    void supabase
      .from("resellers")
      .select("id,business_name,code")
      .order("business_name")
      .then(({ data }) => {
        const map: Record<string, string> = {};
        const list = (data ?? []).map((r: any) => {
          map[r.id] = `${r.business_name} · ${r.code}`;
          return { id: r.id as string, label: `${r.business_name} · ${r.code}` };
        });
        setNames(map);
        setResellers(list);
      });
  }, [resellerId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterReseller && r.reseller_id !== filterReseller) return false;
      if (!q) return true;
      return [names[r.reseller_id], r.method, r.reference, r.note, String(r.amount)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, filterReseller, names]);

  const total = filtered.reduce((n, r) => n + Number(r.amount), 0);

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Search</span>
            <div className="flex h-9 items-center rounded-md border bg-background px-2 focus-within:ring-2 focus-within:ring-ring">
              <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Reseller, method, reference, note…"
                className="h-full w-full bg-transparent text-sm outline-none"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="rounded p-0.5 hover:bg-accent">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <SearchableSelect
            label="Reseller"
            placeholder="All resellers"
            value={filterReseller}
            onChange={setFilterReseller}
            options={[{ value: "", label: "All resellers" }, ...resellers.map((r) => ({ value: r.id, label: r.label }))]}
            className="min-w-[180px] flex-1"
          />
          <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/40 px-3 text-xs font-semibold">
            <Wallet className="h-3.5 w-3.5 text-primary" /> {bdt(total)}
            <span className="font-normal text-muted-foreground">· {filtered.length} entries</span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left uppercase text-muted-foreground">
            <tr>
              <th className="p-2">Date</th>
              {!resellerId && <th className="p-2">Reseller</th>}
              <th className="p-2">Amount</th>
              <th className="p-2">Method</th>
              <th className="p-2">Reference</th>
              <th className="p-2">Note</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="whitespace-nowrap p-2">
                  {new Date(r.created_at).toLocaleDateString()}
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </td>
                {!resellerId && <td className="p-2">{names[r.reseller_id] ?? "—"}</td>}
                <td
                  className={
                    "whitespace-nowrap p-2 font-semibold " + (Number(r.amount) < 0 ? "text-destructive" : "text-success")
                  }
                >
                  {bdt(Number(r.amount))}
                </td>
                <td className="p-2 capitalize">{r.method ?? "—"}</td>
                <td className="p-2 text-muted-foreground">{r.reference ?? "—"}</td>
                <td className="p-2 text-muted-foreground">{r.note ?? "—"}</td>
                <td className="whitespace-nowrap p-2 text-right">
                  <button
                    type="button"
                    onClick={() => setEditRow(r)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Edit entry"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteRow(r)}
                    className="ml-1 rounded-md p-1 text-destructive hover:bg-destructive/10"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {loading && (
              <tr>
                <td colSpan={7} className="p-6 text-center">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No deposit transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editRow && (
        <EditDepositModal
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            void load();
            onChanged?.();
          }}
        />
      )}

      {deleteRow && (
        <ConfirmModal
          isOpen
          variant="danger"
          title="Delete deposit entry?"
          description="Deleting this entry will reduce the reseller's deposit balance and can block order confirmation if a deposit becomes due."
          detail={`${bdt(Number(deleteRow.amount))} · ${deleteRow.method ?? "—"}`}
          confirmText="Delete"
          cancelText="Cancel"
          onClose={() => setDeleteRow(null)}
          onConfirm={async () => {
            const row = deleteRow;
            setDeleteRow(null);
            if (!row) return;
            const { error } = await supabase.from("reseller_deposits").delete().eq("id", row.id);
            if (error) {
              toast.error(error.message);
              return;
            }
            toast.success("Entry deleted");
            void load();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

function EditDepositModal({
  row,
  onClose,
  onSaved,
}: {
  row: DepositLedgerRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(String(row.amount));
  const [method, setMethod] = useState(row.method ?? "bkash");
  const [reference, setReference] = useState(row.reference ?? "");
  const [note, setNote] = useState(row.note ?? "");
  const [busy, setBusy] = useState(false);

  const cls = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt) return toast.error("Enter an amount (use − for a refund)");
    setBusy(true);
    const { error } = await supabase
      .from("reseller_deposits")
      .update({ amount: amt, method: method || null, reference: reference || null, note: note || null })
      .eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Deposit entry updated");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-3" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-xl border bg-background p-4 shadow-xl sm:p-5"
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Edit deposit entry</div>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium">Amount (৳) — use − for refund</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={cls}>
              {METHODS.map((m) => (
                <option key={m} value={m} className="capitalize">
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Reference / TrxID</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={cls} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-1.5 text-xs hover:bg-muted">
            Cancel
          </button>
          <button
            disabled={busy}
            className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
