import { useCallback, useEffect, useMemo, useState } from "react";
import { Bike, Clock, Loader2, Phone, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { fetchAllSafe } from "@/lib/fetch-all";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { CourierLogo } from "@/components/courier-brand";
import { orderStatusLabel, orderStatusTone, courierStatusLabel } from "@/lib/courier-status";

export type RiderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  city: string | null;
  area: string | null;
  total: number;
  status: string;
  rider_status: string | null;
  rider_assigned_at: string;
  resellers: { business_name: string; code: string } | null;
  shipments: { provider: string | null; tracking_id: string | null; consignment_id: string | null }[] | null;
};

const SELECT =
  "id, order_number, customer_name, customer_phone, city, area, total, status, rider_status, rider_assigned_at, resellers(business_name, code), shipments(provider, tracking_id, consignment_id)";

/** "2h 15m" style age used to spot parcels sitting with a rider for too long. */
function elapsed(fromIso: string, now: number) {
  const mins = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const rest = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${rest}m`;
  return `${rest}m`;
}

function ageTone(fromIso: string, now: number) {
  const hours = (now - new Date(fromIso).getTime()) / 3600000;
  if (hours >= 48) return "bg-rose-100 text-rose-700";
  if (hours >= 24) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

export function RiderFollowupPage({ showReseller }: { showReseller: boolean }) {
  const [rows, setRows] = useState<RiderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAllSafe(() =>
      supabase
        .from("orders")
        .select(SELECT)
        .not("rider_assigned_at", "is", null)
        .order("rider_assigned_at", { ascending: true }),
    );
    setLoading(false);
    setRows(data as unknown as RiderRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Clock only starts after mount, so the server and browser render the same markup.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.order_number, r.customer_name, r.customer_phone, r.resellers?.business_name, r.resellers?.code]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [rows, q]);

  const over24 = filtered.filter((r) => now - new Date(r.rider_assigned_at).getTime() >= 86400000).length;

  return (
    <div>
      <PageHeader
        title="Rider Followup"
        description="Parcels a courier rider is holding right now — assigned for delivery, assigned to rider or ready for delivery."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-muted"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="surface-card flex items-center gap-3 p-4">
          <Bike className="h-5 w-5 text-primary" />
          <div>
            <div className="text-xl font-black">{filtered.length}</div>
            <div className="text-xs font-medium text-muted-foreground">With a rider now</div>
          </div>
        </div>
        <div className="surface-card flex items-center gap-3 p-4">
          <Clock className="h-5 w-5 text-amber-500" />
          <div>
            <div className="text-xl font-black">{over24}</div>
            <div className="text-xs font-medium text-muted-foreground">Waiting over 24 hours</div>
          </div>
        </div>
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search order, customer, phone…"
            className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card p-10 text-center text-sm font-medium text-muted-foreground">
          No parcel is with a rider right now.
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Order</th>
                {showReseller && <th className="px-4 py-3">Reseller</th>}
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Courier</th>
                <th className="px-4 py-3">Rider stage</th>
                <th className="px-4 py-3">Assigned at</th>
                <th className="px-4 py-3">Waiting</th>
                <th className="px-4 py-3">Order status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => {
                const sh = r.shipments?.[0];
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-bold">{r.order_number}</div>
                      <div className="text-xs text-muted-foreground">৳{Number(r.total).toLocaleString()}</div>
                    </td>
                    {showReseller && (
                      <td className="px-4 py-3">
                        <div className="font-semibold">{r.resellers?.business_name ?? "—"}</div>
                        {r.resellers?.code && (
                          <div className="text-xs text-muted-foreground">/{r.resellers.code}</div>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="font-semibold">{r.customer_name}</div>
                      <a
                        href={`tel:${r.customer_phone}`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                      >
                        <Phone className="h-3 w-3" /> {r.customer_phone}
                      </a>
                      <div className="text-xs text-muted-foreground">
                        {[r.city, (r.area ?? "").replace(/_/g, " ")].filter(Boolean).join(", ")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CourierLogo provider={sh?.provider} size={18} />
                        <span className="text-xs text-muted-foreground">
                          {sh?.tracking_id || sh?.consignment_id || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                        {r.rider_status || courierStatusLabel("assigned-for-delivery", sh?.provider)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(r.rider_assigned_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ageTone(r.rider_assigned_at, now)}`}
                      >
                        {elapsed(r.rider_assigned_at, now)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${orderStatusTone(r.status)}`}
                      >
                        {orderStatusLabel(r.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
