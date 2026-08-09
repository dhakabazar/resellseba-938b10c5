import { HelpCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Hint icon — shows an explanation on hover (desktop) or tap (mobile).
 * Uses a portal to ensure it stays above all other elements and doesn't get clipped.
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
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;

      let top = 0;
      let left = 0;

      if (side === "top") {
        top = rect.top + scrollY - 8;
        left = rect.left + scrollX + rect.width / 2;
      } else if (side === "bottom") {
        top = rect.bottom + scrollY + 8;
        left = rect.left + scrollX + rect.width / 2;
      } else if (side === "left") {
        top = rect.top + scrollY + rect.height / 2;
        left = rect.left + scrollX - 8;
      } else if (side === "right") {
        top = rect.top + scrollY + rect.height / 2;
        left = rect.right + scrollX + 8;
      }

      setCoords({ top, left });
    }
  };

  useEffect(() => {
    if (open) {
      updatePosition();
      window.addEventListener("scroll", updatePosition);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const translate = 
    side === "top" ? "translate(-50%, -100%)" :
    side === "bottom" ? "translate(-50%, 0)" :
    side === "left" ? "translate(-100%, -50%)" :
    "translate(0, -50%)";

  return (
    <span className={`relative inline-flex align-middle ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-primary transition-colors"
        aria-label="Hint"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none fixed z-[99999] px-3 py-2"
          style={{
            top: coords.top - window.scrollY,
            left: coords.left - window.scrollX,
            transform: translate,
          }}
        >
          <div
            className="w-max max-w-[200px] break-words rounded-lg border border-white/20 bg-black/90 backdrop-blur-xl px-3 py-2 text-[11px] font-medium leading-tight text-white shadow-2xl ring-1 ring-white/10"
            ref={(el) => {
              if (el) {
                const rect = el.getBoundingClientRect();
                const padding = 12;
                let offset = 0;
                
                if (rect.left < padding) {
                  offset = padding - rect.left;
                } else if (rect.right > window.innerWidth - padding) {
                  offset = window.innerWidth - padding - rect.right;
                }
                
                if (offset !== 0) {
                  el.style.transform = `translateX(${offset}px)`;
                }
              }
            }}
          >
            {children}
          </div>
        </div>,
        document.body
      )}
    </span>
  );
}
