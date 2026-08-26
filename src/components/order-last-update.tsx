import { useEffect, useState } from "react";
import { StickyNote, X, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OrderNotes } from "@/components/order-notes";

export type OrderMeta = {
  statusAt: string | null;
  noteBody: string | null;
  noteRole: string | null;
  noteName: string | null;
  noteAt: string | null;
  noteCount: number;
};

const empty = (): OrderMeta => ({
  statusAt: null,
  noteBody: null,
  noteRole: null,
  noteName: null,
  noteAt: null,
  noteCount: 0,
});

/** Latest status-change time + latest note for a batch of orders (2 queries total). */
export async function fetchOrderMeta(ids: string[]): Promise<Record<string, OrderMeta>> {
  const list = ids.filter(Boolean);
  if (list.length === 0) return {};
  const [{ data: hist }, { data: notes }, { data: ords }] = await Promise.all([
    supabase
      .from("order_status_history")
      .select("order_id,created_at")
      .in("order_id", list)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_notes")
      .select("order_id,body,author_role,author_name,created_at")
      .in("order_id", list)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id,reseller_note,admin_note,notes,created_at,updated_at")
      .in("id", list),
  ]);
  const out: Record<string, OrderMeta> = {};
  for (const id of list) out[id] = empty();
  for (const h of (hist ?? []) as any[]) {
    const m = out[h.order_id];
    if (m && !m.statusAt) m.statusAt = h.created_at;
  }
  for (const n of (notes ?? []) as any[]) {
    const m = out[n.order_id];
    if (!m) continue;
    m.noteCount += 1;
    if (!m.noteBody) {
      m.noteBody = n.body;
      m.noteRole = n.author_role;
      m.noteName = n.author_name ?? null;
      m.noteAt = n.created_at;
    }
  }
  for (const o of (ords ?? []) as any[]) {
    const m = out[o.id];
    if (!m) continue;
    const form: { role: string; body: string }[] = [];
    if (o.reseller_note) form.push({ role: "reseller", body: o.reseller_note });
    if (o.admin_note) form.push({ role: "admin", body: o.admin_note });
    if (o.notes) form.push({ role: "staff", body: o.notes });
    m.noteCount += form.length;
    if (!m.noteBody && form[0]) {
      m.noteBody = form[0].body;
      m.noteRole = form[0].role;
      m.noteAt = o.updated_at ?? o.created_at;
    }
  }
  return out;
}

function roleTag(role: string | null) {
  if (role === "reseller") return "Reseller";
  if (role === "admin" || role === "super_admin") return "Admin";
  if (role) return "Staff";
  return "";
}

export function OrderNotePreview({
  meta,
  onOpenNotes,
  className = "",
  align = "center",
}: {
  meta?: OrderMeta;
  onOpenNotes: () => void;
  className?: string;
  align?: "center" | "left";
}) {
  return (
    <button
      type="button"
      onClick={onOpenNotes}
      title="View / add notes"
      className={`w-full rounded-md border border-dashed bg-background px-1.5 py-1 text-left transition hover:border-primary/50 hover:bg-primary/5 ${className}`}
    >
      {meta?.noteBody ? (
        <>
          <span className="mt-0.5 block line-clamp-4 text-[10px] leading-snug text-foreground/80">
            {meta.noteBody}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[9px] text-muted-foreground/80">
            {meta.noteAt && (
              <span className="tabular-nums text-muted-foreground/70">
                {new Date(meta.noteAt).toLocaleString([], {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <span>by</span>
            {meta.noteName ? (
              <span className="font-semibold text-foreground/70">{meta.noteName}</span>
            ) : (
              <span className="font-medium">{roleTag(meta.noteRole) || "Unknown"}</span>
            )}
            {meta.noteCount > 1 && <span className="text-muted-foreground">+{meta.noteCount - 1}</span>}
          </span>
        </>
      ) : (
        <span
          className={`flex items-center gap-1 text-[10px] text-muted-foreground ${align === "center" ? "justify-center" : ""}`}
        >
          <StickyNote className="h-2.5 w-2.5" /> Add note
        </span>
      )}
    </button>
  );
}

export function LastUpdateCell({
  meta,
  fallbackAt,
  onOpenNotes,
  hideNote = false,
}: {
  meta?: OrderMeta;
  /** Used when the order has no status history yet (order created / updated at). */
  fallbackAt?: string | null;
  onOpenNotes: () => void;
  hideNote?: boolean;
}) {
  const at = meta?.statusAt ?? fallbackAt ?? null;
  const d = at ? new Date(at) : null;
  return (
    <div className="min-w-0 text-center">
      {d ? (
        <>
          <div className="text-[11px] font-medium text-foreground">
            {d.toLocaleDateString()}
          </div>
          <div className="text-[10px] tabular-nums text-muted-foreground/80">
            {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </>
      ) : (
        <div className="text-[10px] italic text-muted-foreground/60">No update yet</div>
      )}
      {!hideNote && <OrderNotePreview meta={meta} onOpenNotes={onOpenNotes} className="mt-1" />}
    </div>
  );
}


export function OrderNotesModal({
  orderId,
  orderNumber,
  authorRole,
  authorName,
  canWrite,
  lockedHint,
  onClose,
}: {
  orderId: string;
  orderNumber?: string | null;
  authorRole: "reseller" | "admin" | "staff";
  authorName?: string | null;
  canWrite: boolean;
  lockedHint?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-bold">
            Notes {orderNumber ? <span className="text-muted-foreground">· #{orderNumber}</span> : null}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notes"
            className="grid h-7 w-7 place-items-center rounded-md border text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-3">
          <OrderNotes
            orderId={orderId}
            canWrite={canWrite}
            authorRole={authorRole}
            authorName={authorName}
            lockedHint={lockedHint}
          />
        </div>
      </div>
    </div>
  );
}

/** Small helper hook: keeps a meta map in sync for the current rows. */
export function useOrderMeta(ids: string[]) {
  const [meta, setMeta] = useState<Record<string, OrderMeta>>({});
  const key = ids.join(",");
  useEffect(() => {
    let alive = true;
    if (ids.length === 0) {
      setMeta({});
      return;
    }
    void fetchOrderMeta(ids).then((m) => {
      if (alive) setMeta((prev) => ({ ...prev, ...m }));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const refresh = async (list: string[]) => {
    const m = await fetchOrderMeta(list);
    setMeta((prev) => ({ ...prev, ...m }));
  };
  return { meta, refresh };
}
