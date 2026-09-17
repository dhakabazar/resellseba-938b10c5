import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Eye, Loader2, MousePointerClick, RefreshCw, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/ui-kit";
import {
  LIVE_REFRESH_MS,
  VISIT_RANGES,
  type VisitRange,
  useLiveRefresh,
  visitRangeBounds,
} from "@/lib/store-visits";

type Summary = { visits: number; visitors: number; live: number; today_visits: number; last_at: string | null };
type Daily = { day: string; visits: number; visitors: number };
type Pages = { path: string; visits: number; visitors: number };
export type Leader = {
  reseller_id: string;
  code: string;
  business_name: string;
  visits: number;
  visitors: number;
  live: number;
  last_at: string | null;
};

const rpc = (name: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: unknown }>)(name, args);

export function RangeTabs({ value, onChange }: { value: VisitRange; onChange: (v: VisitRange) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-xl border bg-card p-1.5">
      {VISIT_RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onChange(r.id)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            value === r.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Visitor report for one reseller (or all resellers when `resellerId` is null and
 * the viewer is an admin). Data is fetched on mount + on range change, then softly
 * polled every 15s while the tab is visible — no realtime sockets, no extra load.
 */
export function StoreVisitsReport({
  resellerId,
  range,
  extraHeader,
}: {
  resellerId: string | null;
  range: VisitRange;
  extraHeader?: React.ReactNode;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [pages, setPages] = useState<Pages[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const bounds = useMemo(() => visitRangeBounds(range), [range]);

  const load = useCallback(
    async (soft = false) => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (!soft) setLoading(true);
      else setBusy(true);
      const args = { _reseller_id: resellerId, _from: bounds.from, _to: bounds.to };
      const [s, d, p] = await Promise.all([
        rpc("store_visit_summary", args),
        rpc("store_visit_daily", args),
        rpc("store_visit_pages", { ...args, _limit: 0 }),
      ]);
      const srow = (s.data as Summary[] | null)?.[0] ?? null;
      setSummary(srow);
      setDaily(((d.data as Daily[] | null) ?? []).slice(-30));
      setPages((p.data as Pages[] | null) ?? []);
      setUpdatedAt(new Date());
      setLoading(false);
      setBusy(false);
      inFlight.current = false;
    },
    [bounds.from, bounds.to, resellerId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const tick = useCallback(() => {
    void load(true);
  }, [load]);
  useLiveRefresh(tick, true, LIVE_REFRESH_MS);

  const max = Math.max(1, ...daily.map((d) => Number(d.visits)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {extraHeader}
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live · auto refresh {LIVE_REFRESH_MS / 1000}s
          </span>
          {updatedAt && <span>Updated {updatedAt.toLocaleTimeString()}</span>}
          <button
            type="button"
            onClick={() => void load(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-semibold hover:border-primary hover:text-primary"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Live visitors (5 min)" value={Number(summary?.live ?? 0)} icon={<Activity className="h-4 w-4" />} />
        <StatCard label="Pageviews" value={Number(summary?.visits ?? 0)} icon={<Eye className="h-4 w-4" />} />
        <StatCard label="Unique visitors" value={Number(summary?.visitors ?? 0)} icon={<Users className="h-4 w-4" />} />
        <StatCard
          label="Views today"
          value={Number(summary?.today_visits ?? 0)}
          icon={<MousePointerClick className="h-4 w-4" />}
        />
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="surface-card p-5">
            <h3 className="text-sm font-bold">Daily traffic</h3>
            {daily.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">No visits in this period yet.</p>
            ) : (
              <div className="mt-5 flex h-40 items-end gap-1.5">
                {daily.map((d) => (
                  <div key={d.day} className="group flex flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[10px] font-semibold text-muted-foreground opacity-0 group-hover:opacity-100">
                      {d.visits}
                    </span>
                    <div
                      className="w-full rounded-t bg-primary/80"
                      style={{ height: `${Math.max(4, (Number(d.visits) / max) * 100)}%` }}
                      title={`${d.day} · ${d.visits} views · ${d.visitors} visitors`}
                    />
                    <span className="text-[9px] text-muted-foreground">{d.day.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="surface-card overflow-hidden">
            <div className="border-b px-5 py-3 text-sm font-bold">Top pages</div>
            {pages.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">No page data yet.</p>
            ) : (
              <div className="divide-y">
                {pages.map((p) => (
                  <div key={p.path} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="truncate font-mono text-xs">{p.path}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      <b className="text-foreground">{p.visits}</b> views · {p.visitors} visitors
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Only the last 30 days of visit data is kept — older records are removed automatically.
      </p>
    </div>
  );
}

export function useLeaderboard(range: VisitRange) {
  const [rows, setRows] = useState<Leader[]>([]);
  const bounds = useMemo(() => visitRangeBounds(range), [range]);
  const load = useCallback(async () => {
    const { data } = await rpc("store_visit_leaderboard", { _from: bounds.from, _to: bounds.to, _limit: 0 });
    setRows((data as Leader[] | null) ?? []);
  }, [bounds.from, bounds.to]);
  useEffect(() => {
    void load();
  }, [load]);
  const tick = useCallback(() => {
    void load();
  }, [load]);
  useLiveRefresh(tick, true, LIVE_REFRESH_MS);
  return { rows, reload: load };
}
