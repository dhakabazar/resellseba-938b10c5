import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquarePlus, Pencil, Trash2, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const NOTE_WORD_LIMIT = 20;

export function countWords(text: string) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Trim input down to the word limit so users simply cannot type more. */
function clampWords(text: string) {
  const parts = text.split(/(\s+)/);
  let words = 0;
  let out = "";
  for (const p of parts) {
    if (/^\s+$/.test(p)) {
      out += p;
      continue;
    }
    if (p === "") continue;
    if (words >= NOTE_WORD_LIMIT) return out.replace(/\s+$/, "");
    words++;
    out += p;
  }
  return out;
}

export type OrderNote = {
  id: string;
  order_id: string;
  author_id: string | null;
  author_name: string | null;
  author_role: string;
  body: string;
  created_at: string;
  updated_at: string;
};

function roleBadge(role: string) {
  if (role === "reseller") return "bg-primary/10 text-primary";
  if (role === "admin" || role === "super_admin") return "bg-emerald-500/10 text-emerald-600";
  return "bg-muted text-muted-foreground";
}

function roleLabel(role: string) {
  if (role === "reseller") return "Reseller";
  if (role === "super_admin" || role === "admin") return "Admin";
  return "Staff";
}

export function OrderNotes({
  orderId,
  canWrite,
  authorRole,
  authorName,
  lockedHint,
  title = "Order notes",
}: {
  orderId: string;
  /** Whether the current viewer may add / edit notes on this order. */
  canWrite: boolean;
  authorRole: "reseller" | "admin" | "staff";
  authorName?: string | null;
  /** Message shown when notes are read-only. */
  lockedHint?: string;
  title?: string;
}) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [orderNotes, setOrderNotes] = useState<
    { role: string; name: string | null; body: string; at: string }[]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, { data: ord }] = await Promise.all([
      supabase
        .from("order_notes")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("reseller_note,admin_note,notes,created_at,updated_at,reseller:resellers(business_name)")
        .eq("id", orderId)
        .maybeSingle(),
    ]);
    if (error) console.error("[order_notes]", error);
    setNotes((data as OrderNote[]) ?? []);
    const o = ord as any;
    const pinned: { role: string; name: string | null; body: string; at: string }[] = [];
    if (o) {
      const at = o.updated_at ?? o.created_at;
      if (o.reseller_note)
        pinned.push({
          role: "reseller",
          name: o.reseller?.business_name ?? null,
          body: o.reseller_note,
          at,
        });
      if (o.admin_note) pinned.push({ role: "admin", name: null, body: o.admin_note, at });
      if (o.notes) pinned.push({ role: "staff", name: null, body: o.notes, at });
    }
    setOrderNotes(pinned);
    setLoading(false);
  }, [orderId]);


  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = (n: OrderNote) =>
    canWrite && (authorRole !== "reseller" || n.author_id === user?.id);

  async function add() {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    const { error } = await supabase.from("order_notes").insert({
      order_id: orderId,
      author_id: user?.id ?? null,
      author_name: authorName ?? null,
      author_role: authorRole,
      body,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft("");
    toast.success("Note added");
    void load();
  }

  async function saveEdit(id: string) {
    const body = editDraft.trim();
    if (!body) return;
    setBusy(true);
    const { error } = await supabase
      .from("order_notes")
      .update({ body })
      .eq("id", id)
      .select("id");
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditingId(null);
    toast.success("Note updated");
    void load();
  }

  async function remove(id: string) {
    setBusy(true);
    const { data, error } = await supabase.from("order_notes").delete().eq("id", id).select("id");
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data || data.length === 0) {
      toast.error("You do not have permission to delete this note.");
      return;
    }
    toast.success("Note deleted");
    void load();
  }

  const words = countWords(draft);


  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <MessageSquarePlus className="h-3.5 w-3.5" />
          {title}
        </h3>
        <span className="text-[10px] font-semibold text-muted-foreground">
          {notes.length} note{notes.length === 1 ? "" : "s"} · max {NOTE_WORD_LIMIT} words
        </span>
      </div>

      <div className="space-y-4 p-4">
        {canWrite ? (
          <div className="rounded-xl border bg-background p-2.5">
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(clampWords(e.target.value))}
              placeholder="Write a short note (max 20 words)…"
              className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <div className="mt-1.5 flex items-center justify-between">
              <span
                className={`text-[11px] font-semibold ${
                  words >= NOTE_WORD_LIMIT ? "text-amber-600" : "text-muted-foreground"
                }`}
              >
                {words}/{NOTE_WORD_LIMIT} words
              </span>
              <button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={() => void add()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                Add note
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {lockedHint ?? "Notes are read-only for this order status."}
          </p>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading notes…
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No notes yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l pl-4">
            {notes.map((n) => (
              <li key={n.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${roleBadge(n.author_role)}`}>
                    {roleLabel(n.author_role)}
                  </span>
                  {n.author_name && <span className="font-semibold text-foreground/70">{n.author_name}</span>}
                  <span>·</span>
                  <span>{new Date(n.created_at).toLocaleString()}</span>
                  {n.updated_at !== n.created_at && <span>· edited</span>}
                </div>

                {editingId === n.id ? (
                  <div className="mt-1.5 rounded-lg border bg-background p-2">
                    <textarea
                      rows={2}
                      value={editDraft}
                      onChange={(e) => setEditDraft(clampWords(e.target.value))}
                      className="w-full resize-none bg-transparent text-sm outline-none"
                    />
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {countWords(editDraft)}/{NOTE_WORD_LIMIT} words
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                        >
                          <X className="h-3 w-3" /> Cancel
                        </button>
                        <button
                          type="button"
                          disabled={busy || !editDraft.trim()}
                          onClick={() => void saveEdit(n.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" /> Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-0.5 flex items-start justify-between gap-2">
                    <p className="text-sm text-foreground/90">{n.body}</p>
                    {canEdit(n) && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          aria-label="Edit note"
                          onClick={() => {
                            setEditingId(n.id);
                            setEditDraft(n.body);
                          }}
                          className="grid h-6 w-6 place-items-center rounded-md border text-muted-foreground transition hover:bg-muted"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete note"
                          onClick={() => void remove(n.id)}
                          className="grid h-6 w-6 place-items-center rounded-md border text-destructive transition hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
