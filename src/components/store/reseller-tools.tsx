import { useEffect, useState } from "react";
import { Check, Copy, Download, ImageDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { borderc, cx, muted } from "@/components/store/ui";

/**
 * Reseller tools are hidden from normal customers.
 * They appear only when the visitor has a platform session (reseller / admin),
 * or when the URL carries ?tools=1 (handy for sharing a copy-ready link).
 */
export function useResellerTools() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("tools") === "1") {
        setOn(true);
        return;
      }
    } catch {
      /* noop */
    }
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setOn(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (alive) setOn(Boolean(s));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return on;
}

function fileNameFor(url: string, base: string, i: number) {
  const clean = base
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09FF]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "product";
  const ext = (url.split("?")[0].match(/\.(jpe?g|png|webp|gif|avif)$/i)?.[1] ?? "jpg").toLowerCase();
  return `${clean}-${i + 1}.${ext}`;
}

async function downloadOne(url: string, name: string) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
  } catch {
    // Cross-origin without CORS: open in a new tab so it can be saved manually.
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export const toolBtn =
  "inline-flex items-center gap-1.5 rounded-[var(--st-radius-sm)] border px-2.5 py-1.5 text-[11px] font-semibold transition hover:border-[var(--st-primary)] hover:text-[var(--st-primary)]";

export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  async function copy() {
    const text = value.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    toast.success(`${label ?? "Text"} copied`);
    setTimeout(() => setDone(false), 1600);
  }
  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy ${label ?? "text"}`}
      aria-label={`Copy ${label ?? "text"}`}
      className={cx(toolBtn, borderc, muted, "justify-center", className)}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {label && !className?.includes("rounded-full") ? <span>{done ? "Copied" : `Copy ${label}`}</span> : null}
    </button>
  );
}

export function ImageDownloadTools({
  images,
  activeUrl,
  baseName,
  compact,
}: {
  images: string[];
  activeUrl?: string | null;
  baseName: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState<"one" | "all" | null>(null);
  const list = images.filter(Boolean);
  if (list.length === 0) return null;

  async function one() {
    const url = activeUrl || list[0];
    setBusy("one");
    await downloadOne(url, fileNameFor(url, baseName, Math.max(0, list.indexOf(url))));
    setBusy(null);
  }

  async function all() {
    setBusy("all");
    for (let i = 0; i < list.length; i++) {
      await downloadOne(list[i], fileNameFor(list[i], baseName, i));
      await new Promise((r) => setTimeout(r, 350));
    }
    setBusy(null);
    toast.success(`${list.length} image downloaded`);
  }

  if (compact)
    return (
      <button
        type="button"
        onClick={one}
        title="Download this image"
        aria-label="Download this image"
        className="grid h-9 w-9 place-items-center rounded-full border-2 border-foreground/80 bg-destructive text-destructive-foreground shadow-lg transition hover:brightness-110 active:scale-95"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </button>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={one} className={cx(toolBtn, borderc, muted)}>
        {busy === "one" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        <span>This image</span>
      </button>
      {list.length > 1 && (
        <button type="button" onClick={all} className={cx(toolBtn, borderc, muted)}>
          {busy === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageDown className="h-3.5 w-3.5" />}
          <span>All {list.length} images</span>
        </button>
      )}
    </div>
  );
}

export function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
