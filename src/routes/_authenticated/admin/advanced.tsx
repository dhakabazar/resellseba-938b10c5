import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { Loader2, Save, Package, ShieldCheck, Mail, Smartphone, Info, Boxes } from "lucide-react";

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

type Group = {
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

const GROUPS: Group[] = [
  {
    title: "Reseller catalog",
    hint: "What resellers can see on the catalog grid.",
    icon: <Package className="h-4 w-4" />,
    rows: [
      {
        key: "resellerCatalogShowStock",
        label: "Show stock on product grid",
        help: "Off korle reseller catalog grid e stock number dekhabe na.",
      },
    ],
  },
  {
    title: "Order packaging charge",
    hint: "Ek parcel e ekadhik product hole packaging charge kivabe hisab hobe.",
    icon: <Boxes className="h-4 w-4" />,
    rows: [
      {
        key: "packagingChargeSum",
        label: "Add up every product's packaging charge",
        help:
          "ON = protita product er packaging charge × quantity jog hobe (ekhon jemon ache). OFF = ekadhik product hole sob gulor moddhe jetar packaging charge sob theke besi, sudhu setai ekbar dhora hobe. Single product hole dui khetrei ek e.",
      },
    ],
  },

  {
    title: "Reseller registration verification",
    hint: "Master switch off thakle verify na korei registration complete hoye jabe.",
    icon: <ShieldCheck className="h-4 w-4" />,
    rows: [
      {
        key: "verifyEnabled",
        label: "Verification required (master)",
        help: "Off = kono verification lagbe na, signup korei panel e dhukbe.",
        master: true,
      },
      {
        key: "verifyEmail",
        label: "Email code verification",
        help: "Email e 6 digit code pathabe (active email sender lagbe).",
        dependsOn: "verifyEnabled",
      },
      {
        key: "verifySms",
        label: "SMS code verification",
        help: "Phone number e 6 digit code pathabe (active SMS sender lagbe).",
        dependsOn: "verifyEnabled",
      },
    ],
  },
];

function AdvancedSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<AdvancedSettings>(DEFAULT_ADVANCED_SETTINGS);

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

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("global_settings")
      .update({ advanced_settings: settings as any } as any)
      .eq("id", 1);
    clearAppDataCache("settings");
    setBusy(false);
    if (error) return toast.error(error.message);
    clearAdvancedSettingsCache();
    toast.success("Advanced settings saved");
  }

  if (loading) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Advanced settings"
        description="Platform logic switches — notun logic ekhane jog hote thakbe."
        actions={
          <button
            onClick={save}
            disabled={busy}
            className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
          </button>
        }
      />

      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Ei switch gulo sathe sathe sob jaigai apply hoy — reseller panel, registration, login o dashboard.
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {GROUPS.map((group) => (
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
                      onChange={(v) => setSettings((s) => ({ ...s, [row.key]: v }))}
                    />
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
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
