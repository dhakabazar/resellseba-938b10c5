import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { RangeTabs, StoreVisitsReport, useLeaderboard } from "@/components/store-visits-report";
import type { VisitRange } from "@/lib/store-visits";
import { SearchableSelect } from "@/components/searchable-select";

export const Route = createFileRoute("/_authenticated/admin/visitors")({
  component: AdminVisitorsPage,
});

type ResellerOpt = { id: string; code: string; business_name: string };

function AdminVisitorsPage() {
  const [range, setRange] = useState<VisitRange>("today");
  const [resellers, setResellers] = useState<ResellerOpt[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [purging, setPurging] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { rows, reload } = useLeaderboard(range);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("resellers")
        .select("id, code, business_name")
        .order("business_name", { ascending: true });
      setResellers((data ?? []) as ResellerOpt[]);
    })();
  }, []);

  const board = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) => r.business_name?.toLowerCase().includes(term) || r.code?.toLowerCase().includes(term),
    );
  }, [rows, q]);

  async function purge() {
    setPurging(true);
    const { data, error } = await (
      supabase.rpc as unknown as (n: string) => Promise<{ data: unknown; error: { message: string } | null }>
    )("purge_store_visits");
    setPurging(false);
    setConfirm(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${Number(data ?? 0)} old visit records deleted`);
    void reload();
  }

  return (
    <div>
      <PageHeader
        title="Store visitors"
        description="Live storefront traffic across all resellers. Only the last 30 days is kept."
      />

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <RangeTabs value={range} onChange={setRange} />
          <SearchableSelect
            options={resellers.map((r) => ({ value: r.id, label: `${r.business_name} (${r.code})` }))}
            value={selected ?? ""}
            onChange={(v) => setSelected(v || null)}
            placeholder="All resellers"
            searchPlaceholder="Search reseller…"
            className="w-full sm:w-[240px]"
          />
        </div>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-rose-500/40 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-500/10"
        >
          {purging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete data older than
          30 days
        </button>
      </div>

      <StoreVisitsReport resellerId={selected} range={range} />

      <div className="surface-card mt-8 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
          <h3 className="text-sm font-bold">Top stores by traffic</h3>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search reseller / code"
              className="h-9 w-56 rounded-lg border bg-background pl-9 pr-3 text-sm"
            />
          </div>
        </div>
        {board.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">No visits recorded in this period.</p>
        ) : (
          <div className="divide-y">
            <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1.2fr] gap-3 bg-muted/40 px-5 py-2 text-xs font-medium text-muted-foreground md:grid">
              <div>Reseller</div>
              <div className="text-center">Live</div>
              <div className="text-center">Pageviews</div>
              <div className="text-center">Visitors</div>
              <div className="text-center">Last visit</div>
            </div>
            {board.map((r) => (
              <button
                key={r.reseller_id}
                type="button"
                onClick={() => setSelected(r.reseller_id)}
                className="grid w-full grid-cols-2 items-center gap-3 px-5 py-3 text-left text-sm hover:bg-muted/40 md:grid-cols-[2fr_1fr_1fr_1fr_1.2fr]"
              >
                <div className="truncate">
                  <div className="font-semibold">{r.business_name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{r.code}</div>
                </div>
                <div className="text-center font-bold text-emerald-600">{Number(r.live)}</div>
                <div className="text-center font-semibold">{Number(r.visits)}</div>
                <div className="text-center">{Number(r.visitors)}</div>
                <div className="text-center text-xs text-muted-foreground">
                  {r.last_at ? new Date(r.last_at).toLocaleString() : "—"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={purge}
        title="Delete visit data older than 30 days?"
        description="All storefront visit records older than 30 days will be permanently deleted. This cannot be undone."
        confirmText="Delete permanently"
        variant="danger"
        isLoading={purging}
      />

    </div>
  );
}
