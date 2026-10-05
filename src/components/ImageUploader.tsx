import { useRef, useState } from "react";
import { Upload, X, Loader2, Star, ChevronLeft, ChevronRight, GripHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateAndCompress } from "@/lib/image-upload";
import { toast } from "sonner";

export interface UploadedImage {
  path: string;
  url: string;
  bytes: number;
}

export function ImageUploader({
  bucket,
  folder,
  value,
  onChange,
  multiple = false,
  label = "Upload image",
  variant = "square",
  square = false,
  maxImages,
  hint,
}: {
  bucket: "product-images" | "branding";
  folder: string;
  value: UploadedImage[];
  onChange: (v: UploadedImage[]) => void;
  multiple?: boolean;
  label?: string;
  variant?: "square" | "wide" | "hero";
  square?: boolean;
  maxImages?: number;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isDragOverFiles, setIsDragOverFiles] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const remaining = maxImages ? Math.max(0, maxImages - value.length) : Infinity;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const list = Array.from(files).slice(0, remaining === Infinity ? files.length : remaining);
      if (maxImages && files.length > remaining) {
        toast.message(`Max ${maxImages} images — extra files skipped.`);
      }
      const out: UploadedImage[] = [];
      for (const f of list) {
        const compressed = await validateAndCompress(f, { square });
        const path = `${folder}/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage
          .from(bucket)
          .upload(path, compressed.blob, {
            contentType: "image/webp",
            cacheControl: "31536000",
            upsert: false,
          });
        if (error) throw error;
        const { data: signed } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
        out.push({
          path,
          url: signed?.signedUrl ?? "",
          bytes: compressed.bytes,
        });
      }
      onChange(multiple ? [...value, ...out] : out.slice(0, 1));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  async function remove(img: UploadedImage) {
    if (img.path) await supabase.storage.from(bucket).remove([img.path]).catch(() => {});
    onChange(value.filter((v) => v.path !== img.path || v.url !== img.url));
  }

  function setAsPrimary(idx: number) {
    if (idx <= 0 || idx >= value.length) return;
    const next = [...value];
    const [item] = next.splice(idx, 1);
    next.unshift(item);
    onChange(next);
    toast.success("মেইন ছবি হিসেবে সেট করা হয়েছে");
  }

  function moveImage(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= value.length || fromIdx === toIdx) return;
    const next = [...value];
    const [item] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, item);
    onChange(next);
    if (toIdx === 0) {
      toast.success("মেইন ছবি হিসেবে সেট করা হয়েছে");
    }
  }

  function handleCardDragStart(e: React.DragEvent, idx: number) {
    if (!multiple) return;
    e.dataTransfer.setData("text/plain", `${idx}`);
    e.dataTransfer.effectAllowed = "move";
    setDraggedIdx(idx);
  }

  function handleCardDragOver(e: React.DragEvent, idx: number) {
    if (!multiple || draggedIdx === null) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdx !== idx) {
      setDragOverIdx(idx);
    }
  }

  function handleCardDragLeave(e: React.DragEvent, idx: number) {
    if (!multiple) return;
    if (dragOverIdx === idx) {
      setDragOverIdx(null);
    }
  }

  function handleCardDrop(e: React.DragEvent, targetIdx: number) {
    if (!multiple || draggedIdx === null) return;
    e.preventDefault();
    e.stopPropagation();
    if (draggedIdx !== targetIdx) {
      const next = [...value];
      const [moved] = next.splice(draggedIdx, 1);
      next.splice(targetIdx, 0, moved);
      onChange(next);
      if (targetIdx === 0) {
        toast.success("মেইন ছবি হিসেবে সেট করা হয়েছে");
      }
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  }

  function handleCardDragEnd() {
    setDraggedIdx(null);
    setDragOverIdx(null);
  }

  const previewClass =
    variant === "hero"
      ? "h-44 w-full max-w-3xl"
      : variant === "wide"
      ? "h-32 w-full max-w-xl"
      : square
      ? "aspect-square w-28"
      : "h-24 w-24";

  const canAdd = (multiple || value.length === 0) && (maxImages ? value.length < maxImages : true);

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setIsDragOverFiles(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOverFiles(false);
        }
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          setIsDragOverFiles(false);
          handleFiles(e.dataTransfer.files);
        }
      }}
      className={`rounded-lg transition-colors ${
        isDragOverFiles ? "bg-primary/5 ring-2 ring-primary ring-dashed p-2" : ""
      }`}
    >
      <div className="mb-2 flex flex-wrap gap-3">
        {value.map((img, idx) => {
          const isPrimary = idx === 0;
          const isDragging = draggedIdx === idx;
          const isTarget = dragOverIdx === idx && draggedIdx !== idx;

          return (
            <div
              key={(img.path || img.url) + idx}
              draggable={multiple}
              onDragStart={(e) => handleCardDragStart(e, idx)}
              onDragOver={(e) => handleCardDragOver(e, idx)}
              onDragLeave={(e) => handleCardDragLeave(e, idx)}
              onDrop={(e) => handleCardDrop(e, idx)}
              onDragEnd={handleCardDragEnd}
              className={`group relative overflow-hidden rounded-md border bg-muted transition-all select-none ${previewClass} ${
                multiple ? "cursor-grab active:cursor-grabbing" : ""
              } ${isDragging ? "opacity-30 scale-95 border-dashed border-primary" : ""} ${
                isTarget ? "ring-2 ring-primary ring-offset-2 scale-105 shadow-md z-10" : ""
              } ${isPrimary && multiple ? "ring-2 ring-amber-500/80 border-amber-500/40" : ""}`}
            >
              <img
                src={img.url}
                className={`h-full w-full pointer-events-none ${square ? "object-cover" : "object-contain"}`}
                alt={`Image ${idx + 1}`}
              />

              {/* Top Bar: Primary Badge or Make Primary Button */}
              <div className="absolute left-1.5 top-1.5 z-10 flex items-center gap-1">
                {isPrimary && multiple ? (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                    <Star className="h-2.5 w-2.5 fill-current" /> Main
                  </span>
                ) : multiple ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAsPrimary(idx);
                    }}
                    title="মেইন ছবি হিসেবে সিলেক্ট করুন"
                    className="flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 shadow-sm backdrop-blur-xs transition group-hover:opacity-100 hover:bg-amber-500 hover:text-white"
                  >
                    <Star className="h-2.5 w-2.5" /> Make Main
                  </button>
                ) : null}
              </div>

              {/* Top Right: Delete Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(img);
                }}
                title="মুছে ফেলুন"
                className="absolute right-1.5 top-1.5 z-10 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {/* Bottom Quick-Action Bar (Reorder arrows + grip) */}
              {multiple && value.length > 1 && (
                <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between bg-gradient-to-t from-black/75 via-black/40 to-transparent px-1.5 py-1 text-white opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveImage(idx, idx - 1);
                    }}
                    title="আগের অবস্থানে নিন"
                    className="rounded p-0.5 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex items-center gap-0.5 text-[10px] font-medium text-white/90">
                    <GripHorizontal className="h-3.5 w-3.5 opacity-80" />
                    <span>{idx + 1}/{value.length}</span>
                  </div>
                  <button
                    type="button"
                    disabled={idx === value.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveImage(idx, idx + 1);
                    }}
                    title="পরের অবস্থানে নিন"
                    className="rounded p-0.5 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {canAdd && (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={busy}
            className={`flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-xs text-muted-foreground transition hover:border-primary hover:text-primary hover:bg-primary/5 disabled:opacity-50 ${previewClass}`}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span className="text-center font-medium">{busy ? "Processing…" : label}</span>
          </button>
        )}
      </div>

      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {multiple && value.length > 1 && (
        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            💡 ড্র্যাগ অ্যান্ড ড্রপ
          </span>
          <span>ছবি ড্র্যাগ করে পজিশন পরিবর্তন করুন বা ⭐ 'Make Main' বাটনে ক্লিক করে মেইন ছবি সিলেক্ট করুন।</span>
        </p>
      )}

      {hint !== "" && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {hint ??
            (square
              ? `1:1 square · auto-optimized${maxImages ? ` · up to ${maxImages} images` : ""}`
              : "Auto-optimized for fast loading")}
        </p>
      )}
    </div>
  );
}
