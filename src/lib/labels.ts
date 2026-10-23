import { orderCodDue } from "@/lib/order-payment";
import { supabase } from "@/integrations/supabase/client";
import { getGlobalSettings } from "@/lib/app-data";
import { courierLabel, courierBrand } from "@/components/courier-brand";
import { code128Svg } from "@/lib/barcode";

/**
 * Converts any product image or logo into a high-contrast, crystal-clear 1-bit photograph
 * optimized for thermal label printers.
 * - Auto-levels normalize contrast so products pop with high clarity.
 * - Edge sharpening ensures contours, seams, and shapes are immediately recognizable.
 * - Atkinson error diffusion renders natural photographic shading without checkerboard noise.
 * - Pure white background ensures no dark transparency or background speckles.
 */
async function toPhotocopyDataUrl(imageUrl?: string | null): Promise<string> {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("data:image/svg+xml")) return imageUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let done = false;
    const finish = (res: string) => {
      if (!done) {
        done = true;
        resolve(res);
      }
    };

    img.onload = () => {
      try {
        const maxDim = 96;
        let w = img.naturalWidth || 96;
        let h = img.naturalHeight || 96;
        if (w > maxDim || h > maxDim) {
          if (w >= h) {
            h = Math.max(1, Math.round((h * maxDim) / w));
            w = maxDim;
          } else {
            w = Math.max(1, Math.round((w * maxDim) / h));
            h = maxDim;
          }
        }
        const cvs = document.createElement("canvas");
        cvs.width = w;
        cvs.height = h;
        const ctx = cvs.getContext("2d", { willReadFrequently: true });
        if (!ctx) return finish(imageUrl);

        // Fill pure white to eradicate dark transparency
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        const src = new Float32Array(w * h);

        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3] / 255;
          const r = d[i] * a + 255 * (1 - a);
          const g = d[i + 1] * a + 255 * (1 - a);
          const b = d[i + 2] * a + 255 * (1 - a);
          src[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
        }

        // 1. Unsharp mask: Box blur for edge & texture contrast enhancement
        const blur = new Float32Array(w * h);
        const radius = 1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            let sum = 0, count = 0;
            for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx, ny = y + dy;
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                  sum += src[ny * w + nx];
                  count++;
                }
              }
            }
            blur[y * w + x] = sum / count;
          }
        }

        // 2. Auto-Levels: Calculate min and max luminance of actual product content
        let minLum = 255, maxLum = 0;
        for (let i = 0; i < w * h; i++) {
          if (src[i] < 220) {
            if (src[i] < minLum) minLum = src[i];
            if (src[i] > maxLum) maxLum = src[i];
          }
        }
        if (minLum >= maxLum) { minLum = 0; maxLum = 255; }

        // 3. Contrast stretch & gamma lifting for rich, legible photographic tone
        const tone = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
          if (src[i] >= 220) {
            tone[i] = 255; // Crisp pure white background
          } else {
            // Enhanced sharpness
            const sharp = src[i] + (src[i] - blur[i]) * 0.65;
            let norm = (sharp - minLum) / (maxLum - minLum);
            if (norm < 0) norm = 0;
            if (norm > 1) norm = 1;
            // Gamma curve: lifts shadows slightly so dark fabrics don't turn into a black blob
            norm = Math.pow(norm, 0.72);
            norm = 0.08 + norm * 0.92;
            tone[i] = norm * 255;
          }
        }

        // 4. Atkinson Dithering: crisp contours, sharp text, and natural photographic gradients
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const oldVal = tone[idx];
            const newVal = oldVal > 128 ? 255 : 0;
            tone[idx] = newVal;
            const err = (oldVal - newVal) / 8;
            if (err === 0) continue;
            if (x + 1 < w) tone[idx + 1] += err;
            if (x + 2 < w) tone[idx + 2] += err;
            if (y + 1 < h) {
              if (x > 0) tone[idx + w - 1] += err;
              tone[idx + w] += err;
              if (x + 1 < w) tone[idx + w + 1] += err;
            }
            if (y + 2 < h) {
              tone[idx + 2 * w] += err;
            }
          }
        }

        for (let j = 0; j < tone.length; j++) {
          const v = tone[j] > 128 ? 255 : 0;
          const p = j * 4;
          d[p] = v;
          d[p + 1] = v;
          d[p + 2] = v;
          d[p + 3] = 255;
        }

        ctx.putImageData(imgData, 0, 0);
        finish(cvs.toDataURL("image/png"));
      } catch {
        finish(imageUrl);
      }
    };
    img.onerror = () => finish(imageUrl);
    setTimeout(() => finish(imageUrl), 800);
    img.src = imageUrl;
  });
}

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
            <div style="color:#777;font-size:11px;">Generating photocopy labels...</div>
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

  // Pre-process all unique images to photocopy B&W in parallel in the main window
  const uniqueUrls = new Set<string>();
  orders.forEach((o) => {
    const r = Array.isArray(o.resellers) ? o.resellers[0] : o.resellers;
    const sSettings = Array.isArray(r?.reseller_settings) ? r?.reseller_settings[0] : r?.reseller_settings;
    if (sSettings?.logo_url) uniqueUrls.add(sSettings.logo_url);

    const s = Array.isArray(o.shipments) ? o.shipments[0] : o.shipments;
    const brand = courierBrand(s?.provider);
    if (brand) uniqueUrls.add(new URL(brand.wordmark, window.location.origin).href);

    const oItems = ((o as any).order_items || []) as Array<{ product_image?: string | null }>;
    oItems.forEach((it) => {
      if (it.product_image) uniqueUrls.add(it.product_image);
    });
  });

  const urlEntries = Array.from(uniqueUrls);
  const dataUrls = await Promise.all(urlEntries.map((u) => toPhotocopyDataUrl(u)));
  const imageMap = new Map<string, string>();
  urlEntries.forEach((u, i) => imageMap.set(u, dataUrls[i]));

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
          .reseller-logo { width: 32px; height: 32px; object-fit: contain; background: #fff; flex-shrink: 0; }
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
          .item-img { width: 38px; height: 38px; object-fit: contain; border: 1.5px solid #000; border-radius: 2px; background: #fff; flex-shrink: 0; }
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
            img:not([src^="data:"]) {
              filter: grayscale(100%) brightness(1.2) contrast(1.5);
            }
          }
        </style>
      </head>
      <body>
        ${orders.map(o => {
          const r = Array.isArray(o.resellers) ? o.resellers[0] : o.resellers;
          const sSettings = Array.isArray(r?.reseller_settings) ? r?.reseller_settings[0] : r?.reseller_settings;
          const originalLogo = sSettings?.logo_url || null;
          const logoSrc = originalLogo ? (imageMap.get(originalLogo) || originalLogo) : null;
          const resellerName = sSettings?.store_name || r?.business_name;

          const s = Array.isArray(o.shipments) ? o.shipments[0] : o.shipments;
          const oItems = ((o as any).order_items || []) as Array<{ product_name: string; product_image?: string | null; quantity: number }>;
          const brand = courierBrand(s?.provider);
          const originalBrandLogo = brand ? new URL(brand.wordmark, window.location.origin).href : "";
          const brandLogoSrc = originalBrandLogo ? (imageMap.get(originalBrandLogo) || originalBrandLogo) : "";
          const booking = s?.tracking_id || s?.consignment_id || "";

          return `
            <div class="label">
              <div class="header">
                <div class="reseller-info">
                  ${logoSrc ? `<img src="${logoSrc}" class="reseller-logo" />` : ""}
                  <div class="site-name">${resellerName || siteName}</div>
                </div>
                <div class="order-block">
                  <div class="barcode">${code128Svg(String(o.order_number), { height: 30 })}</div>
                  <div class="order-num">#${o.order_number}</div>
                </div>
              </div>
              <div class="courier-bar">
                ${brandLogoSrc ? `<div class="courier-brand"><img src="${brandLogoSrc}" class="courier-logo" /><div class="courier-brand-name">${courierLabel(s?.provider)}</div></div>` : ""}
                <div class="courier-meta">
                  ${brandLogoSrc ? "" : `<div class="courier-name">${courierLabel(s?.provider) === "—" ? "Manual" : courierLabel(s?.provider)}</div>`}
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
                ${oItems.map(it => {
                  const itemImgSrc = it.product_image ? (imageMap.get(it.product_image) || it.product_image) : null;
                  return `<div class="item-row">${itemImgSrc ? `<img src="${itemImgSrc}" class="item-img" />` : ""}<span class="item-name">${it.product_name} <strong>x ${it.quantity}</strong></span></div>`;
                }).join("")}
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
          window.onafterprint = function() {
            window.close();
          };
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 150);
          };
        </script>
      </body>
    </html>
  `);
  win.document.close();
}
