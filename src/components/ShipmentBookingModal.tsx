import React, { useState } from "react";
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
  
  const doSteadfast = useServerFn(bookSteadfast);
  const doPathao = useServerFn(bookPathao);
  const doCarrybee = useServerFn(bookCarrybee);

  const handleBook = async () => {
    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of orderIds) {
      try {
        if (provider === "steadfast") {
          await doSteadfast({ data: { orderId: id } });
        } else if (provider === "pathao") {
          await doPathao({ data: { orderId: id } });
        } else if (provider === "carrybee") {
          await doCarrybee({ data: { orderId: id } });
        }
        successCount++;
      } catch (err: any) {
        console.error(`Booking failed for ${id}:`, err);
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
            {COURIER_LIST.map((p) => (
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
            disabled={loading}
            onClick={handleBook}
            className="btn-brand flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Booking
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
