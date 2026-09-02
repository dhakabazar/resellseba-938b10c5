import React, { useState, useEffect, useMemo } from "react";
import { X, Loader2, Truck, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { bookSteadfast, bookPathao, bookCarrybee } from "@/lib/couriers.functions";
import { getActiveCouriers } from "@/lib/courier-config.functions";
import { COURIER_BRANDS, CourierLogo } from "@/components/courier-brand";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderIds: string[];
  onSuccess: () => void;
}

export function ShipmentBookingModal({
  isOpen,
  onClose,
  orderIds,
  onSuccess,
}: BookingModalProps) {
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<"steadfast" | "pathao" | "carrybee">("steadfast");
  
  const fetchActive = useServerFn(getActiveCouriers);
  const { data: activeProviders = [], isLoading: loadingActive } = useQuery({
    queryKey: ["active-couriers"],
    queryFn: () => fetchActive(),
  });

  const activeCourierList = useMemo(() => {
    return activeProviders
      .map((id) => (COURIER_BRANDS as any)[id])
      .filter(Boolean);
  }, [activeProviders]);

  useEffect(() => {
    if (activeProviders.length > 0 && !activeProviders.includes(provider)) {
      setProvider(activeProviders[0] as any);
    }
  }, [activeProviders]);

  const doSteadfast = useServerFn(bookSteadfast);
  const doPathao = useServerFn(bookPathao);
  const doCarrybee = useServerFn(bookCarrybee);

  const handleBook = async () => {
    if (orderIds.length === 0) return;
    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    let lastError = "";
    for (const id of orderIds) {
      try {
        let res: any = null;
        if (provider === "steadfast") {
          res = await doSteadfast({ data: { orderId: id } });
        } else if (provider === "pathao") {
          res = await doPathao({ data: { orderId: id } });
        } else if (provider === "carrybee") {
          res = await doCarrybee({ data: { orderId: id } });
        }
        // Only count a booking when the server actually confirms it.
        if (res?.success && (res.consignmentId || res.trackingId)) {
          successCount++;
        } else {
          failCount++;
          lastError = typeof res === "string" ? res : "Booking was not saved";
        }
      } catch (err: any) {
        console.error(`Booking failed for ${id}:`, err);
        lastError = err?.message || String(err ?? "");
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully booked ${successCount} orders with ${provider}`);
      onSuccess();
      onClose();
    }
    if (failCount > 0) {
      toast.error(`Failed to book ${failCount} orders. Check console for details.`);
    }
    setLoading(false);
  };

  // Logic: if only 1 active, we'll auto-book or show a simplified state.
  // The user said: "if active 1ti hoi tahole popup asbe na sorasori booking"
  // But usually we need to call handleBook. 
  // However, the component is rendered as a modal controlled by state.
  // We can trigger handleBook in a useEffect if activeProviders.length === 1 and it's open.
  useEffect(() => {
    if (isOpen && !loading && activeProviders.length === 1 && orderIds.length > 0) {
      handleBook();
    }
  }, [isOpen, activeProviders, orderIds]);

  if (activeProviders.length === 1 && isOpen) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !loading && !open && onClose()}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm font-medium">Booking {orderIds.length} order(s) with {activeCourierList[0]?.label}...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !loading && !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Courier Booking
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Select a courier provider to book {orderIds.length} selected order(s).
          </p>

          <div className="grid grid-cols-1 gap-3">
            {activeCourierList.map((p: any) => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                className={`flex items-center justify-between rounded-lg border p-4 text-left transition-all hover:bg-accent ${
                  provider === p.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <CourierLogo provider={p.id} size={30} />
                  <span className="font-semibold">{p.label}</span>
                </div>
                {provider === p.id && <div className="h-2 w-2 rounded-full bg-primary" />}
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-amber-800 border border-amber-200">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-xs leading-relaxed">
              Booking will create live consignments in the courier panel. 
              Ensure store configurations are correct before proceeding.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t pt-4">
          <button
            disabled={loading}
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            disabled={loading || activeProviders.length === 0}
            onClick={handleBook}
            className="btn-brand flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm {provider ? (COURIER_BRANDS as any)[provider]?.label : "Courier"} Booking
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
