import { courierStatusLabel } from "@/lib/courier-status";
import { CourierLogo, courierLabel } from "@/components/courier-brand";

export type CourierEvent = {
  id: string;
  provider: string;
  source: string;
  notification_type: string | null;
  courier_status: string;
  tracking_code: string | null;
  cod_amount: number | null;
  delivery_charge: number | null;
  note: string | null;
  event_at: string;
};

export function CourierTimeline({
  events,
  title = "Courier live updates",
}: {
  events: CourierEvent[];
  title?: string;
}) {
  return (
    <div className="surface-card p-4">
      <div className="mb-3 text-sm font-medium">{title}</div>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No courier updates yet. Booking and live webhook updates will appear here.
        </p>
      ) : (
        <ol className="relative space-y-4 border-l pl-4">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
              <div className="text-sm font-medium">{courierStatusLabel(e.courier_status)}</div>
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                <span>{new Date(e.event_at).toLocaleString()}</span>
                <span>·</span>
                <CourierLogo provider={e.provider} size={13} />
                <span>{courierLabel(e.provider)}</span>
                <span>· {e.source}</span>
                {e.notification_type ? <span>· {e.notification_type}</span> : null}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                {e.tracking_code && <span>Tracking {e.tracking_code}</span>}
                {e.cod_amount != null && <span>COD ৳{Number(e.cod_amount).toFixed(0)}</span>}
                {e.delivery_charge != null && <span>Charge ৳{Number(e.delivery_charge).toFixed(0)}</span>}
              </div>
              {e.note && <div className="mt-1 text-xs">{e.note}</div>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
