import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

/**
 * Shared product ID chip with copy icon.
 * Used everywhere a product code is shown (catalog, reseller panel, storefront).
 */
export function ProductCodeChip({
  code,
  className = "",
  size = "sm",
}: {
  code?: string | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const [done, setDone] = useState(false);
  if (!code) return null;

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(code));
      setDone(true);
      toast.success(`Product ID ${code} copied`);
      setTimeout(() => setDone(false), 1200);
    } catch {
      toast.error("Copy failed");
    }
  }

  const pad = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy product ID"
      className={`inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/60 font-bold tabular-nums tracking-wide text-muted-foreground transition hover:border-primary/50 hover:text-primary ${pad} ${className}`}
    >
      <span>ID #{code}</span>
      {done ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 opacity-70" />}
    </button>
  );
}

/** Case-insensitive match helper: name/extra fields + product code. */
export function matchesProductQuery(term: string, code?: string | null, ...fields: (string | null | undefined)[]) {
  // Users may type/paste the visible label ("ID #123") — search on the bare code.
  const t = term.trim().toLowerCase().replace(/^id\s*/, "").replace(/^#/, "").trim();
  if (!t) return true;
  if (code && String(code).toLowerCase().includes(t)) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(t));
}
