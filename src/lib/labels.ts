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
          body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #fff; }
          .label { 
            width: ${width}; 
            height: ${height}; 
            padding: 0.15in; 
            box-sizing: border-box; 
            border: 2px solid #000;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
          }
          .header { 
            border-bottom: 2px solid #000; 
            padding-bottom: 6px; 
            margin-bottom: 8px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
          }
          .reseller-info { display: flex; align-items: center; gap: 8px; }
          .reseller-logo { width: 32px; height: 32px; object-fit: contain; border: 1px solid #eee; }
          .site-name { font-size: 11pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
          .order-num { font-size: 9pt; font-weight: bold; background: #000; color: #fff; padding: 2px 6px; border-radius: 2px; }
          
          .section-title { font-size: 7pt; text-transform: uppercase; color: #666; font-weight: bold; margin-bottom: 2px; }
          
          .customer { 
            border: 1.5px solid #000;
            padding: 8px;
            margin-bottom: 8px;
            border-radius: 4px;
          }
          .name { font-size: 13pt; font-weight: 800; margin-bottom: 2px; color: #000; }
          .phone { font-size: 11pt; font-weight: bold; margin-bottom: 4px; display: block; border-bottom: 1px dashed #000; width: fit-content; }
          .address { font-size: 9pt; line-height: 1.3; font-weight: 500; }
          
          .items-box {
            border: 1px solid #000;
            padding: 6px;
            flex-grow: 1;
            margin-bottom: 8px;
            border-radius: 4px;
            background: #f9f9f9;
            font-size: 8pt;
          }
          .item-row { display: block; margin-bottom: 2px; border-bottom: 1px solid #ddd; padding-bottom: 2px; }
          .item-row:last-child { border-bottom: none; }

          .footer { 
            border-top: 2px solid #000; 
            padding-top: 6px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
          }
          .courier-info { display: flex; flex-direction: column; }
          .courier { font-size: 10pt; font-weight: 900; text-transform: uppercase; color: #000; }
          .tracking { font-size: 7pt; font-family: monospace; font-weight: bold; }
          .cod-badge { 
            background: #000; 
            color: #fff; 
            padding: 4px 8px; 
            border-radius: 4px;
            text-align: right;
          }
          .cod-label { font-size: 7pt; text-transform: uppercase; display: block; line-height: 1; }
          .cod-value { font-size: 12pt; font-weight: 900; }
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
                <div class="section-title">Recipient</div>
                <div class="name">${o.customer_name}</div>
                <div class="phone">${o.customer_phone}</div>
                <div class="address">${o.address_line}<br><strong>${o.area.replace("_", " ")}</strong></div>
              </div>
              <div class="items-box">
                <div class="section-title">Order Items</div>
                ${oItems.map(it => `<span class="item-row">${it.product_name} <strong>x ${it.quantity}</strong></span>`).join("")}
              </div>
              <div class="footer">
                <div class="courier-info">
                  <div class="section-title">Courier</div>
                  <div class="courier">${s?.provider || "Manual"}</div>
                  <div class="tracking">${s?.tracking_id || s?.consignment_id || "PENDING"}</div>
                </div>
                <div class="cod-badge">
                  <span class="cod-label">Cash to Collect</span>
                  <span class="cod-value">৳${Number(o.total).toFixed(0)}</span>
                </div>
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
