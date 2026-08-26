import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, CheckCircle2, Megaphone, X, ArrowRight, ChevronRight } from "lucide-react";
import type { AdminNotice, NoticeLevel } from "@/lib/admin-notices";

const LEVEL_STYLE: Record<
  NoticeLevel,
  { ring: string; chip: string; icon: React.ReactNode; label: string; glow: string }
> = {
  info: {
    ring: "border-primary/35",
    chip: "bg-primary-soft text-primary",
    icon: <Megaphone className="h-5 w-5" />,
    label: "Notice",
    glow: "from-primary/25",
  },
  success: {
    ring: "border-emerald-500/40",
    chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    icon: <CheckCircle2 className="h-5 w-5" />,
    label: "Good news",
    glow: "from-emerald-500/25",
  },
  warning: {
    ring: "border-amber-500/45",
    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    icon: <BellRing className="h-5 w-5" />,
    label: "Warning",
    glow: "from-amber-500/25",
  },
  critical: {
    ring: "border-rose-500/45",
    chip: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    icon: <AlertTriangle className="h-5 w-5" />,
    label: "Urgent",
    glow: "from-rose-500/25",
  },
};

/** Full-screen popup that walks the reseller through every unseen admin notice. */
export function AdminNoticePopup({
  notices,
  onDismiss,
}: {
  notices: AdminNotice[];
  onDismiss: (id: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [closed, setClosed] = useState<string[]>([]);

  const queue = useMemo(() => notices.filter((n) => !closed.includes(n.id)), [notices, closed]);
  const current = queue[Math.min(index, queue.length - 1)];

  useEffect(() => {
    if (index > 0 && index >= queue.length) setIndex(0);
  }, [index, queue.length]);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setClosed((c) => [...c, current.id]);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [current]);

  if (!current) return null;

  const style = LEVEL_STYLE[current.level] ?? LEVEL_STYLE.info;
  const hide = () => setClosed((c) => [...c, current.id]);
  const next = () => {
    if (queue.length > 1) setIndex((i) => (i + 1) % queue.length);
    else hide();
  };
  const acknowledge = () => {
    onDismiss(current.id);
    setIndex(0);
  };

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-background/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={hide}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-lg overflow-hidden rounded-2xl border ${style.ring} bg-card shadow-elegant animate-in zoom-in-95 slide-in-from-bottom-2 duration-200`}
      >
        <div className={`pointer-events-none absolute inset-x-0 -top-24 h-40 bg-gradient-to-b ${style.glow} to-transparent`} />

        <button
          onClick={hide}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border bg-background/80 text-muted-foreground transition hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        {current.image_url ? (
          <img src={current.image_url} alt="" className="h-40 w-full object-cover" loading="lazy" />
        ) : null}

        <div className="relative p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${style.chip}`}>{style.icon}</span>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {style.label}
              </div>
              <div className="text-[11px] text-muted-foreground/80">
                {new Date(current.created_at).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>
            {queue.length > 1 && (
              <span className="ml-auto mr-9 rounded-full border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {Math.min(index, queue.length - 1) + 1} / {queue.length}
              </span>
            )}
          </div>

          <h2 className="text-lg font-extrabold leading-snug">{current.title}</h2>
          {current.body ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{current.body}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {current.cta_url ? (
              <a
                href={current.cta_url}
                target={current.cta_url.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                className="btn-brand inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-elegant transition hover:opacity-90 active:scale-95"
              >
                {current.cta_label || "Learn more"} <ArrowRight className="h-4 w-4" />
              </a>
            ) : null}

            {current.is_dismissible ? (
              <button
                onClick={acknowledge}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90 active:scale-95"
              >
                <CheckCircle2 className="h-4 w-4" /> Got it
              </button>
            ) : null}

            {queue.length > 1 ? (
              <button
                onClick={next}
                className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-muted"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={hide}
                className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition hover:bg-muted"
              >
                Later
              </button>
            )}
          </div>

          {!current.is_dismissible && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              This notice stays until the admin turns it off.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
