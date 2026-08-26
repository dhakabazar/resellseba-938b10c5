import { useEffect, useMemo, useState } from "react";
import { loadTutorialLibrary, youtubeEmbed, youtubeThumb, type Tutorial, type TutorialTopic } from "@/lib/tutorials";
import { Loader2, PlayCircle, Search, Youtube } from "lucide-react";
import { AppModal } from "@/components/ui-kit/AppModal";

export function TutorialLibrary({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState<TutorialTopic[]>([]);
  const [videos, setVideos] = useState<Tutorial[]>([]);
  const [topic, setTopic] = useState<string>("all");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState<Tutorial | null>(null);

  useEffect(() => {
    (async () => {
      const data = await loadTutorialLibrary();
      setTopics(data.topics);
      setVideos(data.tutorials);
      setLoading(false);
    })();
  }, []);

  const usedTopics = useMemo(
    () => topics.filter((t) => videos.some((v) => v.topic_id === t.id)),
    [topics, videos],
  );

  const list = useMemo(() => {
    const q = term.trim().toLowerCase();
    return videos.filter((v) => {
      if (topic !== "all" && v.topic_id !== topic) return false;
      if (!q) return true;
      return `${v.title} ${v.details ?? ""}`.toLowerCase().includes(q);
    });
  }, [videos, topic, term]);

  const topicName = (id: string | null) => topics.find((t) => t.id === id)?.name ?? "General";

  if (loading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <Youtube className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-semibold">No tutorial yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Notun video tutorial add hole ekhane dekha jabe.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search tutorial…"
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <TopicChip active={topic === "all"} onClick={() => setTopic("all")} label={`All (${videos.length})`} />
          {usedTopics.map((t) => (
            <TopicChip
              key={t.id}
              active={topic === t.id}
              onClick={() => setTopic(t.id)}
              label={`${t.name} (${videos.filter((v) => v.topic_id === t.id).length})`}
            />
          ))}
        </div>
      </div>

      <div className={`grid gap-4 ${compact ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {list.map((v) => {
          const thumb = youtubeThumb(v.youtube_url, v.thumbnail_url);
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setOpen(v)}
              className="group overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition hover:border-primary/50 hover:shadow-md"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                {thumb ? (
                  <img src={thumb} alt={v.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : null}
                <span className="absolute inset-0 grid place-items-center bg-black/25 opacity-90">
                  <PlayCircle className="h-11 w-11 text-white drop-shadow" />
                </span>
                {v.duration_label ? (
                  <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-bold text-white">
                    {v.duration_label}
                  </span>
                ) : null}
              </div>
              <div className="space-y-1.5 p-3.5">
                <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                  {topicName(v.topic_id)}
                </span>
                <p className="line-clamp-2 text-sm font-bold">{v.title}</p>
                {v.details ? <p className="line-clamp-2 text-xs text-muted-foreground">{v.details}</p> : null}
              </div>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Ei filter e kono tutorial nai.
        </p>
      ) : null}

      {open ? <TutorialModal video={open} topic={topicName(open.topic_id)} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function TopicChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function TutorialModal({ video, topic, onClose }: { video: Tutorial; topic: string; onClose: () => void }) {
  const embed = youtubeEmbed(video.youtube_url);

  return (
    <AppModal
      size="lg"
      padded={false}
      onClose={onClose}
      title={video.title}
      badge={
        <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{topic}</span>
      }
      footer={
        <div className="flex justify-end">
          <a
            href={video.youtube_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-bold hover:bg-muted"
          >
            <Youtube className="h-4 w-4" /> YouTube te dekhun
          </a>
        </div>
      }
    >
      <div className="aspect-video w-full bg-black">
        {embed ? (
          <iframe
            key={video.id}
            src={embed}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-white/80">Invalid YouTube link</div>
        )}
      </div>
      {video.details ? (
        <div className="whitespace-pre-wrap p-4 text-sm text-muted-foreground">{video.details}</div>
      ) : null}
    </AppModal>
  );
}
