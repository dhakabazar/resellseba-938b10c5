import { HelpCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";

/**
 * Hint icon — shows an explanation on hover (desktop) or tap (mobile).
 * Global, reusable. Text prop e jekono string ba node dite paren.
 */
export function Hint({
  children,
  className = "",
  side = "top",
}: {
  children: React.ReactNode;
  className?: string;
  side?: "top" | "bottom" | "right" | "left";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pos =
    side === "bottom"
      ? "top-full mt-2 left-1/2 -translate-x-1/2"
      : side === "right"
        ? "left-full ml-2 top-1/2 -translate-y-1/2"
        : side === "left"
          ? "right-full mr-2 top-1/2 -translate-y-1/2"
          : "bottom-full mb-2 left-1/2 -translate-x-1/2";

  return (
    <span ref={ref} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-primary"
        aria-label="Hint"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          className={`pointer-events-none absolute z-[9999] w-max max-w-[200px] break-words rounded-lg border border-white/20 bg-black/80 backdrop-blur-xl px-3 py-2 text-[11px] font-medium leading-tight text-white shadow-2xl ring-1 ring-white/10 ${pos}`}
        >
          {children}
        </span>
      )}
    </span>
  );
}
