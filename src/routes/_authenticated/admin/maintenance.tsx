import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/ui-kit";
import { CLEANUP_TARGETS } from "@/lib/maintenance-targets";
import { cleanupStats, runCleanup } from "@/lib/maintenance.functions";
import { Loader2, RefreshCw, Trash2, Eraser, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";

export const Route = createFileRoute("/_authenticated/admin/maintenance")({
  component: MaintenancePage,
  head: () => ({
    meta: [
      { title: "Cache & cleanup · Admin" },
      { name: "description", content: "Clear stored logs, courier webhook payloads, old visit data and the browser cache." },
      { property: "og:title", content: "Cache & cleanup · Admin" },
      { property: "og:description", content: "Free up the database by removing logs and data the app does not need." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MaintenancePage() {
  const stats = useServerFn(cleanupStats);
  const clean = useServerFn(runCleanup);
  const [rows, setRows] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<string[]>(CLEANUP_TARGETS.map((t) => t.key));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await stats({});
      setRows(Object.fromEntries(res.map((r) => [r.key, r.rows])));
    } catch (e: any) {
      toast.error(e?.message ?? "Could not read cleanup data");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const toggle = (key: string) =>
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  async function doClean() {
    setBusy(true);
    try {
      const res = await clean({ data: { keys: picked } });
      const total = res.reduce((s, r) => s + r.rows, 0);
      toast.success(`Cleaned ${total.toLocaleString()} row(s)`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Cleanup failed");
    }
    setBusy(false);
    setConfirmOpen(false);
  }

  async function clearBrowserCache() {
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      sessionStorage.clear();
      toast.success("Browser cache cleared — reloading");
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not clear browser cache");
    }
  }

  const total = Object.values(rows).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cache & cleanup"
        description="Remove logs, courier webhook payloads and other data the app does not need to keep. Orders, products, resellers and money records are never touched."
        actions={
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} /> Refresh
          </button>
        }
      />

      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Removable rows</div>
            <div className="text-xl font-black">{loading ? "…" : total.toLocaleString()}</div>
          </div>
        </div>
        <button
          onClick={clearBrowserCache}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-muted"
        >
          <Eraser className="h-4 w-4" /> Clear browser cache
        </button>
      </div>

      <div className="surface-card divide-y overflow-hidden">
        {CLEANUP_TARGETS.map((t) => (
          <label key={t.key} className="flex cursor-pointer items-start gap-3 p-4 hover:bg-muted/30">
            <input
              type="checkbox"
              checked={picked.includes(t.key)}
              onChange={() => toggle(t.key)}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t.label}</div>
              <div className="text-xs text-muted-foreground">{t.hint}</div>
            </div>
            <div className="shrink-0 text-sm font-black">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (rows[t.key] ?? 0).toLocaleString()}
            </div>
          </label>
        ))}
      </div>

      <button
        onClick={() => (picked.length === 0 ? toast.error("Select at least one item") : setConfirmOpen(true))}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground hover:opacity-90 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Clean selected data
      </button>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doClean}
        isLoading={busy}
        variant="danger"
        title="Clean selected data?"
        description="This permanently deletes the selected logs and old records. Orders, products, resellers and money records are not affected."
        detail={`${picked.length} item(s) · ${picked.reduce((s, k) => s + (rows[k] ?? 0), 0).toLocaleString()} row(s)`}
        confirmText="Clean now"
      />
    </div>
  );
}
