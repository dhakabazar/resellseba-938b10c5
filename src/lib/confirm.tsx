import * as React from "react";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";

export type ConfirmOptions = {
  title?: string;
  description: string;
  detail?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let push: ((p: Pending) => void) | null = null;

/**
 * Global confirmation popup. Replaces window.confirm() everywhere.
 * Usage: if (!(await confirmAction({ description: "..." }))) return;
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (!push) {
    // No host mounted (SSR / edge case) — fall back to native.
    if (typeof window !== "undefined") return Promise.resolve(window.confirm(options.description));
    return Promise.resolve(false);
  }
  return new Promise<boolean>((resolve) => push!({ ...options, resolve }));
}

export function GlobalConfirmHost() {
  const [pending, setPending] = React.useState<Pending | null>(null);

  React.useEffect(() => {
    push = (p) => setPending(p);
    return () => {
      push = null;
    };
  }, []);

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <ConfirmModal
      isOpen={!!pending}
      onClose={() => settle(false)}
      onConfirm={() => settle(true)}
      title={pending?.title ?? "Are you sure?"}
      description={pending?.description ?? ""}
      {...(pending?.detail ? { detail: pending.detail } : {})}
      confirmText={pending?.confirmText ?? "Confirm"}
      cancelText={pending?.cancelText ?? "Cancel"}
      variant={pending?.variant ?? "danger"}
    />
  );
}
