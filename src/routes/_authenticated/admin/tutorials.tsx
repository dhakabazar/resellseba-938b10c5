import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { confirmAction } from "@/lib/confirm";
import { slugify, youtubeId, youtubeThumb, type Tutorial, type TutorialTopic } from "@/lib/tutorials";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Power, Youtube, FolderTree, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/tutorials")({
  component: AdminTutorialsPage,
  head: () => ({
    meta: [
      { title: "Video tutorials | Admin" },
      { name: "description", content: "Manage YouTube video tutorials and topics for the landing page and reseller panel." },
      { property: "og:title", content: "Video tutorials" },
      { property: "og:description", content: "Manage YouTube video tutorials and topics for resellers." },
    ],
  }),
});

const inp = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

type VideoDraft = {
  id?: string;
  topic_id: string;
  title: string;
  details: string;
  youtube_url: string;
  duration_label: string;
  sort_order: number;
  is_active: boolean;
  reseller_only: boolean;
};

type TopicDraft = { id?: string; name: string; description: string; sort_order: number; is_active: boolean };

const EMPTY_VIDEO: VideoDraft = {
  topic_id: "",
  title: "",
  details: "",
  youtube_url: "",
  duration_label: "",
  sort_order: 0,
  is_active: true,
  reseller_only: false,
};

const EMPTY_TOPIC: TopicDraft = { name: "", description: "", sort_order: 0, is_active: true };

function AdminTutorialsPage() {
  const [tab, setTab] = useState<"videos" | "topics">("videos");
  const [topics, setTopics] = useState<TutorialTopic[]>([]);
  const [videos, setVideos] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [videoDraft, setVideoDraft] = useState<VideoDraft | null>(null);
  const [topicDraft, setTopicDraft] = useState<TopicDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [t, v] = await Promise.all([
      supabase.from("tutorial_topics").select("*").order("sort_order").order("name"),
      supabase.from("tutorials").select("*").order("sort_order").order("created_at", { ascending: false }),
    ]);
    setTopics((t.data ?? []) as unknown as TutorialTopic[]);
    setVideos((v.data ?? []) as unknown as Tutorial[]);
    setLoading(false);
  }

  const shown = useMemo(
    () => (filter === "all" ? videos : videos.filter((v) => (filter === "none" ? !v.topic_id : v.topic_id === filter))),
    [videos, filter],
  );

  const topicName = (id: string | null) => topics.find((t) => t.id === id)?.name ?? "General";

  async function saveVideo() {
    if (!videoDraft) return;
    if (!videoDraft.title.trim()) return toast.error("Title dorkar");
    if (!youtubeId(videoDraft.youtube_url)) return toast.error("Valid YouTube link dao");
    setSaving(true);
    const payload = {
      topic_id: videoDraft.topic_id || null,
      title: videoDraft.title.trim(),
      details: videoDraft.details.trim() || null,
      youtube_url: videoDraft.youtube_url.trim(),
      duration_label: videoDraft.duration_label.trim() || null,
      sort_order: Number(videoDraft.sort_order) || 0,
      is_active: videoDraft.is_active,
      reseller_only: videoDraft.reseller_only,
    };
    const res = videoDraft.id
      ? await supabase.from("tutorials").update(payload as never).eq("id", videoDraft.id)
      : await supabase.from("tutorials").insert(payload as never);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(videoDraft.id ? "Tutorial updated" : "Tutorial added");
    setVideoDraft(null);
    void load();
  }

  async function saveTopic() {
    if (!topicDraft) return;
    if (!topicDraft.name.trim()) return toast.error("Topic name dorkar");
    setSaving(true);
    const payload = {
      name: topicDraft.name.trim(),
      slug: slugify(topicDraft.name),
      description: topicDraft.description.trim() || null,
      sort_order: Number(topicDraft.sort_order) || 0,
      is_active: topicDraft.is_active,
    };
    const res = topicDraft.id
      ? await supabase.from("tutorial_topics").update(payload as never).eq("id", topicDraft.id)
      : await supabase.from("tutorial_topics").insert(payload as never);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(topicDraft.id ? "Topic updated" : "Topic added");
    setTopicDraft(null);
    void load();
  }

  async function toggleVideo(v: Tutorial) {
    const { error } = await supabase.from("tutorials").update({ is_active: !v.is_active } as never).eq("id", v.id);
    if (error) return toast.error(error.message);
    void load();
  }

  async function removeVideo(v: Tutorial) {
    const ok = await confirmAction({
      title: "Delete tutorial?",
      description: `"${v.title}" delete hoye jabe. Ei kaj undo kora jabe na.`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    const { error } = await supabase.from("tutorials").delete().eq("id", v.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    void load();
  }

  async function removeTopic(t: TutorialTopic) {
    const ok = await confirmAction({
      title: "Delete topic?",
      description: `"${t.name}" delete hobe. Er video gulo "General" e chole jabe.`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    const { error } = await supabase.from("tutorial_topics").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    void load();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Video tutorials"
        description="Topic onujai YouTube tutorial add koro — landing page o reseller panel e dekha jabe."
        actions={
          <button
            type="button"
            onClick={() => (tab === "videos" ? setVideoDraft({ ...EMPTY_VIDEO }) : setTopicDraft({ ...EMPTY_TOPIC }))}
            className="btn-brand inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold"
          >
            <Plus className="h-4 w-4" /> {tab === "videos" ? "Add video" : "Add topic"}
          </button>
        }
      />

      <div className="flex gap-2">
        {(["videos", "topics"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-bold capitalize ${
              tab === t ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "videos" ? <Youtube className="h-4 w-4" /> : <FolderTree className="h-4 w-4" />} {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tab === "topics" ? (
        topics.length === 0 ? (
          <EmptyState title="No topic yet" description="Topic banao, tarpor video gulo topic onujai sajao." />
        ) : (
          <div className="space-y-2">
            {topics.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-bold">
                    {t.name}{" "}
                    <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {videos.filter((v) => v.topic_id === t.id).length} video
                    </span>
                    {!t.is_active ? <span className="ml-1 text-[11px] font-bold text-amber-600">hidden</span> : null}
                  </p>
                  {t.description ? <p className="text-xs text-muted-foreground">{t.description}</p> : null}
                </div>
                <div className="flex gap-1.5">
                  <IconBtn
                    label="Edit"
                    onClick={() =>
                      setTopicDraft({
                        id: t.id,
                        name: t.name,
                        description: t.description ?? "",
                        sort_order: t.sort_order,
                        is_active: t.is_active,
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn label="Delete" danger onClick={() => void removeTopic(t)}>
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
              </div>
            ))}
          </div>
        )
      ) : videos.length === 0 ? (
        <EmptyState title="No tutorial yet" description="YouTube link diye prothom tutorial add koro." />
      ) : (
        <>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            <Chip active={filter === "all"} onClick={() => setFilter("all")} label={`All (${videos.length})`} />
            {topics.map((t) => (
              <Chip
                key={t.id}
                active={filter === t.id}
                onClick={() => setFilter(t.id)}
                label={`${t.name} (${videos.filter((v) => v.topic_id === t.id).length})`}
              />
            ))}
            <Chip active={filter === "none"} onClick={() => setFilter("none")} label={`General (${videos.filter((v) => !v.topic_id).length})`} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((v) => {
              const thumb = youtubeThumb(v.youtube_url, v.thumbnail_url);
              return (
                <div key={v.id} className="overflow-hidden rounded-xl border bg-card">
                  <div className="aspect-video w-full bg-muted">
                    {thumb ? <img src={thumb} alt={v.title} loading="lazy" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                        {topicName(v.topic_id)}
                      </span>
                      {!v.is_active ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600">hidden</span>
                      ) : null}
                      {v.reseller_only ? (
                        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold text-sky-600">reseller only</span>
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-sm font-bold">{v.title}</p>
                    {v.details ? <p className="line-clamp-2 text-xs text-muted-foreground">{v.details}</p> : null}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <IconBtn
                        label="Edit"
                        onClick={() =>
                          setVideoDraft({
                            id: v.id,
                            topic_id: v.topic_id ?? "",
                            title: v.title,
                            details: v.details ?? "",
                            youtube_url: v.youtube_url,
                            duration_label: v.duration_label ?? "",
                            sort_order: v.sort_order,
                            is_active: v.is_active,
                            reseller_only: v.reseller_only,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn label={v.is_active ? "Hide" : "Show"} onClick={() => void toggleVideo(v)}>
                        <Power className="h-4 w-4" />
                      </IconBtn>
                      <a
                        href={v.youtube_url}
                        target="_blank"
                        rel="noreferrer"
                        title="Open on YouTube"
                        className="grid h-9 w-9 place-items-center rounded-lg border hover:bg-muted"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <IconBtn label="Delete" danger onClick={() => void removeVideo(v)}>
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {videoDraft ? (
        <Modal title={videoDraft.id ? "Edit tutorial" : "Add tutorial"} onClose={() => setVideoDraft(null)}>
          <div className="space-y-3">
            <Field label="Title">
              <input className={inp} value={videoDraft.title} onChange={(e) => setVideoDraft({ ...videoDraft, title: e.target.value })} />
            </Field>
            <Field label="YouTube link">
              <input
                className={inp}
                placeholder="https://www.youtube.com/watch?v=…"
                value={videoDraft.youtube_url}
                onChange={(e) => setVideoDraft({ ...videoDraft, youtube_url: e.target.value })}
              />
            </Field>
            <Field label="Topic">
              <select className={inp} value={videoDraft.topic_id} onChange={(e) => setVideoDraft({ ...videoDraft, topic_id: e.target.value })}>
                <option value="">General (no topic)</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Details">
              <textarea
                rows={4}
                className={inp}
                value={videoDraft.details}
                onChange={(e) => setVideoDraft({ ...videoDraft, details: e.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Duration label (optional)">
                <input
                  className={inp}
                  placeholder="8:24"
                  value={videoDraft.duration_label}
                  onChange={(e) => setVideoDraft({ ...videoDraft, duration_label: e.target.value })}
                />
              </Field>
              <Field label="Sort order">
                <input
                  type="number"
                  className={inp}
                  value={videoDraft.sort_order}
                  onChange={(e) => setVideoDraft({ ...videoDraft, sort_order: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Toggle
              label="Active (show publicly)"
              checked={videoDraft.is_active}
              onChange={(v) => setVideoDraft({ ...videoDraft, is_active: v })}
            />
            <Toggle
              label="Reseller only (landing page e dekhabe na)"
              checked={videoDraft.reseller_only}
              onChange={(v) => setVideoDraft({ ...videoDraft, reseller_only: v })}
            />
          </div>
          <ModalActions saving={saving} onCancel={() => setVideoDraft(null)} onSave={() => void saveVideo()} />
        </Modal>
      ) : null}

      {topicDraft ? (
        <Modal title={topicDraft.id ? "Edit topic" : "Add topic"} onClose={() => setTopicDraft(null)}>
          <div className="space-y-3">
            <Field label="Topic name">
              <input className={inp} value={topicDraft.name} onChange={(e) => setTopicDraft({ ...topicDraft, name: e.target.value })} />
            </Field>
            <Field label="Description">
              <textarea
                rows={3}
                className={inp}
                value={topicDraft.description}
                onChange={(e) => setTopicDraft({ ...topicDraft, description: e.target.value })}
              />
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                className={inp}
                value={topicDraft.sort_order}
                onChange={(e) => setTopicDraft({ ...topicDraft, sort_order: Number(e.target.value) })}
              />
            </Field>
            <Toggle label="Active" checked={topicDraft.is_active} onChange={(v) => setTopicDraft({ ...topicDraft, is_active: v })} />
          </div>
          <ModalActions saving={saving} onCancel={() => setTopicDraft(null)} onSave={() => void saveTopic()} />
        </Modal>
      ) : null}
    </div>
  );
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold ${
        active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center rounded-lg border hover:bg-muted ${danger ? "text-destructive" : ""}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}

function ModalActions({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="rounded-lg border px-3.5 py-2 text-sm font-bold hover:bg-muted">
        Cancel
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="btn-brand inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
      </button>
    </div>
  );
}
