import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AppModal } from "@/components/ui-kit/AppModal";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Tag, Package, Truck } from "lucide-react";
import { deliveryLabel } from "@/lib/delivery";

export type RateDraft = { price: string; pack: string; dmode: string; flat: string; inside: string; sub: string; outside: string };
type Product = { name: string; reseller_price: number; packaging_cost: number; delivery_mode: string | null; delivery_flat: number | null; delivery_inside: number | null; delivery_outside: number | null; delivery_sub: number | null };
const money = (value: number) => `৳${Number(value || 0).toLocaleString()}`;

export function ResellerRateEditor({ product, resellerName, draft, onField, onSave, onClose, saving }: {
  product: Product; resellerName: string; draft: RateDraft;
  onField: (key: keyof RateDraft, value: string) => void; onSave: () => void; onClose: () => void; saving: boolean;
}) {
  const field = (key: keyof RateDraft, label: string, placeholder = "0") => (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      <Input aria-label={label} type="number" min={0} step="0.01" placeholder={placeholder} value={draft[key]} onChange={(e) => onField(key, e.target.value)} />
    </label>
  );
  const price = draft.price.trim() ? Number(draft.price) : Number(product.reseller_price);
  const pack = draft.pack.trim() ? Number(draft.pack) : Number(product.packaging_cost);
  return (
    <AppModal title={product.name} subtitle={resellerName} onClose={() => { if (!saving) onClose(); }} footer={
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">Price + packaging <strong className="ml-1 text-base text-foreground">{money(price + pack)}</strong></div>
        <Button onClick={onSave} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />}Save rates</Button>
      </div>
    }>
      <Tabs defaultValue="price">
        <TabsList className="mb-5 grid h-auto w-full grid-cols-3">
          <TabsTrigger value="price" className="gap-1.5 px-2"><Tag className="h-4 w-4" />Price</TabsTrigger>
          <TabsTrigger value="packaging" className="gap-1.5 px-2"><Package className="h-4 w-4" />Packaging</TabsTrigger>
          <TabsTrigger value="delivery" className="gap-1.5 px-2"><Truck className="h-4 w-4" />Delivery</TabsTrigger>
        </TabsList>
        <TabsContent value="price" className="min-h-44 space-y-4">
          <div className="flex items-center justify-between border-b pb-3 text-sm text-muted-foreground"><span>Master price</span><strong className="text-foreground">{money(product.reseller_price)}</strong></div>
          {field("price", "Custom product price", String(product.reseller_price))}
          <div className="text-xs text-muted-foreground">{draft.price.trim() ? "Custom price" : "Master price"}: {money(price)}</div>
        </TabsContent>
        <TabsContent value="packaging" className="min-h-44 space-y-4">
          <div className="flex items-center justify-between border-b pb-3 text-sm text-muted-foreground"><span>Master packaging</span><strong className="text-foreground">{money(product.packaging_cost)}</strong></div>
          {field("pack", "Custom packaging cost", String(product.packaging_cost))}
          <div className="text-xs text-muted-foreground">{draft.pack.trim() ? "Custom packaging" : "Master packaging"}: {money(pack)}</div>
        </TabsContent>
        <TabsContent value="delivery" className="min-h-44 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 text-sm text-muted-foreground"><span>Master delivery</span><strong className="text-foreground">{deliveryLabel(product)}</strong></div>
          <label className="block space-y-2 text-sm font-medium"><span>Delivery rule</span>
            <select aria-label="Delivery rule" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={draft.dmode} onChange={(e) => onField("dmode", e.target.value)}>
              <option value="">Master rule</option><option value="area">Area-wise</option><option value="flat">Flat</option><option value="free">Free</option><option value="custom">Custom</option>
            </select>
          </label>
          {draft.dmode === "area" && <div className="grid grid-cols-3 gap-3">{field("inside", "Dhaka")}{field("sub", "Sub", draft.outside || "Outside rate")}{field("outside", "Outside")}</div>}
          {(draft.dmode === "flat" || draft.dmode === "custom") && field("flat", "Delivery charge")}
          {draft.dmode === "free" && <div className="text-sm font-semibold text-primary">Free delivery · ৳0</div>}
        </TabsContent>
      </Tabs>
    </AppModal>
  );
}