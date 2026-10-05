import { useState } from "react";
import { Check, Copy, Download, ExternalLink, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { youtubeEmbed, youtubeId } from "@/lib/tutorials";

function safeName(base: string) {
  return (
    base
      .toLowerCase()
      .replace(/[^a-z0-9\u0980-\u09FF]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product"
  );
}

export function VideoDownloadButton({
  fileUrl,
  youtubeUrl,
  baseName,
  className,
}: {
  fileUrl?: string | null;
  youtubeUrl?: string | null;
  baseName: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function download(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (fileUrl) {
      setBusy(true);
      try {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error("Download failed");
        const blob = await res.blob();
        const ext = (fileUrl.split("?")[0]?.split(".").pop() || "mp4").slice(0, 5);
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `${safeName(baseName)}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
        toast.success("ভিডিও ডাউনলোড শুরু হয়েছে");
      } catch {
        toast.error("ভিডিও ফাইল ডাউনলোড করা যায়নি");
      } finally {
        setBusy(false);
      }
    } else if (youtubeUrl) {
      const id = youtubeId(youtubeUrl);
      const cleanUrl = id ? `https://www.youtube.com/watch?v=${id}` : youtubeUrl;
      const downloadUrl = id ? `https://ssyoutube.com/watch?v=${id}` : `https://ssyoutube.com/${youtubeUrl}`;

      try {
        await navigator.clipboard.writeText(cleanUrl);
      } catch {}

      window.open(downloadUrl, "_blank", "noopener,noreferrer");
      toast.success("ভিডিও ডাউনলোড পেজ ওপেন হয়েছে (লিঙ্ক কপি করা হয়েছে)");
    }
  }

  if (!fileUrl && !youtubeUrl) return null;

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      title={fileUrl ? "ভিডিও ডাউনলোড করুন" : "ইউটিউব ভিডিও ডাউনলোড করুন"}
      className={
        className ??
        "inline-flex items-center gap-1 rounded-md border bg-card/90 px-2 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur hover:border-primary/50 hover:text-primary disabled:opacity-60"
      }
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      <span>Download</span>
    </button>
  );
}

export function CopyVideoLinkButton({ url, className }: { url: string; className?: string }) {
  const [done, setDone] = useState(false);

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const id = youtubeId(url);
      const cleanUrl = id ? `https://www.youtube.com/watch?v=${id}` : url;
      await navigator.clipboard.writeText(cleanUrl);
      setDone(true);
      toast.success("ভিডিওর YouTube লিঙ্ক কপি হয়েছে");
      setTimeout(() => setDone(false), 2000);
    } catch {
      toast.error("লিঙ্ক কপি করা যায়নি");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="ভিডিওর YouTube লিঙ্ক কপি করুন"
      className={
        className ??
        "inline-flex items-center gap-1 rounded-md border bg-card/90 px-2 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur hover:border-primary/50 hover:text-primary"
      }
    >
      {done ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      <span>{done ? "Copied!" : "Copy link"}</span>
    </button>
  );
}

export function OpenYouTubeButton({ url, className }: { url: string; className?: string }) {
  const id = youtubeId(url);
  const cleanUrl = id ? `https://www.youtube.com/watch?v=${id}` : url;

  return (
    <a
      href={cleanUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="YouTube-এ ভিডিওটি ওপেন করুন"
      onClick={(e) => e.stopPropagation()}
      className={
        className ??
        "inline-flex items-center gap-1 rounded-md border bg-card/90 px-2 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur hover:border-primary/50 hover:text-primary"
      }
    >
      <ExternalLink className="h-3.5 w-3.5" />
      <span>YouTube</span>
    </a>
  );
}

export function VideoActionToolbar({
  youtubeUrl,
  fileUrl,
  baseName,
  className,
}: {
  youtubeUrl?: string | null;
  fileUrl?: string | null;
  baseName: string;
  className?: string;
}) {
  if (!youtubeUrl && !fileUrl) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`}>
      {youtubeUrl && <CopyVideoLinkButton url={youtubeUrl} />}
      {(fileUrl || youtubeUrl) && (
        <VideoDownloadButton fileUrl={fileUrl} youtubeUrl={youtubeUrl} baseName={baseName} />
      )}
      {youtubeUrl && <OpenYouTubeButton url={youtubeUrl} />}
    </div>
  );
}

/**
 * Product video block: YouTube embed and/or uploaded file with 1-click download & copy.
 * Renders nothing when the product has no video.
 */
export function ProductVideo({
  youtubeUrl,
  fileUrl,
  name,
  className,
}: {
  youtubeUrl?: string | null;
  fileUrl?: string | null;
  name: string;
  className?: string;
}) {
  const embed = youtubeUrl ? youtubeEmbed(youtubeUrl) : null;
  if (!embed && !fileUrl) return null;

  const vertical = !!youtubeUrl && /\/shorts\/|\/reel|[?&]feature=shorts/i.test(youtubeUrl);
  const ratio = vertical
    ? "aspect-[9/16] w-full max-w-[240px] sm:max-w-[280px]"
    : "aspect-video w-full";

  return (
    <div className={className ?? "min-w-0 max-w-full space-y-2 overflow-hidden"}>
      <div
        className={`relative min-w-0 max-w-full overflow-hidden rounded-xl border bg-black ${
          vertical ? "mx-auto max-w-[240px] sm:max-w-[280px]" : ""
        }`}
      >
        {embed ? (
          <iframe
            src={embed}
            title={`${name} video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className={`block min-w-0 max-w-full ${ratio}`}
          />
        ) : (
          <video src={fileUrl ?? undefined} controls preload="metadata" className={`block min-w-0 max-w-full bg-black ${ratio}`} />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
            <Play className="h-3 w-3 fill-current text-primary" /> Video
          </span>
          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5">
            {youtubeUrl && <CopyVideoLinkButton url={youtubeUrl} />}
            <VideoDownloadButton fileUrl={fileUrl} youtubeUrl={youtubeUrl} baseName={name} />
          </div>
        </div>
      </div>
      {embed && fileUrl && (
        <video src={fileUrl} controls preload="metadata" className="aspect-video w-full rounded-xl border bg-black" />
      )}
    </div>
  );
}
