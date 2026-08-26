import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

const WORDS = ["shop", "sell", "store", "order", "reseller", "market"];

function easyPassword() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  return `${word}${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Shows the new password up-front. The admin must copy it before the reset
 * button becomes active, so the password is never lost.
 */
export function PasswordResetModal({
  label,
  onClose,
  onReset,
}: {
  label: string;
  onClose: () => void;
  onReset: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState(() => easyPassword());
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
    } catch {
      // clipboard may be blocked — the password is visible on screen anyway
    }
    setCopied(true);
    toast.success("Password copied");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface-card w-full max-w-md rounded-b-none sm:rounded-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <KeyRound className="h-4 w-4 text-amber-500" /> Reset password
          </h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="text-xs text-muted-foreground">
            New password for <span className="font-medium text-foreground">{label}</span>. Copy it first —
            it will not be shown again.
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-md border bg-muted/40 px-3 py-2 font-mono text-lg tracking-wider">
              {password}
            </div>
            <button
              type="button"
              onClick={() => {
                setPassword(easyPassword());
                setCopied(false);
              }}
              disabled={busy}
              title="Generate another"
              className="rounded-md border p-2 hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => void copy()}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy password"}
          </button>
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!copied || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onReset(password);
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            {copied ? "Reset password" : "Copy first"}
          </button>
        </div>
      </div>
    </div>
  );
}
