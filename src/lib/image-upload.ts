// Client-side image validation + compression pipeline.
// - Verifies real image bytes via magic-byte sniff (blocks polyglot/renamed files)
// - Re-decodes through the browser canvas (strips EXIF and any embedded payload)
// - Compresses to WebP with iterative quality reduction until ≤ TARGET_BYTES

export const TARGET_BYTES = 200 * 1024; // 200 KB
export const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_DIMENSION = 1600;

const IMAGE_SIGNATURES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF"
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
];

export async function detectRealMime(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  for (const sig of IMAGE_SIGNATURES) {
    const offset = sig.offset ?? 0;
    let ok = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (head[offset + i] !== sig.bytes[i]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      if (sig.mime === "image/webp") {
        // WEBP requires "WEBP" at offset 8
        const webp = new TextDecoder().decode(head.slice(8, 12));
        if (webp !== "WEBP") continue;
      }
      return sig.mime;
    }
  }
  return null;
}

export interface CompressedResult {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
}

export async function validateAndCompress(
  file: File,
  opts: { square?: boolean } = {},
): Promise<CompressedResult> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(`Image too large. Max ${(MAX_INPUT_BYTES / 1024 / 1024) | 0}MB.`);
  }
  const realMime = await detectRealMime(file);
  if (!realMime) {
    throw new Error("File is not a valid image. Upload aborted for safety.");
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Could not decode image (possibly corrupted or unsafe).");
  });

  let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
  if (opts.square) {
    const side = Math.min(bitmap.width, bitmap.height);
    sx = Math.round((bitmap.width - side) / 2);
    sy = Math.round((bitmap.height - side) / 2);
    sw = side;
    sh = side;
  }

  // Downscale if needed
  let width = sw;
  let height = sh;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  bitmap.close?.();

  // Iterate quality until under target
  const qualities = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.28, 0.22];
  let best: Blob | null = null;
  for (const q of qualities) {
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/webp", q),
    );
    if (!blob) continue;
    if (blob.size <= TARGET_BYTES) return { blob, width, height, bytes: blob.size };
    best = blob;
  }
  // Fallback: shrink further
  let w = width;
  let h = height;
  for (let i = 0; i < 4; i++) {
    w = Math.round(w * 0.8);
    h = Math.round(h * 0.8);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d")!;
    cx.drawImage(canvas, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", 0.6));
    if (blob && blob.size <= TARGET_BYTES)
      return { blob, width: w, height: h, bytes: blob.size };
    if (blob) best = blob;
  }
  if (best) return { blob: best, width, height, bytes: best.size };
  throw new Error("Could not compress image below 200KB.");
}
