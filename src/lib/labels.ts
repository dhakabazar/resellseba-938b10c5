import { orderCodDue } from "@/lib/order-payment";
import { supabase } from "@/integrations/supabase/client";
import { getGlobalSettings } from "@/lib/app-data";
import { courierLabel, courierBrand } from "@/components/courier-brand";
import { code128Svg } from "@/lib/barcode";

export async function printShippingLabels(orderIds: string[], forceSize?: "3x3" | "3x4") {
  if (!orderIds || !orderIds.length) return;

  // Open window synchronously on user click to prevent popup blockers and give instant feedback
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>Loading Labels...</title></head>
        <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#333;font-size:13px;background:#fff;">
          <div style="text-align:center;">
            <div style="font-weight:bold;margin-bottom:4px;">Preparing ${orderIds.length} Label${orderIds.length > 1 ? "s" : ""}...</div>
            <div style="color:#777;font-size:11px;">Fast loading invoices...</div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
  }

  // Single unified database call: fetch orders with items, shipments, and reseller in 1 query
  const [settings, { data: orders, error }] = await Promise.all([
    getGlobalSettings(),
    supabase
      .from("orders")
      .select(`
        id,
        order_number,
        customer_name,
        customer_phone,
        address_line,
        area,
        total,
        advance_amount,
        paid_amount,
        reseller_id,
        order_items (product_name, product_image, quantity),
        shipments (provider, tracking_id, consignment_id),
        resellers!orders_reseller_id_fkey (id, business_name, reseller_settings (logo_url, store_name))
      `)
      .in("id", orderIds)
  ]);

  if (error || !orders || orders.length === 0) {
    if (win) {
      win.document.body.innerHTML = "<div style='color:red;padding:20px;font-family:sans-serif;text-align:center;'>No orders found or error loading orders.</div>";
    }
    return;
  }

  const size = forceSize || (settings as any)?.label_size || "3x4";
  const siteName = settings?.site_name || "ResellHub";

  const width = size === "3x3" ? "3in" : "3in";
  const height = size === "3x3" ? "3in" : "4in";

  if (!win) return;

  win.document.open();
  win.document.write(`
    <html>
      <head>
        <title>Shipping Labels - ${size}</title>
        <style>
          @page { size: ${width} ${height}; margin: 0; }
          body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #fff; color: #000; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
          img {
            background: #fff;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }
          .label { 
            width: ${width}; 
            height: ${height}; 
            padding: 0.1in; 
            box-sizing: border-box; 
            border: 2px solid #000;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
            background: #fff;
          }
          .header { 
            border-bottom: 2px solid #000; 
            padding-bottom: 2px; 
            margin-bottom: 4px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            gap: 2px;
          }
          .reseller-info { display: flex; align-items: center; gap: 4px; min-width: 0; flex: 1; }
          .reseller-logo { width: 30px; height: 30px; object-fit: contain; background: #fff; flex-shrink: 0; }
          .site-name { font-size: 9.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; color: #000; }
          .order-block { text-align: center; width: 28%; }
          .order-num { font-size: 10.5pt; font-weight: 900; letter-spacing: 0.5px; line-height: 1; margin-top: 1px; color: #000; }
          .barcode { display: block; }
          .barcode svg { display: block; width: 100%; height: auto; }
          .order-block .barcode { width: 100%; margin: 0 auto; }

          .section-title { font-size: 7.5pt; text-transform: uppercase; color: #000; font-weight: 900; margin-bottom: 2px; letter-spacing: 0.3px; }

          .courier-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            border: 1.5px solid #000;
            border-radius: 4px;
            padding: 4px 6px;
            margin-bottom: 4px;
            background: #fff;
          }
          .courier-brand { width: 0.85in; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 1px; }
          .courier-logo { height: 24px; max-width: 0.85in; object-fit: contain; background: #fff; }
          .courier-brand-name { max-width: 100%; font-size: 5.5pt; line-height: 1; font-weight: 800; text-transform: uppercase; text-align: center; color: #000; }
          .courier-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: stretch; gap: 3px; }
          .courier-name { font-size: 8pt; font-weight: 800; text-transform: uppercase; text-align: center; color: #000; }
          .booking-id { font-size: 12pt; font-weight: 900; font-family: 'Courier New', monospace; letter-spacing: 0.5px; text-align: center; color: #000; }
          .courier-bar .barcode { width: 100%; max-width: 2.3in; margin: 0 auto; }

          .customer { 
            border: 1.5px solid #000;
            padding: 4px;
            margin-bottom: 4px;
            border-radius: 4px;
            background: #fff;
          }
          .name { font-size: 11pt; font-weight: 800; margin-bottom: 2px; color: #000; }
          .phone { font-size: 10pt; font-weight: bold; margin-bottom: 3px; display: block; border-bottom: 1px dashed #000; width: fit-content; color: #000; }
          .address { font-size: 8pt; line-height: 1.25; font-weight: 500; color: #000; }
          
          .items-box {
            border: 1.5px solid #000;
            padding: 4px;
            flex-grow: 1;
            margin-bottom: 4px;
            border-radius: 4px;
            background: #fff;
            font-size: 8pt;
            overflow: hidden;
          }
          .item-row { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; border-bottom: 1px dashed #777; padding-bottom: 3px; }
          .item-row:last-child { border-bottom: none; }
          .item-img { width: 34px; height: 34px; object-fit: contain; border: 1.5px solid #000; border-radius: 2px; background: #fff; flex-shrink: 0; }
          .item-name { flex: 1; min-width: 0; line-height: 1.2; font-weight: 600; color: #000; }

          .footer { 
            border-top: 2px solid #000; 
            padding-top: 2px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            background: #fff;
          }
          .cod-badge { 
            background: #fff !important; 
            color: #000 !important; 
            padding: 2px 8px; 
            border-radius: 4px;
            text-align: right;
            border: 2px solid #000;
            display: inline-flex;
            align-items: baseline;
            gap: 5px;
          }
          .cod-label { font-size: 9.5pt; font-weight: 900; text-transform: uppercase; line-height: 1; color: #000; letter-spacing: 0.5px; }
          .cod-value { font-size: 11.5pt; font-weight: 900; color: #000; }
          .thank-you { font-size: 6pt; color: #000; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }

          @media print {
            img.dither-fallback {
              filter: grayscale(100%) brightness(1.3) contrast(1.7);
            }
          }
        </style>
      </head>
      <body>
        ${orders.map(o => {
          const r = Array.isArray(o.resellers) ? o.resellers[0] : o.resellers;
          const sSettings = Array.isArray(r?.reseller_settings) ? r?.reseller_settings[0] : r?.reseller_settings;
          const reseller = r ? {
            name: sSettings?.store_name || r.business_name,
            logo: sSettings?.logo_url || null
          } : null;

          const s = Array.isArray(o.shipments) ? o.shipments[0] : o.shipments;
          const oItems = ((o as any).order_items || []) as Array<{ product_name: string; product_image?: string | null; quantity: number }>;
          const brand = courierBrand(s?.provider);
          const brandLogo = brand ? new URL(brand.wordmark, window.location.origin).href : "";
          const booking = s?.tracking_id || s?.consignment_id || "";

          return `
            <div class="label">
              <div class="header">
                <div class="reseller-info">
                  ${reseller?.logo ? `<img src="${reseller.logo}" class="reseller-logo" crossorigin="anonymous" />` : ""}
                  <div class="site-name">${reseller?.name || siteName}</div>
                </div>
                <div class="order-block">
                  <div class="barcode">${code128Svg(String(o.order_number), { height: 30 })}</div>
                  <div class="order-num">#${o.order_number}</div>
                </div>
              </div>
              <div class="courier-bar">
                ${brandLogo ? `<div class="courier-brand"><img src="${brandLogo}" class="courier-logo" crossorigin="anonymous" /><div class="courier-brand-name">${courierLabel(s?.provider)}</div></div>` : ""}
                <div class="courier-meta">
                  ${brandLogo ? "" : `<div class="courier-name">${courierLabel(s?.provider) === "—" ? "Manual" : courierLabel(s?.provider)}</div>`}
                  ${booking ? `<div class="barcode">${code128Svg(booking, { height: 36 })}</div>` : ""}
                  <div class="booking-id">${booking || "PENDING"}</div>
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
                ${oItems.map(it => `<div class="item-row">${it.product_image ? `<img src="${it.product_image}" class="item-img" crossorigin="anonymous" />` : ""}<span class="item-name">${it.product_name} <strong>x ${it.quantity}</strong></span></div>`).join("")}
              </div>
              <div class="footer">
                <div class="thank-you">Thank you for shopping with us</div>
                <div class="cod-badge">
                  <span class="cod-label">COD</span>
                  <span class="cod-value">৳${orderCodDue(o).toFixed(0)}</span>
                </div>
              </div>
            </div>
          `;
        }).join("")}
        <script>
          var ditherCache = {};

          function processImage(img) {
            return new Promise(function(resolve) {
              var src = img.getAttribute('src');
              if (!src) return resolve();
              if (ditherCache[src]) {
                img.src = ditherCache[src];
                return resolve();
              }
              function run() {
                try {
                  if (!img.complete || img.naturalWidth === 0) {
                    img.onload = run;
                    img.onerror = function() { resolve(); };
                    return;
                  }
                  if (ditherCache[src]) {
                    img.src = ditherCache[src];
                    return resolve();
                  }
                  var maxDim = 72;
                  var w = img.naturalWidth;
                  var h = img.naturalHeight;
                  if (!w || !h) return resolve();
                  if (w > maxDim || h > maxDim) {
                    if (w >= h) {
                      h = Math.round((h * maxDim) / w);
                      w = maxDim;
                    } else {
                      w = Math.round((w * maxDim) / h);
                      h = maxDim;
                    }
                  }
                  var cvs = document.createElement('canvas');
                  cvs.width = w;
                  cvs.height = h;
                  var ctx = cvs.getContext('2d', { willReadFrequently: true });
                  if (!ctx) return resolve();

                  // Fill white background to eliminate black transparency issues
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0, 0, w, h);
                  ctx.drawImage(img, 0, 0, w, h);

                  var imgData = ctx.getImageData(0, 0, w, h);
                  var d = imgData.data;
                  var gray = new Float32Array(w * h);

                  for (var i = 0; i < d.length; i += 4) {
                    var a = d[i + 3] / 255;
                    var r = d[i] * a + 255 * (1 - a);
                    var g = d[i + 1] * a + 255 * (1 - a);
                    var b = d[i + 2] * a + 255 * (1 - a);
                    var lum = 0.299 * r + 0.587 * g + 0.114 * b;

                    // Clean white background & lift dark tones for photocopy/laser readability
                    if (lum >= 215 || a < 0.1) {
                      gray[i / 4] = 255;
                    } else {
                      lum = Math.pow(lum / 255, 0.65) * 255;
                      lum = (lum - 128) * 1.3 + 128;
                      gray[i / 4] = Math.max(0, Math.min(255, lum));
                    }
                  }

                  // Atkinson Dithering (75% error diffusion for crisp 1-bit thermal print)
                  for (var y = 0; y < h; y++) {
                    for (var x = 0; x < w; x++) {
                      var idx = y * w + x;
                      var oldVal = gray[idx];
                      var newVal = oldVal > 128 ? 255 : 0;
                      gray[idx] = newVal;
                      var err = (oldVal - newVal) / 8;
                      if (err === 0) continue;
                      if (x + 1 < w) gray[idx + 1] += err;
                      if (x + 2 < w) gray[idx + 2] += err;
                      if (y + 1 < h) {
                        if (x > 0) gray[idx + w - 1] += err;
                        gray[idx + w] += err;
                        if (x + 1 < w) gray[idx + w + 1] += err;
                      }
                      if (y + 2 < h) {
                        gray[idx + 2 * w] += err;
                      }
                    }
                  }

                  for (var j = 0; j < gray.length; j++) {
                    var v = gray[j] > 128 ? 255 : 0;
                    var p = j * 4;
                    d[p] = v;
                    d[p + 1] = v;
                    d[p + 2] = v;
                    d[p + 3] = 255;
                  }
                  ctx.putImageData(imgData, 0, 0);
                  var resultDataUrl = cvs.toDataURL('image/png');
                  ditherCache[src] = resultDataUrl;
                  img.src = resultDataUrl;
                  resolve();
                } catch (e) {
                  img.classList.add('dither-fallback');
                  resolve();
                }
              }
              run();
            });
          }

          function processAll() {
            var imgs = Array.from(document.querySelectorAll('img'));
            if (imgs.length === 0) {
              window.print();
              setTimeout(function() { window.close(); }, 300);
              return;
            }
            var timeout = new Promise(function(res) { setTimeout(res, 1200); });
            Promise.race([Promise.all(imgs.map(processImage)), timeout]).then(function() {
              requestAnimationFrame(function() {
                setTimeout(function() {
                  window.print();
                  setTimeout(function() { window.close(); }, 500);
                }, 50);
              });
            });
          }

          var started = false;
          function runOnce() {
            if (started) return;
            started = true;
            processAll();
          }

          if (document.readyState === 'complete') {
            runOnce();
          } else {
            window.addEventListener('load', runOnce);
          }
        </script>
      </body>
    </html>
  `);
  win.document.close();
}
