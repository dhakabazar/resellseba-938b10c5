import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateAndCompress, TARGET_BYTES } from "@/lib/image-upload";
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
}: {
  bucket: "product-images" | "branding";
  folder: string;
  value: UploadedImage[];
  onChange: (v: UploadedImage[]) => void;
  multiple?: boolean;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const out: UploadedImage[] = [];
      for (const f of Array.from(files)) {
        const compressed = await validateAndCompress(f);
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
      toast.success(`Uploaded ${out.length} image(s) — auto-optimized to ≤200KB`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  async function remove(img: UploadedImage) {
    await supabase.storage.from(bucket).remove([img.path]).catch(() => {});
    onChange(value.filter((v) => v.path !== img.path));
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3">
        {value.map((img) => (
          <div
            key={img.path}
            className="group relative h-24 w-24 overflow-hidden rounded-md border bg-muted"
          >
            <img src={img.url} className="h-full w-full object-cover" alt="" />
            <button
              type="button"
              onClick={() => remove(img)}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[10px] text-white">
              {(img.bytes / 1024).toFixed(0)}KB
            </div>
          </div>
        ))}
        {(multiple || value.length === 0) && (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={busy}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {busy ? "Optimizing…" : label}
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
      <p className="text-xs text-muted-foreground">
        Auto-compressed to WebP ≤ {(TARGET_BYTES / 1024) | 0}KB · Malware/polyglot files
        rejected by magic-byte check.
      </p>
    </div>
  );
}
