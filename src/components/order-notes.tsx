import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  MessageSquarePlus,
  Pencil,
  Trash2,
  X,
  Check,
  FileText,
  Clock,
  Printer,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const NOTE_WORD_LIMIT = 30;

export type NoteType = "process" | "invoice";

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
  note_type: NoteType;
};

export function parseNoteBody(rawBody: string, defaultType: NoteType = "process"): { body: string; type: NoteType } {
  if (rawBody.startsWith("[Invoice Note]")) {
    return {
      body: rawBody.replace(/^\[Invoice Note\]\s*/i, "").trim(),
      type: "invoice",
    };
  }
  if (rawBody.startsWith("[invoice]")) {
    return {
      body: rawBody.replace(/^\[invoice\]\s*/i, "").trim(),
      type: "invoice",
    };
  }
  return {
    body: rawBody.trim(),
    type: defaultType,
  };
}

function roleBadge(role: string) {
  if (role === "reseller") return "bg-primary/10 text-primary border border-primary/20";
  if (role === "admin" || role === "super_admin") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
  if (role === "customer") return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20";
  return "bg-muted text-muted-foreground border border-border";
}

function roleLabel(role: string) {
  if (role === "reseller") return "Reseller";
  if (role === "super_admin" || role === "admin") return "Admin";
  if (role === "customer") return "Customer (Checkout)";
  return "Staff";
}

export function OrderNotes({
  orderId,
  canWrite,
  authorRole,
  authorName,
  lockedHint,
  title = "Order Process & Invoice Notes",
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
  const [selectedType, setSelectedType] = useState<NoteType>("process");
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editType, setEditType] = useState<NoteType>("process");
  const [pinnedNotes, setPinnedNotes] = useState<
    { role: string; name: string | null; body: string; at: string; type: NoteType }[]
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

    const parsedNotes: OrderNote[] = ((data as any[]) ?? []).map((n) => {
      const parsed = parseNoteBody(n.body, (n.note_type as NoteType) || "process");
      return {
        ...n,
        body: parsed.body,
        note_type: (n.note_type as NoteType) || parsed.type,
      };
    });
    setNotes(parsedNotes);

    const o = ord as any;
    const pinned: { role: string; name: string | null; body: string; at: string; type: NoteType }[] = [];
    if (o) {
      const at = o.updated_at ?? o.created_at;
      // Customer note is an Invoice Note
      if (o.notes) {
        pinned.push({
          role: "customer",
          name: "Customer",
          body: o.notes,
          at,
          type: "invoice",
        });
      }
      if (o.admin_note) {
        pinned.push({
          role: "admin",
          name: "Admin",
          body: o.admin_note,
          at,
          type: "process",
        });
      }
      if (o.reseller_note) {
        pinned.push({
          role: "reseller",
          name: o.reseller?.business_name ?? "Reseller",
          body: o.reseller_note,
          at,
          type: "process",
        });
      }
    }
    setPinnedNotes(pinned);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = (n: OrderNote) =>
    canWrite && (authorRole !== "reseller" || n.author_id === user?.id);

  async function add() {
    const raw = draft.trim();
    if (!raw) return;
    setBusy(true);

    const formattedBody = selectedType === "invoice" ? `[Invoice Note] ${raw}` : raw;

    let err: any = null;
    try {
      const res = await supabase.from("order_notes").insert({
        order_id: orderId,
        author_id: user?.id ?? null,
        author_name: authorName ?? null,
        author_role: authorRole,
        body: formattedBody,
        ...({ note_type: selectedType } as any),
      });
      err = res.error;
      if (err && (err.message?.includes("note_type") || err.code === "42703")) {
        const retry = await supabase.from("order_notes").insert({
          order_id: orderId,
          author_id: user?.id ?? null,
          author_name: authorName ?? null,
          author_role: authorRole,
          body: formattedBody,
        });
        err = retry.error;
      }
    } catch (e) {
      err = e;
    }

    setBusy(false);
    if (err) {
      toast.error(err.message || "Failed to add note");
      return;
    }
    setDraft("");
    toast.success(selectedType === "invoice" ? "Invoice Note যোগ করা হয়েছে" : "Order Process Note যোগ করা হয়েছে");
    void load();
  }

  async function saveEdit(id: string) {
    const raw = editDraft.trim();
    if (!raw) return;
    setBusy(true);

    const formattedBody = editType === "invoice" ? `[Invoice Note] ${raw}` : raw;

    let err: any = null;
    try {
      const res = await supabase
        .from("order_notes")
        .update({
          body: formattedBody,
          ...({ note_type: editType } as any),
        })
        .eq("id", id)
        .select("id");
      err = res.error;
      if (err && (err.message?.includes("note_type") || err.code === "42703")) {
        const retry = await supabase
          .from("order_notes")
          .update({ body: formattedBody })
          .eq("id", id)
          .select("id");
        err = retry.error;
      }
    } catch (e) {
      err = e;
    }

    setBusy(false);
    if (err) {
      toast.error(err.message || "Failed to update note");
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
      {/* Card Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <MessageSquarePlus className="h-4 w-4" />
          {title}
        </h3>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {notes.length + pinnedNotes.length} note{notes.length + pinnedNotes.length === 1 ? "" : "s"} · max {NOTE_WORD_LIMIT} words
        </span>
      </div>

      <div className="space-y-4 p-4">
        {/* Input Box Area */}
        {canWrite ? (
          <div className="rounded-xl border bg-background p-3 shadow-sm">
            {/* Note Type Selector / Trigger Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b">
              <div className="flex items-center gap-1.5 p-0.5 bg-muted/60 rounded-lg border">
                <button
                  type="button"
                  onClick={() => setSelectedType("process")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    selectedType === "process"
                      ? "bg-sky-500 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  Order Process Note
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedType("invoice")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-black transition-all ${
                    selectedType === "invoice"
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="h-3 w-3" />
                  Invoice Note
                </button>
              </div>

              {/* Explanatory badge */}
              <span className="text-[11px] font-medium hidden sm:inline-block">
                {selectedType === "invoice" ? (
                  <span className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                    <Printer className="h-3 w-3" /> প্রিন্ট লেবেলে প্রদর্শিত হবে
                  </span>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> কাজের অগ্রগতি ট্র্যাকিং
                  </span>
                )}
              </span>
            </div>

            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(clampWords(e.target.value))}
              placeholder={
                selectedType === "invoice"
                  ? "ইনভয়েস নোট লিখুন (যেমন: ৫টার পরে ডেলিভারি, শুক্রবার বন্ধ, ইত্যাদি)…"
                  : "অর্ডার প্রসেস নোট লিখুন (অভ্যন্তরীণ কাজের অগ্রগতি, সাপ্লায়ার/রাইডার ফলোআপ)…"
              }
              className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />

            <div className="mt-2 flex items-center justify-between pt-1 border-t border-dashed">
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
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition shadow-sm disabled:opacity-50 active:scale-95 ${
                  selectedType === "invoice"
                    ? "bg-amber-500 text-slate-950 hover:bg-amber-400 font-black"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                {selectedType === "invoice" ? "+ Add Invoice Note" : "+ Add Process Note"}
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {lockedHint ?? "Notes are read-only for this order status."}
          </p>
        )}

        {/* Customer / Order Form Pinned Notes */}
        {pinnedNotes.length > 0 && (
          <div className="space-y-2">
            {pinnedNotes.map((p, i) => (
              <div
                key={i}
                className={`rounded-xl border p-3 ${
                  p.type === "invoice"
                    ? "bg-amber-500/5 border-amber-500/25"
                    : "bg-muted/20 border-dashed"
                }`}
              >
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  {/* Note Type Pill */}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      p.type === "invoice"
                        ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                        : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30"
                    }`}
                  >
                    {p.type === "invoice" ? "📄 Invoice Note" : "🔄 Process Note"}
                  </span>

                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${roleBadge(p.role)}`}>
                    {roleLabel(p.role)}
                  </span>
                  {p.name && <span className="font-semibold text-foreground/80">{p.name}</span>}
                  <span>·</span>
                  <span>{new Date(p.at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-sm text-foreground/90 font-medium whitespace-pre-wrap">{p.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Dynamic Timeline Notes */}
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading notes…
          </div>
        ) : notes.length === 0 && pinnedNotes.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">কোনো নোট যোগ করা হয়নি।</p>
        ) : (
          <ol className="relative space-y-4 border-l pl-4 mt-2">
            {notes.map((n) => (
              <li key={n.id} className="relative">
                <span
                  className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${
                    n.note_type === "invoice" ? "bg-amber-500" : "bg-sky-500"
                  }`}
                />

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  {/* Type Badge */}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      n.note_type === "invoice"
                        ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40"
                        : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30"
                    }`}
                  >
                    {n.note_type === "invoice" ? "📄 Invoice Note" : "🔄 Process Note"}
                  </span>

                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${roleBadge(n.author_role)}`}>
                    {roleLabel(n.author_role)}
                  </span>
                  {n.author_name && <span className="font-semibold text-foreground/80">{n.author_name}</span>}
                  <span>·</span>
                  <span>{new Date(n.created_at).toLocaleString()}</span>
                  {n.updated_at !== n.created_at && <span>· edited</span>}
                </div>

                {editingId === n.id ? (
                  <div className="mt-2 rounded-xl border bg-background p-2.5 shadow-sm">
                    {/* Toggle Type when editing */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <button
                        type="button"
                        onClick={() => setEditType("process")}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          editType === "process"
                            ? "bg-sky-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        Process
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditType("invoice")}
                        className={`px-2 py-0.5 rounded text-[11px] font-black ${
                          editType === "invoice"
                            ? "bg-amber-500 text-slate-950"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        Invoice
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      value={editDraft}
                      onChange={(e) => setEditDraft(clampWords(e.target.value))}
                      className="w-full resize-none bg-transparent text-sm outline-none"
                    />

                    <div className="mt-1.5 flex items-center justify-between border-t pt-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {countWords(editDraft)}/{NOTE_WORD_LIMIT} words
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-accent"
                        >
                          <X className="h-3 w-3" /> Cancel
                        </button>
                        <button
                          type="button"
                          disabled={busy || !editDraft.trim()}
                          onClick={() => void saveEdit(n.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" /> Save
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 flex items-start justify-between gap-2 p-1">
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {n.body}
                    </p>
                    {canEdit(n) && (
                      <div className="flex shrink-0 gap-1 opacity-80 hover:opacity-100">
                        <button
                          type="button"
                          aria-label="Edit note"
                          onClick={() => {
                            setEditingId(n.id);
                            setEditDraft(n.body);
                            setEditType(n.note_type || "process");
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
