import { supabase } from "@/integrations/supabase/client";
import { getGlobalSettings } from "@/lib/app-data";
import { courierLabel, courierBrand } from "@/components/courier-brand";
import { code128Svg } from "@/lib/barcode";

export async function printShippingLabels(orderIds: string[], forceSize?: "3x3" | "3x4") {
  if (!orderIds.length) return;

  const [settings, { data: orders }, { data: items }, { data: shipments }] = await Promise.all([
    getGlobalSettings(),
    supabase.from("orders").select("id,order_number,customer_name,customer_phone,address_line,area,total,reseller_id").in("id", orderIds),
    supabase.from("order_items").select("order_id,product_name,product_image,quantity").in("order_id", orderIds),
    supabase.from("shipments").select("order_id,provider,tracking_id,consignment_id").in("order_id", orderIds)
  ]);


  if (!orders || orders.length === 0) return;

  const resellerIds = [...new Set(orders.map((o) => o.reseller_id).filter((x): x is string => Boolean(x)))];
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
            padding-bottom: 4px; 
            margin-bottom: 6px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            gap: 6px;
          }
          .reseller-info { display: flex; align-items: center; gap: 6px; min-width: 0; }
          .reseller-logo { width: 30px; height: 30px; object-fit: contain; border: 1px solid #eee; }
          .site-name { font-size: 10pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; }
          .order-block { text-align: right; }
          .order-num { font-size: 11pt; font-weight: 900; letter-spacing: 0.5px; line-height: 1.05; }
          .barcode { display: block; }
          .barcode svg { display: block; width: 100%; height: auto; }
          .order-block .barcode { width: 55%; margin-left: auto; height: 42px; }

          .section-title { font-size: 7pt; text-transform: uppercase; color: #666; font-weight: bold; margin-bottom: 2px; }

          .courier-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            border: 1.5px solid #000;
            border-radius: 4px;
            padding: 5px 7px;
            margin-bottom: 6px;
          }
          .courier-logo { height: 28px; max-width: 0.85in; object-fit: contain; }
          .courier-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: stretch; gap: 3px; }
          .courier-name { font-size: 8pt; font-weight: 800; text-transform: uppercase; text-align: center; }
          .booking-id { font-size: 12pt; font-weight: 900; font-family: 'Courier New', monospace; letter-spacing: 0.5px; text-align: center; }
          .courier-bar .barcode { width: 100%; max-width: 2.3in; margin: 0 auto; }

          .customer { 
            border: 1.5px solid #000;
            padding: 6px;
            margin-bottom: 6px;
            border-radius: 4px;
          }
          .name { font-size: 13pt; font-weight: 800; margin-bottom: 2px; color: #000; }
          .phone { font-size: 12pt; font-weight: bold; margin-bottom: 4px; display: block; border-bottom: 1px dashed #000; width: fit-content; }
          .address { font-size: 9pt; line-height: 1.3; font-weight: 500; }
          
          .items-box {
            border: 1px solid #000;
            padding: 5px;
            flex-grow: 1;
            margin-bottom: 6px;
            border-radius: 4px;
            background: #f9f9f9;
            font-size: 8pt;
            overflow: hidden;
          }
          .item-row { display: flex; align-items: center; gap: 5px; margin-bottom: 3px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
          .item-row:last-child { border-bottom: none; }
          .item-img { width: 26px; height: 26px; object-fit: cover; border: 1px solid #ccc; border-radius: 3px; background: #fff; flex-shrink: 0; }
          .item-name { flex: 1; min-width: 0; line-height: 1.2; }

          .footer { 
            border-top: 2px solid #000; 
            padding-top: 5px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
          }
          .cod-badge { 
            background: #FFD700; 
            color: #000; 
            padding: 6px 10px; 
            border-radius: 4px;
            text-align: right;
            border: 1.5px solid #000;
          }
          .cod-label { font-size: 10pt; font-weight: 900; text-transform: uppercase; display: block; line-height: 1; }
          .cod-value { font-size: 13pt; font-weight: 900; }
          .thank-you { font-size: 7pt; color: #555; text-transform: uppercase; letter-spacing: 0.3px; }
        </style>
      </head>
      <body>
        ${orders.map(o => {
          const reseller = resellerMap.get(o.reseller_id);
          const s = shipmentsByOrder.get(o.id);
          const oItems = itemsByOrder.get(o.id) || [];
          const brand = courierBrand(s?.provider);
          const brandLogo = brand ? new URL(brand.wordmark, window.location.origin).href : "";
          const booking = s?.tracking_id || s?.consignment_id || "";

          return `
            <div class="label">
              <div class="header">
                <div class="reseller-info">
                  ${reseller?.logo ? `<img src="${reseller.logo}" class="reseller-logo" />` : ""}
                  <div class="site-name">${reseller?.name || siteName}</div>
                </div>
                <div class="order-block">
                  <div class="barcode">${code128Svg(String(o.order_number), { height: 34 })}</div>
                  <div class="order-num">#${o.order_number}</div>
                </div>
              </div>
              <div class="courier-bar">
                ${brandLogo ? `<img src="${brandLogo}" class="courier-logo" />` : ""}
                <div class="courier-meta">
                  ${brandLogo ? "" : `<div class="courier-name">${courierLabel(s?.provider) === "—" ? "Manual" : courierLabel(s?.provider)}</div>`}
                  <div class="booking-id">${booking || "PENDING"}</div>
                  ${booking ? `<div class="barcode">${code128Svg(booking, { height: 38 })}</div>` : ""}
                </div>
              </div>
              <div class="customer">
                <div class="section-title">Recipient</div>
                <div class="name">${o.customer_name}</div>
                <div class="phone">${o.customer_phone}</div>
                <div class="address">${o.address_line}<br><strong>${o.area.replace("_", " ")}</strong></div>
              </div>
              <div class="items-box">
                <div class="section-title">Order Items</div>
                ${oItems.map(it => `<div class="item-row">${it.product_image ? `<img src="${it.product_image}" class="item-img" />` : ""}<span class="item-name">${it.product_name} <strong>x ${it.quantity}</strong></span></div>`).join("")}
              </div>
              <div class="footer">
                <div class="thank-you">Thank you for shopping with us</div>
                <div class="cod-badge">
                  <span class="cod-label">COD</span>
                  <span class="cod-value">৳${Number(o.total).toFixed(0)}</span>
                </div>
              </div>
            </div>
          `;
        }).join("")}
        <script>window.onload = () => { setTimeout(() => { window.print(); setTimeout(() => window.close(), 500); }, 400); }</script>

      </body>
    </html>
  `);
  win.document.close();
}
