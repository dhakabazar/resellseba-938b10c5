import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { AdminNoticePopup } from "@/components/admin-notice-popup";
import { NOTICE_LEVELS, type AdminNotice, type NoticeLevel } from "@/lib/admin-notices";
import { confirmAction } from "@/lib/confirm";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Eye, Power } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/notices")({
  component: AdminNoticesPage,
  head: () => ({
    meta: [
      { title: "Admin notices | Reseller platform" },
      { name: "description", content: "Create dashboard popup notices for your resellers." },
      { property: "og:title", content: "Admin notices" },
      { property: "og:description", content: "Create dashboard popup notices for your resellers." },
    ],
  }),
});

type Draft = {
  id?: string;
  title: string;
  body: string;
  level: NoticeLevel;
  is_active: boolean;
  is_dismissible: boolean;
  starts_at: string;
  ends_at: string;
  cta_label: string;
  cta_url: string;
  image_url: string;
  target_reseller_ids: string[];
};

const EMPTY: Draft = {
  title: "",
  body: "",
  level: "info",
  is_active: true,
  is_dismissible: true,
  starts_at: "",
  ends_at: "",
  cta_label: "",
  cta_url: "",
  image_url: "",
  target_reseller_ids: [],
};

const inp = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function toLocalInput(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AdminNoticesPage() {
  const [rows, setRows] = useState<AdminNotice[]>([]);
  const [resellers, setResellers] = useState<{ id: string; business_name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<AdminNotice | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [n, r] = await Promise.all([
      supabase.from("admin_notices").select("*").order("created_at", { ascending: false }),
      supabase.from("resellers").select("id,business_name,code").order("business_name"),
    ]);
    setRows((n.data ?? []) as unknown as AdminNotice[]);
    setResellers((r.data ?? []) as any[]);
    setLoading(false);
  }

  async function save() {
    if (!draft) return;
    if (!draft.title.trim()) return toast.error("Title dorkar");
    setSaving(true);
    const payload = {
      title: draft.title.trim(),
      body: draft.body,
      level: draft.level,
      is_active: draft.is_active,
      is_dismissible: draft.is_dismissible,
      starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
      ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
      cta_label: draft.cta_label.trim() || null,
      cta_url: draft.cta_url.trim() || null,
      image_url: draft.image_url.trim() || null,
      target_reseller_ids: draft.target_reseller_ids,
    };
    const { error } = draft.id
      ? await supabase.from("admin_notices").update(payload).eq("id", draft.id)
      : await supabase.from("admin_notices").insert(payload as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(draft.id ? "Notice updated" : "Notice published");
    setDraft(null);
    void load();
  }

  async function toggle(n: AdminNotice) {
    const { error } = await supabase.from("admin_notices").update({ is_active: !n.is_active }).eq("id", n.id);
    if (error) return toast.error(error.message);
    void load();
  }

  async function remove(n: AdminNotice) {
    const ok = await confirmAction({
      title: "Delete notice?",
      description: `"${n.title}" will disappear from every reseller dashboard.`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    const { error } = await supabase.from("admin_notices").delete().eq("id", n.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    void load();
  }

  const liveCount = useMemo(() => rows.filter((r) => r.is_active).length, [rows]);

  return (
    <div>
      <PageHeader
        title="Admin notices"
        description="Publish a popup that greets resellers on their dashboard."
        actions={
          <button
            onClick={() => setDraft({ ...EMPTY })}
            className="btn-brand inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-elegant transition hover:opacity-90 active:scale-95"
          >
            <Plus className="h-4 w-4" /> New notice
          </button>
        }
      />

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No notices yet"
          description="Create your first notice — resellers will see it as a popup on their dashboard."
        />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {liveCount} live of {rows.length} total
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((n) => {
              const meta = NOTICE_LEVELS.find((l) => l.value === n.level);
              return (
                <div key={n.id} className="surface-card p-5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                          {meta?.label ?? n.level}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            n.is_active
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {n.is_active ? "Live" : "Off"}
                        </span>
                        {n.target_reseller_ids?.length ? (
                          <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                            {n.target_reseller_ids.length} reseller targeted
                          </span>
                        ) : (
                          <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                            All resellers
                          </span>
                        )}
                      </div>
                      <h3 className="truncate font-bold">{n.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground/80">
                        {n.starts_at ? `From ${new Date(n.starts_at).toLocaleString()}` : "From now"}
                        {n.ends_at ? ` · until ${new Date(n.ends_at).toLocaleString()}` : " · no end date"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => setPreview(n)}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </button>
                    <button
                      onClick={() =>
                        setDraft({
                          id: n.id,
                          title: n.title,
                          body: n.body ?? "",
                          level: n.level,
                          is_active: n.is_active,
                          is_dismissible: n.is_dismissible,
                          starts_at: toLocalInput(n.starts_at),
                          ends_at: toLocalInput(n.ends_at),
                          cta_label: n.cta_label ?? "",
                          cta_url: n.cta_url ?? "",
                          image_url: n.image_url ?? "",
                          target_reseller_ids: n.target_reseller_ids ?? [],
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => toggle(n)}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      <Power className="h-3.5 w-3.5" /> {n.is_active ? "Turn off" : "Turn on"}
                    </button>
                    <button
                      onClick={() => remove(n)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {draft && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
          onClick={() => setDraft(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-xl modal-scroll rounded-2xl border bg-card p-6 shadow-elegant"
          >
            <h2 className="mb-4 text-lg font-extrabold">{draft.id ? "Edit notice" : "New notice"}</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold">Title</label>
                <input className={inp} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Message</label>
                <textarea
                  rows={5}
                  className={inp}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Type</label>
                  <select
                    className={inp}
                    value={draft.level}
                    onChange={(e) => setDraft({ ...draft, level: e.target.value as NoticeLevel })}
                  >
                    {NOTICE_LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Image URL (optional)</label>
                  <input
                    className={inp}
                    value={draft.image_url}
                    onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Button label</label>
                  <input
                    className={inp}
                    value={draft.cta_label}
                    onChange={(e) => setDraft({ ...draft, cta_label: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Button link</label>
                  <input
                    className={inp}
                    placeholder="/reseller/catalog"
                    value={draft.cta_url}
                    onChange={(e) => setDraft({ ...draft, cta_url: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Show from</label>
                  <input
                    type="datetime-local"
                    className={inp}
                    value={draft.starts_at}
                    onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Show until</label>
                  <input
                    type="datetime-local"
                    className={inp}
                    value={draft.ends_at}
                    onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">
                  Target resellers (none selected = everyone)
                </label>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {resellers.map((r) => {
                    const on = draft.target_reseller_ids.includes(r.id);
                    return (
                      <label key={r.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setDraft({
                              ...draft,
                              target_reseller_ids: on
                                ? draft.target_reseller_ids.filter((id) => id !== r.id)
                                : [...draft.target_reseller_ids, r.id],
                            })
                          }
                        />
                        <span className="truncate">
                          {r.business_name} <span className="text-muted-foreground">/{r.code}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.is_active}
                    onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  />
                  Live now
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.is_dismissible}
                    onChange={(e) => setDraft({ ...draft, is_dismissible: e.target.checked })}
                  />
                  Reseller can mark as read
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDraft(null)} className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="btn-brand inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} {draft.id ? "Save" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && <AdminNoticePopup notices={[preview]} onDismiss={() => setPreview(null)} />}
    </div>
  );
}
