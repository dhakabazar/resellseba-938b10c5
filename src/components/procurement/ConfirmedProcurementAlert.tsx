import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Package,
  AlertTriangle,
  Printer,
  ChevronRight,
  Boxes,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  useConfirmedProcurement,
  printProcurementList,
} from "@/lib/useConfirmedProcurement";
import { ConfirmedProcurementModal } from "./ConfirmedProcurementModal";

interface ConfirmedProcurementAlertProps {
  resellerId?: string | null;
  isAdmin?: boolean;
}

export function ConfirmedProcurementAlert({
  resellerId,
  isAdmin = true,
}: ConfirmedProcurementAlertProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const { data, isLoading, refetch } = useConfirmedProcurement(resellerId);

  const totalOrders = data?.totalConfirmedOrders ?? 0;
  const totalQty = data?.totalQuantityToPick ?? 0;
  const uniqueProducts = data?.totalUniqueProducts ?? 0;
  const shortageCount = data?.shortageProductsCount ?? 0;
  const ordersLink = isAdmin ? "/admin/orders" : "/reseller/orders";

  // If loading and no data yet, show nothing or minimal skeleton
  if (isLoading && !data) {
    return null;
  }

  // If no confirmed orders need procurement
  if (totalOrders === 0) {
    return (
      <>
        <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400 font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>সকল কনফার্মড অর্ডারের পণ্য সংগ্রহ ও প্যাকেজিং আপ-টু-ডেট রয়েছে। নতুন কনফার্মড অর্ডার আসলে এখানে স্বয়ংক্রিয়ভাবে নোটিশ পাবেন।</span>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-muted-foreground hover:text-foreground font-medium underline shrink-0"
          >
            ইতিহাস দেখুন
          </button>
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

  const hasShortage = shortageCount > 0;

  return (
    <>
      <div
        className={`mb-6 relative overflow-hidden rounded-2xl border transition-all duration-300 shadow-md ${
          hasShortage
            ? "border-rose-500/40 bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-card"
            : "border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-primary/5 to-card"
        }`}
      >
        {/* Subtle top indicator bar */}
        <div
          className={`h-1 w-full ${
            hasShortage
              ? "bg-gradient-to-r from-rose-500 via-amber-500 to-rose-400"
              : "bg-gradient-to-r from-amber-500 via-primary to-emerald-400"
          }`}
        />

        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left Side: Icon, Badges & Headline */}
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner relative ${
                hasShortage
                  ? "bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400"
                  : "bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400"
              }`}
            >
              <Package className="h-6 w-6" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    hasShortage ? "bg-rose-400" : "bg-amber-400"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    hasShortage ? "bg-rose-500" : "bg-amber-500"
                  }`}
                />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-black tracking-tight text-foreground flex items-center gap-1.5">
                  পণ্য সংগ্রহ ও প্যাকেজিং নোটিশ (Procurement / Pick List)
                </h3>

                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                    hasShortage
                      ? "bg-rose-500 text-white shadow-sm"
                      : "bg-amber-500 text-slate-950 font-bold"
                  }`}
                >
                  {totalOrders} টি অর্ডার পেন্ডিং
                </span>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                কনফার্মড হওয়া <strong className="text-foreground">{totalOrders} টি অর্ডারে</strong> মোট{" "}
                <strong className="text-amber-600 dark:text-amber-400 font-black">{totalQty} পিস পণ্য</strong> (
                {uniqueProducts} টি প্রোডাক্ট ভ্যারাইটি) প্যাকিং ও ডেলিভারির জন্য সংগ্রহ করতে হবে।
              </p>

              {/* Shortage Alert Tag if any */}
              {hasShortage && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold animate-pulse">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  সতর্কতা: {shortageCount} টি পণ্যে স্টকের ঘাটতি রয়েছে! দ্রুত সংগ্রহ বা স্টকের ব্যবস্থা করুন।
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end md:self-center">
            <button
              type="button"
              onClick={() => data && printProcurementList(data, isAdmin ? "Admin Procurement" : "Reseller Procurement")}
              className="h-9 px-3 rounded-xl border bg-background hover:bg-accent text-xs font-bold text-foreground transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              title="কালেকশন স্লিপ প্রিন্ট করুন"
            >
              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
              প্রিন্ট স্লিপ
            </button>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground hover:opacity-90 font-black text-xs transition-all shadow-md flex items-center gap-2 active:scale-95"
            >
              <Boxes className="h-4 w-4" />
              পণ্য সংগ্রহের তালিকা ({totalQty} পিস)
            </button>

            <Link
              to={ordersLink}
              search={{ tab: "confirmed" } as never}
              className="h-9 px-2.5 rounded-xl border border-muted-foreground/20 hover:bg-accent text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              title="কনফার্মড অর্ডার ট্যাবে যান"
            >
              অর্ডারসমূহ <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
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
