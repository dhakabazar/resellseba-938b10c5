import { supabase } from "@/integrations/supabase/client";

export async function printShippingLabels(orderIds: string[], forceSize?: "3x3" | "3x4") {
  if (!orderIds.length) return;

  const [{ data: settings }, { data: orders }, { data: items }, { data: shipments }] = await Promise.all([
    supabase.from("global_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("orders").select("id,order_number,customer_name,customer_phone,address_line,area,total,reseller_id").in("id", orderIds),
    supabase.from("order_items").select("order_id,product_name,quantity").in("order_id", orderIds),
    supabase.from("shipments").select("order_id,provider,tracking_id,consignment_id").in("order_id", orderIds)
  ]);

  if (!orders || orders.length === 0) return;

  const resellerIds = [...new Set(orders.map(o => o.reseller_id))];
  const { data: resellers } = await supabase
    .from("resellers")
    .select("id,business_name,reseller_settings(logo_url,store_name)")
    .in("id", resellerIds);

  const resellerMap = new Map();
  resellers?.forEach(r => {
    const s = Array.isArray(r.reseller_settings) ? r.reseller_settings[0] : r.reseller_settings;
    resellerMap.set(r.id, {
      name: s?.store_name || r.business_name,
      logo: s?.logo_url
    });
  });

  const size = forceSize || (settings as any)?.label_size || "3x4";
  const siteName = settings?.site_name || "ResellHub";
  
  const itemsByOrder = new Map<string, any[]>();
  items?.forEach(it => {
    const arr = itemsByOrder.get(it.order_id) || [];
    arr.push(it);
    itemsByOrder.set(it.order_id, arr);
  });

  const shipmentsByOrder = new Map<string, any>();
  shipments?.forEach(s => shipmentsByOrder.set(s.order_id, s));

  const width = size === "3x3" ? "3in" : "3in";
  const height = size === "3x3" ? "3in" : "4in";

  const win = window.open("", "_blank");
  if (!win) return;

  win.document.write(`
    <html>
      <head>
        <title>Shipping Labels - ${size}</title>
        <style>
          @page { size: ${width} ${height}; margin: 0; }
          body { margin: 0; padding: 0; font-family: sans-serif; }
          .label { 
            width: ${width}; 
            height: ${height}; 
            padding: 0.25in; 
            box-sizing: border-box; 
            border-bottom: 1px dashed #ccc;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .header { border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
          .reseller-info { display: flex; align-items: center; gap: 8px; }
          .reseller-logo { width: 24px; height: 24px; object-fit: cover; border-radius: 2px; }
          .site-name { font-size: 12pt; font-weight: bold; }
          .order-num { font-size: 10pt; }
          .customer { margin-bottom: 10px; flex-grow: 1; }
          .name { font-size: 14pt; font-weight: bold; margin-bottom: 2px; }
          .phone { font-size: 12pt; margin-bottom: 4px; }
          .address { font-size: 10pt; line-height: 1.2; }
          .items { font-size: 8pt; border-top: 1px solid #eee; padding-top: 4px; margin-top: auto; }
          .footer { margin-top: 6px; border-top: 1px solid #000; padding-top: 4px; display: flex; justify-content: space-between; align-items: flex-end; }
          .courier { font-size: 9pt; font-weight: bold; text-transform: uppercase; }
          .tracking { font-size: 8pt; }
          .cod { font-size: 12pt; font-weight: bold; }
        </style>
      </head>
      <body>
        ${orders.map(o => {
          const reseller = resellerMap.get(o.reseller_id);
          const s = shipmentsByOrder.get(o.id);
          const oItems = itemsByOrder.get(o.id) || [];
          const itemLines = oItems.map(it => `${it.product_name} x ${it.quantity}`).join(", ");
          
          return `
            <div class="label">
              <div class="header">
                <div class="reseller-info">
                  ${reseller?.logo ? `<img src="${reseller.logo}" class="reseller-logo" />` : ""}
                  <div class="site-name">${reseller?.name || siteName}</div>
                </div>
                <div class="order-num">#${o.order_number}</div>
              </div>
              <div class="customer">
                <div class="name">${o.customer_name}</div>
                <div class="phone">${o.customer_phone}</div>
                <div class="address">${o.address_line}<br><strong>${o.area.replace("_", " ")}</strong></div>
              </div>
              <div class="items">
                <strong>Items:</strong> ${itemLines}
              </div>
              <div class="footer">
                <div>
                  <div class="courier">${s?.provider || "Manual"}</div>
                  <div class="tracking">${s?.tracking_id || s?.consignment_id || ""}</div>
                </div>
                <div class="cod">COD: ৳${Number(o.total).toFixed(0)}</div>
              </div>
            </div>
          `;
        }).join("")}
        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
      </body>
    </html>
  `);
  win.document.close();
}
