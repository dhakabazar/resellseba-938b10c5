import * as React from "react";
import { AlertTriangle, Trash2, Info, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  /** Optional extra line, e.g. the exact item name being deleted. */
  detail?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

const STYLES = {
  danger: {
    ring: "bg-destructive/10 text-destructive ring-destructive/20",
    glow: "from-destructive/15",
    button: "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/40",
    Icon: Trash2,
  },
  warning: {
    ring: "bg-amber-500/10 text-amber-600 ring-amber-500/20",
    glow: "from-amber-500/15",
    button: "bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500/40",
    Icon: AlertTriangle,
  },
  info: {
    ring: "bg-primary/10 text-primary ring-primary/20",
    glow: "from-primary/15",
    button: "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/40",
    Icon: Info,
  },
} as const;

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  detail,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmModalProps) {
  const s = STYLES[variant];
  const Icon = s.Icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && !open && onClose()}>
      <DialogContent className="max-w-[26rem] gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl hide-close-button">
        {/* soft accent glow behind the icon */}
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${s.glow} to-transparent`} />

        <button
          onClick={onClose}
          disabled={isLoading}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative flex flex-col items-center px-6 pb-2 pt-8 text-center">
          <div className={`grid h-14 w-14 place-items-center rounded-full ring-8 ${s.ring}`}>
            <Icon className="h-6 w-6" />
          </div>
          <DialogTitle className="mt-4 text-lg font-black tracking-tight">{title}</DialogTitle>
          <DialogDescription className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {description}
          </DialogDescription>
          {detail && (
            <div className="mt-3 w-full truncate rounded-lg bg-muted/60 px-3 py-2 text-xs font-semibold">{detail}</div>
          )}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 border-t bg-muted/25 p-4 sm:flex-row sm:justify-center">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="rounded-xl border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-muted disabled:opacity-50 sm:min-w-[7rem]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onConfirm()}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition focus-visible:outline-none focus-visible:ring-4 disabled:opacity-60 sm:min-w-[7rem] ${s.button}`}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
