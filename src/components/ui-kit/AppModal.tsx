import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE: Record<Size, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

/**
 * Global app modal: portal-rendered, sticky header/footer, scrollable body,
 * Escape + backdrop close, body scroll lock. Use everywhere for consistency.
 */
export function AppModal({
  open = true,
  title,
  subtitle,
  badge,
  size = "md",
  onClose,
  footer,
  children,
  bodyClassName = "",
  padded = true,
}: {
  open?: boolean;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  size?: Size;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
  padded?: boolean;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border bg-card shadow-2xl sm:rounded-2xl ${SIZE[size]}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title || badge ? (
          <div className="flex shrink-0 items-start justify-between gap-3 border-b bg-card px-4 py-3 sm:px-5">
            <div className="min-w-0">
              {badge ? <div className="mb-1">{badge}</div> : null}
              {title ? <h2 className="truncate text-base font-bold">{title}</h2> : null}
              {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className={`min-h-0 flex-1 overflow-y-auto ${padded ? "p-4 sm:p-5" : ""} ${bodyClassName}`}>{children}</div>

        {footer ? <div className="shrink-0 border-t bg-muted/25 px-4 py-3 sm:px-5">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
