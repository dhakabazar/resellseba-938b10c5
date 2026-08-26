import { useEffect, useState } from "react";
import { Check, Download, Images, Loader2, X } from "lucide-react";
import { toast } from "sonner";

function fileNameFor(url: string, base: string, i: number) {
  const clean =
    base
      .toLowerCase()
      .replace(/[^a-z0-9\u0980-\u09FF]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "product";
  const ext = (url.split("?")[0].match(/\.(jpe?g|png|webp|gif|avif)$/i)?.[1] ?? "jpg").toLowerCase();
  return `${clean}-${i + 1}.${ext}`;
}

async function downloadOne(url: string, name: string) {
  let href = url;
  let revoke = false;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (res.ok) {
      href = URL.createObjectURL(await res.blob());
      revoke = true;
    }
  } catch {
    /* fall back to direct link */
  }
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.rel = "noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(href), 4000);
}

/** Click → popup with every product image → select → direct download (no navigation). */
export function ImagePickerButton({
  images,
  baseName,
  className,
  compact,
}: {
  images: string[];
  baseName: string;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const list = images.filter(Boolean);
  if (list.length === 0) return null;

  return (
    <>
      <button
        type="button"
        title="Download images"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          className ??
          "inline-flex items-center gap-1 rounded-lg border bg-card/90 px-2 py-1.5 text-[11px] font-semibold shadow-sm backdrop-blur hover:border-primary/50 hover:text-primary"
        }
      >
        <Download className="h-3.5 w-3.5" /> {compact ? null : "Image"}
      </button>
      {open && <ImagePickerModal images={list} baseName={baseName} onClose={() => setOpen(false)} />}
    </>
  );
}

function ImagePickerModal({
  images,
  baseName,
  onClose,
}: {
  images: string[];
  baseName: string;
  onClose: () => void;
}) {
  const [sel, setSel] = useState<Set<number>>(new Set(images.map((_, i) => i)));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(i: number) {
    setSel((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function download() {
    const picked = [...sel].sort((a, b) => a - b);
    if (picked.length === 0) {
      toast.error("অন্তত ১টি ছবি সিলেক্ট করুন");
      return;
    }
    setBusy(true);
    for (const i of picked) {
      await downloadOne(images[i], fileNameFor(images[i], baseName, i));
      await new Promise((r) => setTimeout(r, 300));
    }
    setBusy(false);
    toast.success(`${picked.length} image downloaded`);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Images className="h-4 w-4 text-primary" /> ছবি সিলেক্ট করুন ({sel.size}/{images.length})
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[55vh] modal-scroll p-4">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((u, i) => {
              const on = sel.has(i);
              return (
                <button
                  key={u + i}
                  type="button"
                  onClick={() => toggle(i)}
                  className={`relative aspect-square overflow-hidden rounded-xl border-2 transition ${
                    on ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                  }`}
                >
                  <img src={u} alt={`${baseName} ${i + 1}`} className="h-full w-full object-cover" />
                  {on && (
                    <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
          <div className="flex gap-2 text-[11px] font-semibold">
            <button type="button" onClick={() => setSel(new Set(images.map((_, i) => i)))} className="rounded-lg border px-2.5 py-1.5 hover:border-primary/50">
              Select all
            </button>
            <button type="button" onClick={() => setSel(new Set())} className="rounded-lg border px-2.5 py-1.5 hover:border-primary/50">
              Clear
            </button>
          </div>
          <button
            type="button"
            onClick={download}
            disabled={busy}
            className="btn-brand inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download ({sel.size})
          </button>
        </div>
      </div>
    </div>
  );
}
