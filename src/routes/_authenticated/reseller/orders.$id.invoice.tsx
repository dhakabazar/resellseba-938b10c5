import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reseller/orders/$id/invoice")({
  component: InvoicePage,
});

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  address_line: string;
  city: string | null;
  area: string;
  landmark: string | null;
  subtotal: number;
  shipping_cost: number;
  discount: number;
  total: number;
  payment_method: string;
  status: string;
  created_at: string;
  notes: string | null;
};
type Item = { id: string; product_name: string; quantity: number; reseller_price: number; line_total: number };
type Settings = {
  store_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  tagline: string | null;
  whatsapp: string | null;
  footer_text: string | null;
};

function InvoicePage() {
  const { id } = Route.useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [store, setStore] = useState<{ business_name: string; settings: Settings | null } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: o } = await supabase
        .from("orders")
        .select("id,order_number,customer_name,customer_phone,address_line,city,area,landmark,subtotal,shipping_cost,discount,total,payment_method,status,created_at,notes,reseller_id")
        .eq("id", id)
        .maybeSingle();
      if (!o) return;
      const [{ data: it }, { data: r }] = await Promise.all([
        supabase.from("order_items").select("id,product_name,quantity,reseller_price,line_total").eq("order_id", id),
        supabase.from("resellers").select("business_name, reseller_settings(*)").eq("id", (o as { reseller_id: string }).reseller_id).maybeSingle(),
      ]);
      setOrder(o as Order);
      setItems((it ?? []) as Item[]);
      const s = r?.reseller_settings ? (Array.isArray(r.reseller_settings) ? r.reseller_settings[0] : r.reseller_settings) : null;
      setStore(r ? { business_name: r.business_name, settings: s as Settings | null } : null);
    })();
  }, [id]);

  if (!order || !store)
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const primary = store.settings?.primary_color || "#111";
  const name = store.settings?.store_name || store.business_name;

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-slate-900 print:p-0">
      <div className="mb-6 flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          {store.settings?.logo_url ? (
            <img src={store.settings.logo_url} alt={name} className="h-12 w-12 rounded object-cover" />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded font-bold text-white" style={{ background: primary }}>{name.charAt(0)}</div>
          )}
          <div>
            <div className="text-xl font-semibold">{name}</div>
            {store.settings?.tagline && <div className="text-xs text-slate-500">{store.settings.tagline}</div>}
            {store.settings?.whatsapp && <div className="text-xs text-slate-500">WhatsApp: {store.settings.whatsapp}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-slate-500">Invoice</div>
          <div className="font-mono font-semibold">{order.order_number}</div>
          <div className="text-xs text-slate-500">{new Date(order.created_at).toLocaleString()}</div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Bill to</div>
          <div className="font-medium">{order.customer_name}</div>
          <div>{order.customer_phone}</div>
          <div className="text-slate-600">{order.address_line}</div>
          {order.city && <div className="text-slate-600">{order.city}</div>}
          <div className="text-xs text-slate-500">{order.area.replace("_", " ")}</div>
        </div>
        <div className="text-right">
          <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Payment</div>
          <div className="capitalize">{order.payment_method}</div>
          <div className="text-xs text-slate-500">Status: {order.status}</div>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-left" style={{ background: `${primary}15` }}>
            <th className="p-2">Product</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Price</th><th className="p-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b">
              <td className="p-2">{it.product_name}</td>
              <td className="p-2 text-right">{it.quantity}</td>
              <td className="p-2 text-right">৳{Number(it.reseller_price).toFixed(0)}</td>
              <td className="p-2 text-right">৳{Number(it.line_total).toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-sm">
          <tr><td colSpan={3} className="p-2 text-right text-slate-500">Subtotal</td><td className="p-2 text-right">৳{Number(order.subtotal).toFixed(0)}</td></tr>
          <tr><td colSpan={3} className="p-2 text-right text-slate-500">Shipping</td><td className="p-2 text-right">৳{Number(order.shipping_cost).toFixed(0)}</td></tr>
          {Number(order.discount) > 0 && <tr><td colSpan={3} className="p-2 text-right text-slate-500">Discount</td><td className="p-2 text-right">-৳{Number(order.discount).toFixed(0)}</td></tr>}
          <tr className="border-t font-semibold"><td colSpan={3} className="p-2 text-right">Grand total</td><td className="p-2 text-right" style={{ color: primary }}>৳{Number(order.total).toFixed(0)}</td></tr>
        </tfoot>
      </table>

      {order.notes && <div className="mt-4 rounded border p-3 text-xs text-slate-600"><strong>Notes:</strong> {order.notes}</div>}

      <div className="mt-8 border-t pt-4 text-center text-xs text-slate-500">
        {store.settings?.footer_text || `Thank you for shopping with ${name}!`}
      </div>

      <div className="mt-6 flex justify-end print:hidden">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
          <Printer className="h-4 w-4" /> Print / Save PDF
        </button>
      </div>
    </div>
  );
}
