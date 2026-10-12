import { useHeaderScroll } from "./use-header-scroll";
import { cx } from "./ui";

/**
 * Announcement strip shared by theme headers. Instead of mounting/unmounting
 * (which causes an abrupt layout jump on scroll), it always renders and
 * animates height + opacity so the hide/show on scroll is smooth.
 */
export function AnnouncementStrip({ text, className }: { text: string; className?: string }) {
  const scrolled = useHeaderScroll();
  return (
    <div
      aria-hidden={scrolled || undefined}
      className={cx(
        "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
        scrolled ? "max-h-0 opacity-0" : "max-h-16 opacity-100",
      )}
    >
      <div className={className}>{text}</div>
    </div>
  );
}
