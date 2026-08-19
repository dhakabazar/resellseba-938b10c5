import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { ReportCard } from "@/components/report-blocks";
import { DataToolbar, Pagination, usePaginated } from "@/components/data-list";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { bdt, downloadCsv, toCsv } from "@/lib/finance-report";
import { EXPENSE_CATEGORIES, type Expense } from "@/lib/business-report";
import { DATE_PRESET_OPTIONS, resolveDateRange, DEFAULT_ORDER_FILTERS, type DatePreset } from "@/components/order-filters";
import { Loader2, Plus, Pencil, Trash2, Download, Wallet, Receipt, CalendarDays } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/expenses")({
  component: ExpensesPage,
  head: () => ({
    meta: [
      { title: "Business expenses — Admin" },
      {
        name: "description",
        content: "Record every business expense — salary, marketing, courier, office — and see the totals per category.",
      },
      { property: "og:title", content: "Business expenses — Admin" },
      { property: "og:description", content: "Expense ledger that feeds the admin profit & loss report." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Form = {
  id?: string;
  title: string;
  category: string;
  amount: string;
  spent_on: string;
  method: string;
  reference: string;
  note: string;
};

const emptyForm = (): Form => ({
  title: "",
  category: "other",
  amount: "",
  spent_on: new Date().toISOString().slice(0, 10),
  method: "",
  reference: "",
  note: "",
});

const input = "h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

function ExpensesPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [del, setDel] = useState<Expense | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [preset, setPreset] = useState<DatePreset>("lifetime");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("expenses").select("*").order("spent_on", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as Expense[]);
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const { fromTs, toTs } = resolveDateRange({ ...DEFAULT_ORDER_FILTERS, datePreset: preset });
    const needle = q.trim().toLowerCase();
    return rows.filter((e) => {
      if (cat && e.category !== cat) return false;
      if (needle) {
        const hay = [e.title, e.category, e.method ?? "", e.reference ?? "", e.note ?? ""].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      const ts = new Date(`${e.spent_on}T12:00:00`).getTime();
      if (fromTs != null && ts < fromTs) return false;
      if (toTs != null && ts > toTs) return false;
      return true;
    });
  }, [rows, q, cat, preset]);

  const total = filtered.reduce((t, e) => t + Number(e.amount ?? 0), 0);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filtered) m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount ?? 0));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);
  const paged = usePaginated(filtered, page, perPage);

  const save = async () => {
    if (!form) return;
    if (!form.title.trim()) return toast.error("Expense title is required.");
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid amount.");
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      category: form.category,
      amount,
      spent_on: form.spent_on,
      method: form.method.trim() || null,
      reference: form.reference.trim() || null,
      note: form.note.trim() || null,
    };
    const { error } = form.id
      ? await supabase.from("expenses").update(payload).eq("id", form.id)
      : await supabase.from("expenses").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Expense updated." : "Expense added.");
    setForm(null);
    void load();
  };

  const remove = async () => {
    if (!del) return;
    const { error } = await supabase.from("expenses").delete().eq("id", del.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expense deleted.");
    setDel(null);
    void load();
  };

  const exportCsv = () =>
    downloadCsv(
      "business-expenses.csv",
      toCsv(
        ["Date", "Title", "Category", "Amount", "Method", "Reference", "Note"],
        filtered.map((e) => [e.spent_on, e.title, e.category, Number(e.amount ?? 0), e.method ?? "", e.reference ?? "", e.note ?? ""]),
      ),
    );

  return (
    <div>
      <PageHeader
        title="Business expenses"
        description="Every cost you pay from your own pocket. These totals are deducted in the admin profit & loss report."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export
            </button>
            <button
              type="button"
              onClick={() => setForm(emptyForm())}
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add expense
            </button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total expense" value={bdt(total)} hint={`${filtered.length} entries in this range`} icon={<Wallet className="h-4 w-4" />} tone="rose" />
        {byCat.slice(0, 3).map(([c, amt]) => (
          <StatCard key={c} label={`${c} expense`} value={bdt(amt)} hint="Category total in this range" icon={<Receipt className="h-4 w-4" />} tone="violet" />
        ))}
      </div>

      <DataToolbar
        inline
        search={q}
        onSearch={(v) => {
          setQ(v);
          setPage(1);
        }}
        searchPlaceholder="Search title, reference, note…"
        perPage={perPage}
        onPerPage={(n) => {
          setPerPage(n);
          setPage(1);
        }}
        filters={[
          {
            key: "cat",
            label: "Category",
            value: cat,
            onChange: (v) => {
              setCat(v);
              setPage(1);
            },
            options: EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
          },
        ]}
        right={
          <label className="inline-flex items-center gap-1 rounded-md border bg-background px-2 text-xs">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value as DatePreset);
                setPage(1);
              }}
              className="h-9 bg-transparent text-xs outline-none"
            >
              {DATE_PRESET_OPTIONS.filter((o) => o.value !== "custom").map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <ReportCard title="Expense ledger" hint="Newest first — edit or delete any entry.">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/20">
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Title</th>
                <th className={th}>Category</th>
                <th className={th + " text-right"}>Amount</th>
                <th className={th}>Method / ref</th>
                <th className={th}>Note</th>
                <th className={th + " text-right"}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{e.spent_on}</td>
                  <td className="px-3 py-2 font-medium">{e.title}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize">{e.category}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-destructive">−{bdt(Number(e.amount ?? 0))}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {e.method || "—"}
                    {e.reference ? ` · ${e.reference}` : ""}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{e.note || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        title="Edit"
                        onClick={() =>
                          setForm({
                            id: e.id,
                            title: e.title,
                            category: e.category,
                            amount: String(e.amount ?? ""),
                            spent_on: e.spent_on,
                            method: e.method ?? "",
                            reference: e.reference ?? "",
                            note: e.note ?? "",
                          })
                        }
                        className="rounded-md border p-1.5 hover:bg-accent"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => setDel(e)}
                        className="rounded-md border p-1.5 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-xs text-muted-foreground">
                    No expense recorded in this range.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t bg-muted/30 font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={3}>
                  Total
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-destructive">−{bdt(total)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        )}
      </ReportCard>

      <Pagination page={page} perPage={perPage} total={filtered.length} onPage={setPage} />

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="surface-card w-full max-w-lg space-y-3 rounded-t-2xl p-5 sm:rounded-2xl">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
              {form.id ? "Edit expense" : "Add expense"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 flex flex-col gap-1 text-xs">
                <span className="font-medium text-muted-foreground">Title</span>
                <input className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Facebook ad boost" />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-muted-foreground">Category</span>
                <select className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-muted-foreground">Amount (৳)</span>
                <input className={input} type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-muted-foreground">Spent on</span>
                <input className={input} type="date" value={form.spent_on} onChange={(e) => setForm({ ...form, spent_on: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-muted-foreground">Method</span>
                <input className={input} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} placeholder="bKash / cash / bank" />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-muted-foreground">Reference</span>
                <input className={input} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium text-muted-foreground">Note</span>
                <input className={input} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setForm(null)} className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!del}
        onClose={() => setDel(null)}
        onConfirm={remove}
        title="Delete this expense?"
        description="The amount will no longer be deducted from the admin profit & loss report."
        detail={del ? `${del.title} · ${bdt(Number(del.amount ?? 0))}` : undefined}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
