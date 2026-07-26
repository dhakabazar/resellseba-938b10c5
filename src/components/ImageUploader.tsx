import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
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
    <div>
      <div className="mb-2 flex flex-wrap gap-3">
        {value.map((img, idx) => (
          <div
            key={(img.path || img.url) + idx}
            className={`group relative overflow-hidden rounded-md border bg-muted ${previewClass}`}
          >
            <img src={img.url} className={`h-full w-full ${square ? "object-cover" : "object-contain"}`} alt="" />
            <button
              type="button"
              onClick={() => remove(img)}
              className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {idx === 0 && multiple && (
              <div className="absolute left-1.5 top-1.5 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                Primary
              </div>
            )}
          </div>
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={busy}
            className={`flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50 ${previewClass}`}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {busy ? "Processing…" : label}
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
      {hint !== "" && (
        <p className="text-xs text-muted-foreground">
          {hint ??
            (square
              ? `1:1 square · auto-optimized${maxImages ? ` · up to ${maxImages} images` : ""}`
              : "Auto-optimized for fast loading")}
        </p>
      )}
    </div>
  );
}
