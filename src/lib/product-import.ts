/** Client-side glue for the "Import product from URL" flow. */
import { supabase } from "@/integrations/supabase/client";
import { validateAndCompress } from "@/lib/image-upload";
import type { UploadedImage } from "@/components/ImageUploader";
import type { ImportedProduct } from "@/lib/product-import.server";

export type { ImportedProduct };

const DRAFT_KEY = "product-import-draft";

export interface ImportDraft extends Omit<ImportedProduct, "images"> {
  images: UploadedImage[];
}

export function saveImportDraft(draft: ImportDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* storage disabled — draft is simply skipped */
  }
}

export function takeImportDraft(): ImportDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(DRAFT_KEY);
    return JSON.parse(raw) as ImportDraft;
  } catch {
    return null;
  }
}

/**
 * Pulls remote images through the server, re-encodes them in the browser
 * (magic-byte check + canvas re-draw + ≤200KB WebP) and uploads to storage.
 * Any image that fails is skipped rather than aborting the whole import.
 */
export async function importImagesToStorage(
  urls: string[],
  fetchImage: (args: { data: { url: string } }) => Promise<{ base64: string; mime: string }>,
  max = 6,
): Promise<UploadedImage[]> {
  const out: UploadedImage[] = [];
  for (const url of urls.slice(0, max)) {
    try {
      const { base64, mime } = await fetchImage({ data: { url } });
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const file = new File([bytes], "import.bin", { type: mime });
      const compressed = await validateAndCompress(file, { square: true });
      const path = `master/${crypto.randomUUID()}.webp`;
      const { error } = await supabase.storage.from("product-images").upload(path, compressed.blob, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("product-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      out.push({ path, url: signed?.signedUrl ?? "", bytes: compressed.bytes });
    } catch {
      /* skip unusable image */
    }
  }
  return out;
}
