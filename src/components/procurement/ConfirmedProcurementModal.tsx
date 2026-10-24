import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Package,
  Search,
  AlertTriangle,
  CheckCircle2,
  Printer,
  RefreshCw,
  ExternalLink,
  Layers,
  ArrowRight,
} from "lucide-react";
import {
  type ConfirmedProcurementData,
  type ProcurementItem,
  printProcurementList,
} from "@/lib/useConfirmedProcurement";

interface ConfirmedProcurementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ConfirmedProcurementData | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  isAdmin?: boolean;
}

export function ConfirmedProcurementModal({
  open,
  onOpenChange,
  data,
  isLoading,
  onRefresh,
  isAdmin = true,
}: ConfirmedProcurementModalProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "shortage" | "sufficient">("all");

  const items = data?.items || [];

  const filteredItems = useMemo(() => {
    let result = items;

    if (filter === "shortage") {
      result = result.filter((it) => it.hasShortage);
    } else if (filter === "sufficient") {
      result = result.filter((it) => !it.hasShortage && it.stock != null);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (it) =>
          it.productName.toLowerCase().includes(q) ||
          (it.sku && it.sku.toLowerCase().includes(q)) ||
          it.orderNumbers.some((n) => n.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [items, filter, search]);

  const ordersLink = isAdmin ? "/admin/orders" : "/reseller/orders";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-card/60 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-sm">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black tracking-tight">
                  পণ্য সংগ্রহ ও প্যাকেজিং তালিকা (Pick List)
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  কনফার্মড হওয়া যে সমস্ত অর্ডারের পণ্য এখনো প্যাক করা হয়নি
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                title="রিফ্রেশ করুন"
                className="h-8 w-8 rounded-lg border bg-background hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>

              <button
                type="button"
                onClick={() => data && printProcurementList(data, isAdmin ? "Admin Procurement" : "Reseller Procurement")}
                disabled={!items.length}
                className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-colors disabled:opacity-50"
              >
                <Printer className="h-3.5 w-3.5" /> প্রিন্ট স্লিপ
              </button>
            </div>
          </div>

          {/* Quick Metrics KPI Bar */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-dashed">
            <div className="bg-background/80 rounded-lg p-2 border text-center">
              <div className="text-xs text-muted-foreground font-semibold">কনফার্মড অর্ডার</div>
              <div className="text-lg font-black text-foreground">
                {data?.totalConfirmedOrders ?? 0} <span className="text-xs font-normal text-muted-foreground">টি</span>
              </div>
            </div>

            <div className="bg-background/80 rounded-lg p-2 border text-center">
              <div className="text-xs text-muted-foreground font-semibold">মোট আইটেম প্রয়োজন</div>
              <div className="text-lg font-black text-amber-600 dark:text-amber-400">
                {data?.totalQuantityToPick ?? 0} <span className="text-xs font-normal text-muted-foreground">পিস</span>
              </div>
            </div>

            <div className="bg-background/80 rounded-lg p-2 border text-center">
              <div className="text-xs text-muted-foreground font-semibold">প্রোডাক্ট ভ্যারাইটি</div>
              <div className="text-lg font-black text-foreground">
                {data?.totalUniqueProducts ?? 0} <span className="text-xs font-normal text-muted-foreground">আইটেম</span>
              </div>
            </div>

            <div
              className={`rounded-lg p-2 border text-center ${
                (data?.shortageProductsCount ?? 0) > 0
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              <div className="text-xs font-semibold">স্টক ঘাটতি</div>
              <div className="text-lg font-black">
                {data?.shortageProductsCount ?? 0} <span className="text-xs font-normal opacity-80">টি</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Filter & Search Bar */}
        <div className="p-3 bg-muted/40 border-b flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-background rounded-lg border p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                filter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              সব পণ্য ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("shortage")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                filter === "shortage"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              ঘাটতি ({items.filter((i) => i.hasShortage).length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("sufficient")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                filter === "sufficient"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              পর্যাপ্ত ({items.filter((i) => !i.hasShortage && i.stock != null).length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="পণ্য, SKU বা অর্ডার নম্বর খুঁজুন..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full pl-8 pr-3 text-xs bg-background border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Scrollable Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-border/40">
          {isLoading && !items.length ? (
            <div className="py-16 text-center text-muted-foreground text-xs font-medium">
              কনফার্মড অর্ডারের তথ্য লোড হচ্ছে...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-14 text-center">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-foreground">
                {items.length === 0
                  ? "কোনো পণ্য সংগ্রহের প্রয়োজন নেই!"
                  : "সার্চের সাথে কোনো পণ্য মেলেনি"}
              </h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {items.length === 0
                  ? "কনফার্মড থাকা সকল অর্ডারের পণ্য ইতোমধ্যে প্যাক করা হয়েছে অথবা কনফার্মড স্ট্যাটাসে কোনো অর্ডার নেই।"
                  : "অন্য কোনো কি-ওয়ার্ড দিয়ে ফিল্টার করে দেখুন।"}
              </p>
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={item.productId || item.productName + idx}
                className={`pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl transition-colors ${
                  item.hasShortage
                    ? "bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20"
                    : "hover:bg-accent/40 border border-transparent"
                }`}
              >
                {/* Left: Thumbnail & Details */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="h-14 w-14 rounded-lg bg-background border flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                    {item.productImage ? (
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground/60" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-foreground truncate hover:text-primary transition-colors">
                        {item.productName}
                      </h4>
                      {item.hasShortage && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-rose-500 text-white tracking-wide">
                          স্টক ঘাটতি
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                      {item.sku && (
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">
                          SKU: {item.sku}
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        {item.orderCount} টি অর্ডারে প্রযোজ্য
                      </span>
                    </div>

                    {/* Order Badges */}
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      <span className="text-[10px] font-semibold text-muted-foreground/80">অর্ডার:</span>
                      {item.orderNumbers.slice(0, 6).map((num) => (
                        <span
                          key={num}
                          className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-background border text-foreground/80"
                        >
                          #{num}
                        </span>
                      ))}
                      {item.orderNumbers.length > 6 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{item.orderNumbers.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Quantity Needed & Current Stock */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                  {/* Required Qty */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground sm:hidden">কালেকশন:</span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-black text-sm">
                      {item.totalQuantity} <span className="text-xs font-semibold">পিস</span>
                    </span>
                  </div>

                  {/* Stock Status Badge */}
                  <div>
                    {item.stock == null ? (
                      <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        স্টক আনট্র্যাকড
                      </span>
                    ) : item.hasShortage ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-md">
                        <AlertTriangle className="h-3 w-3" />
                        স্টক আছে: {item.stock} (কম: {item.shortageQty})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="h-3 w-3" />
                        স্টক পর্যাপ্ত: {item.stock} পিস
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t bg-muted/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-muted-foreground">
            টিপস: প্রোডাক্ট সংগ্রহ শেষে অর্ডারকে <span className="font-bold text-foreground">Packaging</span> ট্যাবে নিয়ে যান।
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Link
              to={ordersLink}
              search={{ tab: "confirmed" } as never}
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline px-2 py-1"
            >
              কনফার্মড অর্ডার লিস্ট <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-1.5 rounded-lg border bg-background hover:bg-accent text-xs font-bold transition-colors"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
