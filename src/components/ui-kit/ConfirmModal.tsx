import * as React from "react";
import { AlertTriangle, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmModalProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  const variantColors = {
    danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    warning: "bg-amber-600 text-white hover:bg-amber-700",
    info: "btn-brand",
  };

  const iconColors = {
    danger: "text-destructive bg-destructive/10",
    warning: "text-amber-600 bg-amber-50",
    info: "text-primary bg-primary/10",
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && !open && onClose()}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden [&>button]:hidden">
        <div className="flex items-center justify-between border-b px-5 py-4 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${iconColors[variant]}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold">{title}</DialogTitle>
          </div>
          <button 
            onClick={onClose} 
            disabled={isLoading}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="p-6">
          <DialogDescription className="text-sm text-foreground/80 leading-relaxed">
            {description}
          </DialogDescription>
        </div>

        <DialogFooter className="flex-row items-center justify-end gap-2 border-t bg-muted/10 px-6 py-4">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={handleConfirm}
            className={`flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-semibold transition-all disabled:opacity-50 ${variantColors[variant]}`}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmText}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
