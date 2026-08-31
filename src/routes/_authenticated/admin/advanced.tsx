import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearAppDataCache } from "@/lib/app-data";
import { PageHeader } from "@/components/ui-kit";
import { toast } from "sonner";
import {
  DEFAULT_ADVANCED_SETTINGS,
  mergeAdvanced,
  clearAdvancedSettingsCache,
  type AdvancedSettings,
} from "@/lib/advanced-settings";
import { Loader2, Save, Check, Package, ShieldCheck, Mail, Smartphone, Info, Boxes, Truck, UserCheck } from "lucide-react";
import {
  DELIVERY_AREAS,
  deliverySettingsSummary,
  setGlobalDelivery,
  type DeliveryArea,
  type DeliveryMode,
  type DeliverySettings,
} from "@/lib/delivery";
import { DeliveryRulesCard } from "@/components/delivery-rules-card";
import { DepositSettingsPanel } from "@/components/deposit-settings-panel";

export const Route = createFileRoute("/_authenticated/admin/advanced")({
  component: AdvancedSettingsPage,
  head: () => ({
    meta: [
      { title: "Advanced settings · Admin" },
      { name: "description", content: "Feature switches: reseller catalog stock visibility and signup verification rules." },
      { property: "og:title", content: "Advanced settings · Admin" },
      { property: "og:description", content: "Turn platform logic on or off without touching the code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type TabKey = "delivery" | "orders" | "resellers" | "deposit";

type Group = {
  tab: TabKey;
  title: string;
  hint: string;
  icon: React.ReactNode;
  rows: {
    key: keyof AdvancedSettings;
    label: string;
    help: string;
    master?: boolean;
    dependsOn?: keyof AdvancedSettings;
  }[];
};

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "delivery", label: "Delivery", icon: <Truck className="h-4 w-4" /> },
  { key: "orders", label: "Orders", icon: <Boxes className="h-4 w-4" /> },
  { key: "resellers", label: "Resellers", icon: <UserCheck className="h-4 w-4" /> },
  { key: "deposit", label: "Security deposit", icon: <ShieldCheck className="h-4 w-4" /> },
];

const GROUPS: Group[] = [
  {
    tab: "resellers",
    title: "New reseller approval",
    hint: "Choose between manual and automatic approval.",
    icon: <UserCheck className="h-4 w-4" />,
    rows: [
      {
        key: "resellerAutoApprove",
        label: "Automatic approval",
        help:
          "ON = a new registration becomes active immediately, no manual approval needed. OFF = an admin must approve the account before it gets access. In both cases an admin can deactivate or reject the account later.",
        master: true,
      },
      {
        key: "resellerAutoAssign",
        label: "Automatic agent assign",
        help:
          "ON = every new reseller is distributed evenly between staff agents (the agent with the fewest resellers gets the next one). Super admin accounts are never auto-assigned — they already see every reseller. If no eligible staff agent exists, the reseller stays unassigned. An admin can reassign manually at any time.",
      },
    ],
  },

  {
    tab: "resellers",
    title: "Reseller catalog",
    hint: "What resellers can see on the catalog grid.",
    icon: <Package className="h-4 w-4" />,
    rows: [
      {
        key: "resellerCatalogShowStock",
        label: "Show stock on product grid",
        help: "When off, stock numbers are hidden on the reseller catalog grid.",
      },
    ],
  },
  {
    tab: "orders",
    title: "Order packaging charge",
    hint: "How packaging charge is calculated when a parcel contains multiple products.",
    icon: <Boxes className="h-4 w-4" />,
    rows: [
      {
        key: "packagingChargeSum",
        label: "Add up every product's packaging charge",
        help:
          "ON = each product's packaging charge is multiplied by its quantity and added up. OFF = when there are multiple products, only the highest single packaging charge is applied once. For a single product, both modes give the same result.",
      },
    ],
  },

  {
    tab: "resellers",
    title: "Reseller registration verification",
    hint: "With the master switch off, registration completes without any verification.",
    icon: <ShieldCheck className="h-4 w-4" />,
    rows: [
      {
        key: "verifyEnabled",
        label: "Verification required (master)",
        help: "Off = no verification required; the panel opens right after signup.",
        master: true,
      },
      {
        key: "verifyEmail",
        label: "Email code verification",
        help: "Sends a 6-digit code by email (requires an active email sender).",
        dependsOn: "verifyEnabled",
      },
      {
        key: "verifySms",
        label: "SMS code verification",
        help: "Sends a 6-digit code by SMS (requires an active SMS sender).",
        dependsOn: "verifyEnabled",
      },
    ],
  },
];

function AdvancedSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [tab, setTab] = useState<TabKey>("delivery");
  const [settings, setSettings] = useState<AdvancedSettings>(DEFAULT_ADVANCED_SETTINGS);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("global_settings")
        .select("advanced_settings")
        .eq("id", 1)
        .maybeSingle();
      if (error) toast.error(error.message);
      setSettings(mergeAdvanced((data as any)?.advanced_settings));
      setLoading(false);
    })();
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function persist(next: AdvancedSettings) {
    setStatus("saving");
    const { error } = await supabase
      .from("global_settings")
      .update({ advanced_settings: next as any } as any)
      .eq("id", 1);
    clearAppDataCache("settings");
    if (error) {
      setStatus("idle");
      return toast.error(error.message);
    }
    clearAdvancedSettingsCache();
    setGlobalDelivery(next.delivery);
    setStatus("saved");
  }

  /** Every switch / field saves itself — no Save button needed. */
  function apply(patch: Partial<AdvancedSettings>, delay = 250) {
    setSettings((s) => {
      const next = { ...s, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void persist(next), delay);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const groups = GROUPS.filter((g) => g.tab === tab);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Advanced settings"
        description="Platform logic switches — every change saves automatically."
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
            {status === "saving" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : status === "saved" ? (
              <>
                <Check className="h-3.5 w-3.5 text-success" /> Saved automatically
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" /> Auto-save on
              </>
            )}
          </span>
        }
      />

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Every switch and field on this page saves by itself and applies everywhere instantly — reseller
          panel, registration, login and dashboard.
        </span>
      </div>

      {tab === "deposit" && <DepositSettingsPanel />}

      {tab === "delivery" && (
        <div className="space-y-5">
          <DeliveryCard
            value={settings.delivery}
            onChange={(delivery) => apply({ delivery }, 700)}
          />
          <DeliveryRulesCard
            value={settings.delivery}
            onChange={(delivery) => apply({ delivery }, 700)}
          />
        </div>
      )}


      {groups.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          {groups.map((group) => (
            <section key={group.title} className="surface-card overflow-hidden">
              <header className="flex items-center gap-2 border-b bg-muted/30 px-4 py-3">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">{group.icon}</span>
                <div>
                  <h2 className="text-sm font-semibold">{group.title}</h2>
                  <p className="text-xs text-muted-foreground">{group.hint}</p>
                </div>
              </header>
              <div className="divide-y">
                {group.rows.map((row) => {
                  const disabled = row.dependsOn ? !settings[row.dependsOn] : false;
                  return (
                    <label
                      key={row.key}
                      className={`flex items-start justify-between gap-4 px-4 py-3.5 transition ${
                        disabled ? "opacity-50" : "hover:bg-muted/30"
                      } ${row.master ? "bg-primary/5" : ""}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {row.key === "verifyEmail" && <Mail className="h-3.5 w-3.5 text-muted-foreground" />}
                          {row.key === "verifySms" && <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />}
                          {row.label}
                          {row.master && (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                              master
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{row.help}</p>
                      </div>
                      <Toggle
                        checked={Boolean(settings[row.key])}
                        disabled={disabled}
                        onChange={(v) => apply({ [row.key]: v } as Partial<AdvancedSettings>, 0)}
                      />
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}


const DELIVERY_MODES: { value: DeliveryMode; label: string; help: string }[] = [
  { value: "area", label: "Area-wise", help: "Three areas, each with its own charge." },
  { value: "flat", label: "Flat rate", help: "The same charge for every area." },
  { value: "free", label: "Free shipping", help: "The customer pays no delivery charge." },
  { value: "custom", label: "Custom", help: "One default amount that can be changed manually per order." },
];

/** Global delivery charge rule. A product can still override it from product edit. */
function DeliveryCard({
  value,
  onChange,
}: {
  value: DeliverySettings;
  onChange: (v: DeliverySettings) => void;
}) {
  const inp =
    "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

  function setArea(area: DeliveryArea, patch: Partial<{ label: string; charge: number }>) {
    onChange({ ...value, areas: { ...value.areas, [area]: { ...value.areas[area], ...patch } } });
  }

  return (
    <section className="surface-card overflow-hidden">
      <header className="flex items-center gap-2 border-b bg-muted/30 px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
          <Truck className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Delivery charge (global)</h2>
          <p className="text-xs text-muted-foreground">
            This rule applies to every product. If a delivery charge is set on a product,
            that product's own setting takes priority (priority 1).
          </p>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <div className="grid gap-2 sm:grid-cols-4">
          {DELIVERY_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onChange({ ...value, mode: m.value })}
              aria-pressed={value.mode === m.value}
              className={`rounded-lg border p-3 text-left transition ${
                value.mode === m.value ? "border-primary bg-primary/5" : "hover:bg-muted/40"
              }`}
            >
              <div className="text-sm font-medium">{m.label}</div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{m.help}</p>
            </button>
          ))}
        </div>

        {value.mode === "area" && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Areas (names are editable)
            </div>
            {DELIVERY_AREAS.map((area) => (
              <div key={area} className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                <input
                  value={value.areas[area].label}
                  onChange={(e) => setArea(area, { label: e.target.value })}
                  className={inp}
                  placeholder="Area name"
                />
                <input
                  type="number"
                  min={0}
                  value={value.areas[area].charge}
                  onChange={(e) => setArea(area, { charge: Number(e.target.value) || 0 })}
                  className={inp}
                  placeholder="Charge"
                />
              </div>
            ))}
          </div>
        )}

        {value.mode === "flat" && (
          <label className="block max-w-xs text-xs font-medium">
            Flat charge (all areas)
            <input
              type="number"
              min={0}
              value={value.flat}
              onChange={(e) => onChange({ ...value, flat: Number(e.target.value) || 0 })}
              className={inp + " mt-1"}
            />
          </label>
        )}

        {value.mode === "custom" && (
          <label className="block max-w-xs text-xs font-medium">
            Default custom charge
            <input
              type="number"
              min={0}
              value={value.custom}
              onChange={(e) => onChange({ ...value, custom: Number(e.target.value) || 0 })}
              className={inp + " mt-1"}
            />
            <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
              This charge can be changed manually while adding or editing an order.
            </span>
          </label>
        )}

        <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {deliverySettingsSummary(value)}
        </p>
      </div>
    </section>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition disabled:cursor-not-allowed ${
        checked ? "border-primary bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-background shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
        style={{ height: 18, width: 18 }}
      />
    </button>
  );
}
