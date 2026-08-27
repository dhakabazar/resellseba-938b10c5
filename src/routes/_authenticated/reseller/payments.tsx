import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Globe2, Loader2, Plus, Trash2, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { AppModal } from "@/components/ui-kit/AppModal";
import { confirmAction } from "@/lib/confirm";
import { getMyReseller } from "@/lib/app-data";
import { listActiveGateways, listDepositGateways } from "@/lib/gateways.functions";
import { GatewayGrid } from "@/components/payments/gateway-grid";

import { MANUAL_METHODS, cfgBool, cfgString, methodLabel, type PaymentConfigRow } from "@/lib/payment-methods";
import { Label, StatusDot, Switch, field } from "@/components/payments/shared";
import { PaymentLogo, paymentLogo } from "@/components/payments/payment-brand";

export const Route = createFileRoute("/_authenticated/reseller/payments")({
  component: ResellerPaymentsPage,
  head: () => ({
    meta: [
      { title: "Store payment methods · Reseller" },
      {
        name: "description",
        content:
          "See the global payment methods the platform keeps active for your store and add your own wallet or bank numbers for checkout.",
      },
      { property: "og:title", content: "Store payment methods · Reseller" },
      {
        property: "og:description",
        content: "Global methods plus your own wallet numbers, in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Draft = PaymentConfigRow & { config: Record<string, unknown> };

const emptyDraft = (): Draft => ({
  id: "",
  method: MANUAL_METHODS[0]!.value,
  label: "",
  mode: "manual",
  is_active: true,
  instructions: null,
  config: { account: "", account_type: "" },
});

function ResellerPaymentsPage() {
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [globalManual, setGlobalManual] = useState<PaymentConfigRow[]>([]);
  const [gateways, setGateways] = useState<{ provider: string; label: string; method: string }[]>([]);
  const [platformGateways, setPlatformGateways] = useState<{ provider: string; label: string }[]>([]);
  const [myGw, setMyGw] = useState<{ id: string; provider: string; is_active: boolean; mode: string }[]>([]);
  const [mine, setMine] = useState<PaymentConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"manual" | "api">("manual");
  const [draft, setDraft] = useState<Draft | null>(null);
  const loadGateways = useServerFn(listActiveGateways);
  const loadPlatformGateways = useServerFn(listDepositGateways);

  async function loadMyGateways(rid: string) {
    const { data } = await supabase
      .from("payment_gateway_configs")
      .select("id,provider,is_active,mode")
      .eq("reseller_id", rid);
    setMyGw((data ?? []) as { id: string; provider: string; is_active: boolean; mode: string }[]);
  }

  /**
   * Global automatic gateways are on by default. Turning one off writes an
   * inactive platform-mode row for this store; turning it back on removes that
   * row (unless the reseller runs the gateway on their own credentials).
   */
  async function toggleGlobalGateway(g: { provider: string; label: string }, show: boolean) {
    if (!resellerId) return;
    const row = myGw.find((r) => r.provider === g.provider);
    if (show) {
      if (!row) return;
      const { error } = await supabase.from("payment_gateway_configs").delete().eq("id", row.id);
      if (error) return toast.error(error.message);
      toast.success(`${g.label} is back on your store`);
    } else {
      const payload = { is_active: false, mode: "platform" };
      const { error } = row
        ? await supabase.from("payment_gateway_configs").update(payload).eq("id", row.id)
        : await supabase
            .from("payment_gateway_configs")
            .insert({ ...payload, reseller_id: resellerId, provider: g.provider, label: g.label });
      if (error) return toast.error(error.message);
      toast.success(`${g.label} removed from your store checkout`);
    }
    await loadMyGateways(resellerId);
    const me = await getMyReseller();
    if (me?.code) {
      try {
        setGateways(await loadGateways({ data: { code: me.code } }));
      } catch {
        /* keep current list */
      }
    }
  }


  async function loadMine(rid: string) {
    const { data, error } = await supabase
      .from("payment_configs")
      .select("id,method,label,mode,is_active,instructions,config")
      .eq("reseller_id", rid)
      .order("created_at");
    if (error) toast.error(error.message);
    setMine((data ?? []) as unknown as PaymentConfigRow[]);
  }

  useEffect(() => {
    (async () => {
      const me = await getMyReseller();
      setResellerId(me?.id ?? null);
      const [{ data: globals }] = await Promise.all([
        supabase
          .from("payment_configs")
          .select("id,method,label,mode,is_active,instructions,config")
          .is("reseller_id", null)
          .eq("is_active", true)
          .order("created_at"),
        me?.id ? loadMine(me.id) : Promise.resolve(),
      ]);
      const list = ((globals ?? []) as unknown as PaymentConfigRow[]).filter((r) => r.mode === "manual");
      setGlobalManual(list);
      if (me?.code) {
        try {
          setGateways(await loadGateways({ data: { code: me.code } }));
        } catch {
          setGateways([]);
        }
      }
      if (me?.id) {
        try {
          setPlatformGateways((await loadPlatformGateways()).map((g) => g.provider));
        } catch {
          setPlatformGateways([]);
        }
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(row: PaymentConfigRow, is_active: boolean) {
    setMine((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active } : r)));
    const { error } = await supabase.from("payment_configs").update({ is_active }).eq("id", row.id);
    if (error) {
      toast.error(error.message);
      if (resellerId) void loadMine(resellerId);
    }
  }

  /**
   * A reseller entry for a method always wins over the platform one, so hiding a
   * global method is simply an inactive marker row for that method. Showing it
   * again deletes the marker.
   */
  const hiddenRow = (method: string) =>
    mine.find((m) => m.method === method && cfgBool(m.config, "hidden_global")) ?? null;
  const ownRow = (method: string) =>
    mine.find((m) => m.method === method && !cfgBool(m.config, "hidden_global")) ?? null;
  const myMethods = mine.filter((m) => !cfgBool(m.config, "hidden_global"));

  async function toggleGlobal(row: PaymentConfigRow, show: boolean) {
    if (!resellerId) return;
    const marker = hiddenRow(row.method);
    if (show) {
      if (!marker) return;
      const { error } = await supabase.from("payment_configs").delete().eq("id", marker.id);
      if (error) return toast.error(error.message);
      toast.success(`${row.label} is back on your store`);
    } else {
      const { error } = await supabase.from("payment_configs").insert({
        reseller_id: resellerId,
        method: row.method as never,
        label: row.label,
        mode: "manual",
        is_active: false,
        config: { hidden_global: true } as never,
      });
      if (error) return toast.error(error.message);
      toast.success(`${row.label} removed from your store checkout`);
    }
    void loadMine(resellerId);
  }


  async function remove(row: PaymentConfigRow) {
    const ok = await confirmAction({
      title: "Delete payment method",
      description: `"${row.label}" will be removed from your store checkout.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    const { error } = await supabase.from("payment_configs").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    if (resellerId) void loadMine(resellerId);
  }

  if (loading)
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Payment methods"
        description="Global methods stay ready for your store automatically. Use your own wallet numbers or your own gateway credentials whenever you want the money to come to you instead."
      />

      <div className="mb-5 inline-flex rounded-xl border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={
            "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors " +
            (tab === "manual" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")
          }
        >
          <Wallet className="h-3.5 w-3.5" /> Manual
        </button>
        <button
          type="button"
          onClick={() => setTab("api")}
          className={
            "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors " +
            (tab === "api" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")
          }
        >
          <Zap className="h-3.5 w-3.5" /> Automatic gateways
          <span className="rounded-full bg-muted px-1.5 text-[10px]">{gateways.length}</span>
        </button>
      </div>

      <div className={tab === "api" ? "" : "hidden"}>
        {resellerId ? (
          <GatewayGrid resellerId={resellerId} platformActive={platformGateways} />
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
            Your reseller account is still being set up.
          </div>
        )}
      </div>

      <div className={tab === "manual" ? "" : "hidden"}>
      <section className="mb-7">

        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Globe2 className="h-4 w-4 text-primary" /> Global methods
          <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold">
            {globalManual.length + gateways.length}
          </span>
        </h2>
        {globalManual.length + gateways.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
            No global method is active right now — Cash on delivery still works on your store.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {globalManual.map((row) => {
              const own = ownRow(row.method);
              const overridden = Boolean(own?.is_active);
              const hidden = Boolean(hiddenRow(row.method));
              const shown = !hidden && !overridden;
              return (
                <div key={row.id} className="surface-card flex flex-col p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <Head method={row.method} label={row.label} tag="Manual · verified by admin" />
                    </div>
                    {!own && (
                      <Switch
                        checked={!hidden}
                        onChange={(v) => void toggleGlobal(row, v)}
                        label={`Show ${row.label} on my store`}
                      />
                    )}
                  </div>
                  <dl className="mt-3 space-y-1 text-[11px]">
                    <Row k="Account" v={cfgString(row.config, "account") || "—"} />
                    <Row k="Type" v={cfgString(row.config, "account_type") || "—"} />
                  </dl>
                  <span
                    className={
                      "mt-3 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                      (shown ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")
                    }
                  >
                    {overridden ? "Replaced by your own method" : hidden ? "Off on your store" : "Live on your store"}
                  </span>
                </div>
              );
            })}


            {gateways.map((g) => (
              <div key={g.provider} className="surface-card flex flex-col p-4">
                <Head method={g.provider} label={g.label} tag="Automatic gateway" icon={<Zap className="h-4 w-4" />} />
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Customers pay online and the gateway confirms it instantly — the order is marked paid without any
                  manual check.
                </p>
                <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                  Live on your store
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Wallet className="h-4 w-4 text-primary" /> My own methods
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold">{myMethods.length}</span>
          </h2>
          <button
            type="button"
            onClick={() => setDraft(emptyDraft())}
            className="btn-brand inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Add method
          </button>
        </div>

        {myMethods.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <Wallet className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-semibold">Using global methods only</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add your own bKash, Nagad, Rocket or bank number to collect that money yourself.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {myMethods.map((row) => (
              <div key={row.id} className="surface-card flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <Logo method={row.method} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{row.label}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <StatusDot on={row.is_active} />
                      {methodLabel(row.method)} · {row.is_active ? "active" : "off"}
                    </div>
                  </div>
                  <Switch checked={row.is_active} onChange={(v) => void toggle(row, v)} label={`Toggle ${row.label}`} />
                </div>

                <dl className="mt-3 space-y-1 text-[11px]">
                  <Row k="Account" v={cfgString(row.config, "account") || "—"} />
                  <Row k="Type" v={cfgString(row.config, "account_type") || "—"} />
                </dl>

                <div className="mt-auto flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...row, config: (row.config ?? {}) as Record<string, unknown> })}
                    className="flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(row)}
                    className="rounded-lg border p-2 text-destructive hover:bg-destructive/10"
                    aria-label={`Delete ${row.label}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>



      {draft && resellerId && (
        <MyMethodModal
          draft={draft}
          resellerId={resellerId}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            void loadMine(resellerId);
          }}
        />
      )}
    </div>
  );
}

function Logo({ method }: { method: string }) {
  return (
    <span className="grid h-11 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border bg-background">
      {paymentLogo(method) ? (
        <PaymentLogo method={method} width={96} height={44} fit="cover" alt={`${methodLabel(method)} logo`} />
      ) : (
        <Wallet className="h-5 w-5 text-muted-foreground" />
      )}
    </span>
  );
}

function Head({
  method,
  label,
  tag,
  icon,
}: {
  method: string;
  label: string;
  tag: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Logo method={method} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{label}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {icon} {tag}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="truncate font-medium">{v}</dd>
    </div>
  );
}

function MyMethodModal({
  draft,
  resellerId,
  onClose,
  onSaved,
}: {
  draft: Draft;
  resellerId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [row, setRow] = useState<Draft>(draft);
  const [busy, setBusy] = useState(false);
  const setConfig = (key: string, value: unknown) => setRow((r) => ({ ...r, config: { ...r.config, [key]: value } }));
  const meta = MANUAL_METHODS.find((m) => m.value === row.method);

  async function save() {
    if (!row.label.trim()) return toast.error("Display label is required");
    setBusy(true);
    const payload = {
      method: row.method as never,
      label: row.label.trim(),
      mode: "manual" as const,
      is_active: row.is_active,
      instructions: row.instructions?.trim() || null,
      config: row.config as never,
    };
    const { error } = row.id
      ? await supabase.from("payment_configs").update(payload).eq("id", row.id)
      : await supabase.from("payment_configs").insert({ ...payload, reseller_id: resellerId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(row.id ? "Saved" : "Payment method added");
    onSaved();
  }

  return (
    <AppModal
      title={row.id ? row.label || "Edit method" : "Add my payment method"}
      subtitle="Your own wallet or bank — replaces the global method of the same type on your store."
      size="md"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-xs font-semibold hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="btn-brand inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label required>Provider</Label>
          <select value={row.method} onChange={(e) => setRow((r) => ({ ...r, method: e.target.value }))} className={field}>
            {MANUAL_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          {meta && <p className="mt-1 text-[10px] text-muted-foreground">{meta.hint}</p>}
        </div>
        <div>
          <Label required>Display label</Label>
          <input
            value={row.label}
            onChange={(e) => setRow((r) => ({ ...r, label: e.target.value }))}
            className={field}
            placeholder={`${meta?.label ?? "bKash"} Personal`}
          />
        </div>
        <div>
          <Label>Account / number</Label>
          <input
            value={cfgString(row.config, "account")}
            onChange={(e) => setConfig("account", e.target.value)}
            className={field}
            placeholder="01700000000"
          />
        </div>
        <div>
          <Label>Account type</Label>
          <input
            value={cfgString(row.config, "account_type")}
            onChange={(e) => setConfig("account_type", e.target.value)}
            className={field}
            placeholder="Personal / Agent / Merchant"
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Payment instructions</Label>
          <textarea
            rows={4}
            value={row.instructions ?? ""}
            onChange={(e) => setRow((r) => ({ ...r, instructions: e.target.value }))}
            className={field}
            placeholder="Send Money to 01700XXXXXXX (Personal), then paste the TrxID."
          />
        </div>
        <label className="flex items-center justify-between gap-3 rounded-xl border p-3 sm:col-span-2">
          <span>
            <span className="block text-xs font-semibold">Show at checkout</span>
            <span className="text-[11px] text-muted-foreground">Turn off to hide without deleting.</span>
          </span>
          <Switch checked={row.is_active} onChange={(v) => setRow((r) => ({ ...r, is_active: v }))} label="Show at checkout" />
        </label>
      </div>
    </AppModal>
  );
}
