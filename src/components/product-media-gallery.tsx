import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductVideo, VideoActionToolbar } from "@/components/product-video";
import { youtubeThumb } from "@/lib/tutorials";
import { cn } from "@/lib/utils";

type ProductMediaGalleryProps = {
  images: Array<string | null | undefined>;
  youtubeUrl?: string | null;
  fileUrl?: string | null;
  name: string;
  className?: string;
  frameClassName?: string;
  thumbnailClassName?: string;
  renderImageActions?: (activeUrl: string, images: string[]) => ReactNode;
};

export function ProductMediaGallery({
  images,
  youtubeUrl,
  fileUrl,
  name,
  className,
  frameClassName,
  thumbnailClassName,
  renderImageActions,
}: ProductMediaGalleryProps) {
  const imageUrls = useMemo(
    () => [...new Set(images.filter((url): url is string => Boolean(url)))],
    [images],
  );
  const hasVideo = Boolean(youtubeUrl || fileUrl);
  const [active, setActive] = useState<"video" | number>(imageUrls.length ? 0 : "video");
  const mediaKey = `${imageUrls.join("|")}|${youtubeUrl ?? ""}|${fileUrl ?? ""}`;

  useEffect(() => {
    setActive(imageUrls.length ? 0 : "video");
  }, [mediaKey, imageUrls.length]);

  const activeUrl = typeof active === "number" ? imageUrls[active] ?? null : null;
  const thumb = youtubeUrl ? youtubeThumb(youtubeUrl) : null;
  const mediaCount = imageUrls.length + (hasVideo ? 1 : 0);

  return (
    <div className={cn("min-w-0 max-w-full space-y-3 overflow-x-hidden", className)}>
      <div
        className={cn(
          "relative grid aspect-square w-full min-w-0 max-w-full place-items-center overflow-hidden rounded-xl border bg-muted",
          frameClassName,
        )}
      >
        {active === "video" && hasVideo ? (
          <ProductVideo
            youtubeUrl={youtubeUrl}
            fileUrl={fileUrl}
            name={name}
            className="flex h-full w-full min-w-0 max-w-full items-center justify-center overflow-hidden p-2 sm:p-4"
          />
        ) : activeUrl ? (
          <img src={activeUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-sm text-muted-foreground">No image</div>
        )}

        {activeUrl && renderImageActions?.(activeUrl, imageUrls)}
        {active === "video" && hasVideo && (
          <div className="absolute right-3 top-3 z-20">
            <VideoActionToolbar youtubeUrl={youtubeUrl} fileUrl={fileUrl} baseName={name} />
          </div>
        )}
      </div>

      {mediaCount > 1 && (
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
          {imageUrls.map((url, index) => (
            <Button
              key={`${url}-${index}`}
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setActive(index)}
              aria-label={`Image ${index + 1}`}
              className={cn(
                "h-16 w-16 flex-none overflow-hidden rounded-lg border-2 bg-muted p-0",
                active === index ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40",
                thumbnailClassName,
              )}
            >
              <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </Button>
          ))}

          {hasVideo && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setActive("video")}
              aria-label="Video"
              title="Video"
              className={cn(
                "relative h-16 w-16 flex-none overflow-hidden rounded-lg border-2 bg-muted p-0",
                active === "video" ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40",
                thumbnailClassName,
              )}
            >
              {thumb && <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
              <span className="absolute inset-0 grid place-items-center bg-foreground/45 text-background">
                <Play className="h-5 w-5 fill-current" />
              </span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
