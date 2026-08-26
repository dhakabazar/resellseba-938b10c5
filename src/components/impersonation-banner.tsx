import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { readImpersonation, stopImpersonation, type ImpersonationSnapshot } from "@/lib/impersonation";

/** Shown while an admin is browsing a reseller panel through "Login as reseller". */
export function ImpersonationBanner() {
  const [snapshot, setSnapshot] = useState<ImpersonationSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    setSnapshot(readImpersonation());
  }, []);

  if (!snapshot) return null;

  async function back() {
    setBusy(true);
    try {
      const to = await stopImpersonation();
      setSnapshot(null);
      await nav({ to, replace: true });
    } catch (e: any) {
      setBusy(false);
      toast.error(e?.message ?? "Could not return to admin");
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
      <span className="inline-flex items-center gap-2 font-medium">
        <UserCog className="h-4 w-4" /> Viewing as {snapshot.label}
      </span>
      <button
        type="button"
        onClick={() => void back()}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-md border border-amber-400 bg-background px-2.5 py-1.5 text-xs font-semibold transition hover:bg-muted disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowLeft className="h-3.5 w-3.5" />} Back to admin
      </button>
    </div>
  );
}
