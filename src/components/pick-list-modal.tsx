import { ListChecks, X } from "lucide-react";

export type PickRow = { name: string; qty: number; orders: number };

/** Product pick list popup — works for filtered view or marked orders. */
export function PickListModal({
  rows,
  scopeLabel,
  onPick,
  onClose,
}: {
  rows: PickRow[];
  scopeLabel: string;
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const printList = () => {
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    w.document.write(
      `<title>Pick list</title><style>body{font-family:system-ui,sans-serif;padding:24px}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:14px}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}th:last-child,td:last-child{text-align:right}</style>` +
        `<h1>Pick list — ${scopeLabel}</h1><table><tr><th>Product</th><th>Orders</th><th>Qty</th></tr>` +
        rows.map((r) => `<tr><td>${r.name}</td><td>${r.orders}</td><td>${r.qty}</td></tr>`).join("") +
        `<tr><th>Total</th><th></th><th>${totalQty} pcs</th></tr></table>`,
    );
    w.document.close();
    w.print();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-xl overflow-hidden rounded-lg border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <ListChecks className="h-4 w-4" /> Product pick list
            </div>
            <div className="text-xs text-muted-foreground">{scopeLabel}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={printList}
              disabled={rows.length === 0}
              className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              Print
            </button>
            <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="max-h-[60vh] modal-scroll">
          {rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No products found.</div>
          ) : (
            rows.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => onPick(p.name)}
                className="flex w-full items-center justify-between gap-3 border-b px-4 py-2.5 text-left text-sm last:border-b-0 hover:bg-accent/50"
              >
                <span className="truncate">{p.name}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs">
                  <span className="text-muted-foreground">{p.orders} order</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                    {p.qty} pcs
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          <span>{rows.length} product</span>
          <span className="font-semibold text-foreground">{totalQty} pcs</span>
        </div>
      </div>
    </div>
  );
}
