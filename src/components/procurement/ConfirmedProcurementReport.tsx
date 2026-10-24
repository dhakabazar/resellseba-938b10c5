import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Boxes,
  ExternalLink,
  ChevronRight,
  Layers,
} from "lucide-react";
import {
  useConfirmedProcurement,
  printProcurementList,
} from "@/lib/useConfirmedProcurement";
import { ConfirmedProcurementModal } from "./ConfirmedProcurementModal";

interface ConfirmedProcurementReportProps {
  resellerId?: string | null;
  isAdmin?: boolean;
}

export function ConfirmedProcurementReport({
  resellerId,
  isAdmin = true,
}: ConfirmedProcurementReportProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const { data, isLoading, refetch } = useConfirmedProcurement(resellerId);

  const totalOrders = data?.totalConfirmedOrders ?? 0;
  const totalQty = data?.totalQuantityToPick ?? 0;
  const uniqueProducts = data?.totalUniqueProducts ?? 0;
  const shortageCount = data?.shortageProductsCount ?? 0;
  const items = data?.items || [];
  const topItems = items.slice(0, 6);
  const ordersLink = isAdmin ? "/admin/orders" : "/reseller/orders";

  return (
    <>
      <div className="surface-card group p-5 sm:p-6 hover:border-primary/50 transition-colors">
        {/* Card Header */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Boxes className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/90 flex items-center gap-2">
                পণ্য সংগ্রহ ও প্যাকিং রিকোয়ারমেন্ট (Pick List Report)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                কনফার্মড হওয়া যে সমস্ত অর্ডারের পণ্য এখনো প্যাক করা হয়নি সেগুলোর রিকোয়ারমেন্ট রিপোর্ট
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {totalOrders > 0 && (
              <button
                type="button"
                onClick={() => data && printProcurementList(data, isAdmin ? "Admin Procurement" : "Reseller Procurement")}
                className="h-8 px-2.5 rounded-lg border bg-background hover:bg-accent text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                প্রিন্ট
              </button>
            )}

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="h-8 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              সম্পূর্ণ তালিকা ({items.length}) <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 4 Mini Stat Badges */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-4">
          <div className="bg-muted/40 rounded-xl p-3 border text-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">কনফার্মড অর্ডার</div>
            <div className="text-xl font-black text-foreground mt-0.5">{totalOrders} <span className="text-xs font-normal text-muted-foreground">টি</span></div>
          </div>

          <div className="bg-muted/40 rounded-xl p-3 border text-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">মোট আইটেম প্রয়োজন</div>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{totalQty} <span className="text-xs font-normal text-muted-foreground">পিস</span></div>
          </div>

          <div className="bg-muted/40 rounded-xl p-3 border text-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">প্রোডাক্ট ভ্যারাইটি</div>
            <div className="text-xl font-black text-foreground mt-0.5">{uniqueProducts} <span className="text-xs font-normal text-muted-foreground">আইটেম</span></div>
          </div>

          <div className={`rounded-xl p-3 border text-center ${shortageCount > 0 ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"}`}>
            <div className="text-[11px] font-bold uppercase tracking-wider">{shortageCount > 0 ? "⚠️ স্টক ঘাটতি" : "✅ স্টক স্ট্যাটাস"}</div>
            <div className="text-xl font-black mt-0.5">{shortageCount > 0 ? `${shortageCount} টি পণ্য` : "পর্যাপ্ত"}</div>
          </div>
        </div>

        {/* Table of Top Items */}
        {isLoading && !items.length ? (
          <div className="py-10 text-center text-xs text-muted-foreground">লোড হচ্ছে...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <span>বর্তমানে কোনো কনফার্মড অর্ডার পেন্ডিং নেই। সকল পণ্যের প্যাকিং সম্পন্ন!</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-muted/20 text-[11px] uppercase tracking-wider text-muted-foreground/80 font-bold">
                  <th className="py-2.5 px-3">প্রোডাক্ট</th>
                  <th className="py-2.5 px-2 text-center">প্রয়োজনীয় পরিমাণ</th>
                  <th className="py-2.5 px-2 text-center">স্টক অবস্থা</th>
                  <th className="py-2.5 px-3 text-right">অর্ডারসমূহ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {topItems.map((item) => (
                  <tr key={item.productId || item.productName} className="hover:bg-muted/30 transition-colors">
                    {/* Product Image & Info */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-lg bg-background border flex items-center justify-center overflow-hidden shrink-0">
                          {item.productImage ? (
                            <img src={item.productImage} alt={item.productName} className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="min-w-0 max-w-[240px] sm:max-w-xs">
                          <div className="font-bold text-foreground truncate">{item.productName}</div>
                          {item.sku && <div className="text-[10px] font-mono text-muted-foreground">SKU: {item.sku}</div>}
                        </div>
                      </div>
                    </td>

                    {/* Required Qty */}
                    <td className="py-2.5 px-2 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-black text-xs">
                        {item.totalQuantity} পিস
                      </span>
                    </td>

                    {/* Stock Status */}
                    <td className="py-2.5 px-2 text-center">
                      {item.stock == null ? (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      ) : item.hasShortage ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                          <AlertTriangle className="h-3 w-3" />
                          স্টক: {item.stock} (ঘাটতি: {item.shortageQty})
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          স্টক: {item.stock}
                        </span>
                      )}
                    </td>

                    {/* Order Badges */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {item.orderNumbers.slice(0, 3).map((num) => (
                          <span
                            key={num}
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-background border text-foreground/80"
                          >
                            #{num}
                          </span>
                        ))}
                        {item.orderNumbers.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{item.orderNumbers.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Bottom see all if > 6 */}
            {items.length > 6 && (
              <div className="mt-3 pt-2 border-t text-center">
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                >
                  আরও {items.length - 6} টি প্রোডাক্টের তালিকা দেখুন...
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmedProcurementModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        data={data}
        isLoading={isLoading}
        onRefresh={() => void refetch()}
        isAdmin={isAdmin}
      />
    </>
  );
}
