import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { recheckCourierStatus } from "@/lib/order-details.functions";

/**
 * Small inline "check courier status" icon shown next to the courier name / booking id
 * in the order lists, so one order can be rechecked without opening it.
 */
export function CourierRecheckButton({
  orderId,
  onDone,
  className = "",
}: {
  orderId: string;
  onDone?: () => void | Promise<void>;
  className?: string;
}) {
  const recheck = useServerFn(recheckCourierStatus);
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      title="Check courier status"
      aria-label="Check courier status"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
          const r: any = await recheck({ data: { orderId } });
          if (r?.success) toast.success(r.message || "Courier status checked");
          else toast.error(r?.message || "Courier status check failed");
          await onDone?.();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Courier status check failed");
        } finally {
          setBusy(false);
        }
      }}
      className={`shrink-0 opacity-60 transition-opacity hover:opacity-100 disabled:opacity-40 ${className}`}
    >
      <RefreshCw className={`h-2.5 w-2.5 ${busy ? "animate-spin" : ""}`} />
    </button>
  );
}
