import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProcurementItem = {
  productId: string;
  productName: string;
  productImage: string | null;
  sku: string | null;
  totalQuantity: number;
  orderCount: number;
  orderNumbers: string[];
  stock: number | null;
  hasShortage: boolean;
  shortageQty: number;
};

export type ConfirmedProcurementData = {
  totalConfirmedOrders: number;
  totalUniqueProducts: number;
  totalQuantityToPick: number;
  shortageProductsCount: number;
  items: ProcurementItem[];
  orderNumbers: string[];
};

export function useConfirmedProcurement(resellerId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["confirmed-procurement", resellerId ?? "admin"],
    enabled,
    queryFn: async (): Promise<ConfirmedProcurementData> => {
      let query = supabase
        .from("orders")
        .select(`
          id,
          order_number,
          status,
          reseller_id,
          created_at,
          order_items (
            id,
            product_id,
            product_name,
            product_image,
            sku,
            quantity,
            products (
              id,
              name,
              stock,
              product_code,
              og_image_url
            )
          )
        `)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false });

      if (resellerId) {
        query = query.eq("reseller_id", resellerId);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Failed to load confirmed orders for procurement:", error);
        return {
          totalConfirmedOrders: 0,
          totalUniqueProducts: 0,
          totalQuantityToPick: 0,
          shortageProductsCount: 0,
          items: [],
          orderNumbers: [],
        };
      }

      const orders = data || [];
      const productMap = new Map<string, ProcurementItem>();
      const allOrderNumbers: string[] = [];

      for (const order of orders) {
        if (order.order_number) {
          allOrderNumbers.push(order.order_number);
        }

        const items = ((order as any).order_items || []) as any[];
        for (const item of items) {
          const prod = item.products;
          const pid = item.product_id || item.product_name || "unknown";
          const qty = Number(item.quantity || 1);
          const stock = prod?.stock != null ? Number(prod.stock) : null;

          const existing = productMap.get(pid);
          if (existing) {
            existing.totalQuantity += qty;
            if (order.order_number && !existing.orderNumbers.includes(order.order_number)) {
              existing.orderNumbers.push(order.order_number);
              existing.orderCount = existing.orderNumbers.length;
            }
          } else {
            productMap.set(pid, {
              productId: item.product_id || "",
              productName: prod?.name || item.product_name || "Unknown Product",
              productImage: prod?.og_image_url || item.product_image || null,
              sku: prod?.product_code || item.sku || null,
              totalQuantity: qty,
              orderCount: order.order_number ? 1 : 0,
              orderNumbers: order.order_number ? [order.order_number] : [],
              stock,
              hasShortage: false,
              shortageQty: 0,
            });
          }
        }
      }

      const items = Array.from(productMap.values()).map((it) => {
        const hasShortage = it.stock != null && it.stock < it.totalQuantity;
        const shortageQty = hasShortage ? it.totalQuantity - (it.stock || 0) : 0;
        return {
          ...it,
          hasShortage,
          shortageQty,
        };
      });

      // Sort: items with shortages first, then highest quantity to pick descending
      items.sort((a, b) => {
        if (a.hasShortage && !b.hasShortage) return -1;
        if (!a.hasShortage && b.hasShortage) return 1;
        return b.totalQuantity - a.totalQuantity;
      });

      const totalQuantityToPick = items.reduce((sum, it) => sum + it.totalQuantity, 0);
      const shortageProductsCount = items.filter((it) => it.hasShortage).length;

      return {
        totalConfirmedOrders: orders.length,
        totalUniqueProducts: items.length,
        totalQuantityToPick,
        shortageProductsCount,
        items,
        orderNumbers: allOrderNumbers,
      };
    },
    staleTime: 45 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Clean printable Pick List for warehouse / procurement staff
 */
export function printProcurementList(data: ConfirmedProcurementData, siteTitle = "Procurement Pick List") {
  const win = window.open("", "_blank", "width=850,height=950");
  if (!win) return;

  const dateStr = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const rowsHtml = data.items
    .map(
      (it, idx) => `
    <tr>
      <td style="text-align:center;width:40px;"><div style="width:18px;height:18px;border:2px solid #333;margin:0 auto;border-radius:3px;"></div></td>
      <td style="text-align:center;width:35px;font-weight:bold;">${idx + 1}</td>
      <td style="width:55px;text-align:center;">
        ${it.productImage ? `<img src="${it.productImage}" style="width:44px;height:44px;object-fit:cover;border-radius:4px;border:1px solid #ddd;" />` : `<div style="width:44px;height:44px;background:#eee;border-radius:4px;display:inline-block;line-height:44px;font-size:10px;color:#888;">No img</div>`}
      </td>
      <td>
        <div style="font-weight:bold;font-size:13px;color:#111;">${it.productName}</div>
        <div style="font-size:11px;color:#666;margin-top:2px;">SKU: ${it.sku || "—"}</div>
        <div style="font-size:10px;color:#888;margin-top:2px;">অর্ডারসমূহ: ${it.orderNumbers.map((n) => "#" + n).join(", ")}</div>
      </td>
      <td style="text-align:center;font-size:14px;font-weight:900;color:#000;">
        <span style="background:#f1f5f9;padding:4px 8px;border-radius:4px;border:1px solid #cbd5e1;">${it.totalQuantity} টি</span>
      </td>
      <td style="text-align:center;font-size:12px;">
        ${
          it.stock == null
            ? '<span style="color:#64748b;">স্টক আনট্র্যাকড</span>'
            : it.hasShortage
              ? `<span style="color:#dc2626;font-weight:bold;background:#fee2e2;padding:3px 6px;border-radius:3px;">স্টক: ${it.stock} (ঘাটতি: ${it.shortageQty})</span>`
              : `<span style="color:#16a34a;font-weight:600;">স্টক: ${it.stock}</span>`
        }
      </td>
    </tr>
  `,
    )
    .join("");

  win.document.open();
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${siteTitle} - ${dateStr}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 10px; font-size: 12px; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
          .header h1 { margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
          .header .meta { font-size: 11px; color: #64748b; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
          .stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; text-align: center; }
          .stat-val { font-size: 16px; font-weight: 800; color: #0f172a; }
          .stat-lbl { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; }
          th { background: #f1f5f9; color: #334155; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 6px; border: 1px solid #cbd5e1; text-align: left; }
          td { padding: 6px 6px; border: 1px solid #e2e8f0; vertical-align: middle; }
          tr:nth-child(even) { background: #fafafa; }
          .footer { margin-top: 18px; border-top: 1px dashed #cbd5e1; padding-top: 8px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
          @media print {
            body { padding: 0; }
            button { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>📦 পণ্য সংগ্রহ ও প্যাকেজিং স্লিপ (Pick List)</h1>
            <div class="meta">${siteTitle} · প্রস্তুত সময়: ${dateStr}</div>
          </div>
          <div style="text-align:right;">
            <button onclick="window.print()" style="padding:6px 14px;background:#0f172a;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;">Print Slip</button>
          </div>
        </div>

        <div class="summary">
          <div class="stat">
            <div class="stat-val">${data.totalConfirmedOrders}</div>
            <div class="stat-lbl">কনফার্মড অর্ডার</div>
          </div>
          <div class="stat">
            <div class="stat-val">${data.totalQuantityToPick} পিস</div>
            <div class="stat-lbl">সংগ্রহের পরিমাণ</div>
          </div>
          <div class="stat">
            <div class="stat-val">${data.totalUniqueProducts}</div>
            <div class="stat-lbl">প্রোডাক্ট ভ্যারাইটি</div>
          </div>
          <div class="stat" style="${data.shortageProductsCount > 0 ? "border-color:#fca5a5;background:#fff1f2;" : ""}">
            <div class="stat-val" style="${data.shortageProductsCount > 0 ? "color:#e11d48;" : ""}">${data.shortageProductsCount}</div>
            <div class="stat-lbl" style="${data.shortageProductsCount > 0 ? "color:#e11d48;" : ""}">স্টক ঘাটতি</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:30px;text-align:center;">পিক</th>
              <th style="width:30px;text-align:center;">#</th>
              <th style="width:55px;text-align:center;">ছবি</th>
              <th>প্রোডাক্ট ও বিবরণ</th>
              <th style="width:90px;text-align:center;">প্রয়োজনীয় পরিমাণ</th>
              <th style="width:120px;text-align:center;">বর্তমান স্টক</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8;">কোনো পেন্ডিং পণ্য নেই</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          <div>টিম নোট: পণ্য সংগ্রহের পর প্যাকেজিং সম্পন্ন করে অর্ডার স্ট্যাটাস 'Packaging' বা 'Ready to Ship' এ আপডেট করুন।</div>
          <div>ধন্যবাদ</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 250);
          }
        </script>
      </body>
    </html>
  `);
  win.document.close();
}
