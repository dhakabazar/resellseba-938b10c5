import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ALL_RESELLER_PERMISSIONS,
  RESELLER_MENU_PERMISSIONS,
  createResellerStaff,
  deleteResellerStaff,
  listResellerStaff,
  updateResellerStaff,
  useResellerAccess,
  type ResellerStaffRow,
} from "@/lib/reseller-staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppModal } from "@/components/ui-kit/AppModal";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import {
  Check,
  CheckSquare,
  KeyRound,
  Loader2,
  Package,
  Pencil,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/reseller/staff")({
  component: ResellerStaffPage,
});

type Draft = {
  id?: string;
  fullName: string;
  email: string;
  password: string;
  permissions: string[];
  active: boolean;
};

const emptyDraft: Draft = {
  fullName: "",
  email: "",
  password: "",
  permissions: ["dashboard", "orders", "orders_create", "orders_edit", "rider_followup", "customers"],
  active: true,
};

const PRESETS = [
  {
    label: "অর্ডার অপারেটর",
    desc: "অর্ডার দেখা, তৈরি ও আপডেট",
    icon: <ShoppingBag className="h-3.5 w-3.5" />,
    keys: ["dashboard", "orders", "orders_create", "orders_edit", "rider_followup", "customers"],
  },
  {
    label: "প্রোডাক্ট ম্যানেজার",
    desc: "ক্যাটালগ ও লিস্টিং ম্যানেজমেন্ট",
    icon: <Package className="h-3.5 w-3.5" />,
    keys: ["dashboard", "catalog", "listings"],
  },
  {
    label: "স্টোর ডিজাইনার",
    desc: "থিম, সেটিংস ও মেনু",
    icon: <Wrench className="h-3.5 w-3.5" />,
    keys: ["dashboard", "settings", "theme", "menus", "visitors"],
  },
  {
    label: "সব অনুমতি (Full)",
    desc: "সকল মেনু ও অ্যাকশন",
    icon: <CheckSquare className="h-3.5 w-3.5" />,
    keys: ALL_RESELLER_PERMISSIONS,
  },
];

function ResellerStaffPage() {
  const { isOwner } = useResellerAccess();
  const [rows, setRows] = useState<ResellerStaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<ResellerStaffRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await listResellerStaff());
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (isOwner) void load();
    else setLoading(false);
  }, [isOwner]);

  const activeCount = useMemo(() => rows.filter((r) => r.active).length, [rows]);

  if (!isOwner)
    return (
      <div className="surface-card p-10 text-center">
        <h1 className="text-lg font-bold">Staff management</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          শুধু স্টোর মালিক নিজের স্টাফ যোগ বা পরিবর্তন করতে পারবেন।
        </p>
      </div>
    );

  async function save() {
    if (!draft) return;
    if (!draft.id && !draft.email.trim()) {
      return toast.error("ইমেইল প্রদান করুন");
    }
    if (!draft.id && (!draft.password || draft.password.length < 6)) {
      return toast.error("কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন");
    }
    if (draft.permissions.length === 0) {
      return toast.error("কমপক্ষে একটি মেনুর অনুমতি সিলেক্ট করুন");
    }

    setBusy(true);
    try {
      if (draft.id) {
        await updateResellerStaff({
          id: draft.id,
          fullName: draft.fullName.trim() || null,
          permissions: draft.permissions,
          active: draft.active,
          password: draft.password ? draft.password.trim() : null,
        });
        toast.success("স্টাফ একাউন্ট আপডেট হয়েছে");
      } else {
        await createResellerStaff({
          email: draft.email.trim(),
          password: draft.password.trim(),
          fullName: draft.fullName.trim(),
          permissions: draft.permissions,
        });
        toast.success("নতুন স্টাফ একাউন্ট তৈরি হয়েছে");
      }
      setDraft(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">My staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            নিজের টিমের সদস্যদের জন্য আলাদা একাউন্ট তৈরি করুন এবং মেনু ও কাজের অনুমতি নির্ধারণ করুন।
          </p>
        </div>
        <Button className="gap-2" onClick={() => setDraft({ ...emptyDraft })}>
          <UserPlus className="h-4 w-4" /> Add staff
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric icon={<Users className="h-4 w-4" />} label="Total staff" value={rows.length} tile="brand-tile-1" />
        <Metric icon={<Check className="h-4 w-4" />} label="Active" value={activeCount} tile="brand-tile-3" />
        <Metric
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Permissions available"
          value={ALL_RESELLER_PERMISSIONS.length}
          tile="brand-tile-4"
        />
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="surface-card p-12 text-center text-sm text-muted-foreground">
          এখনো কোনো স্টাফ তৈরি করা হয়নি। “Add staff” বাটনে চাপুন।
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <div key={r.id} className="surface-card flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-base font-bold">{r.full_name || r.email}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      r.active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.active ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className="truncate text-xs text-muted-foreground mt-0.5">{r.email}</div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.permissions.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground">কোনো পারমিশন দেওয়া নেই</span>
                  ) : (
                    r.permissions.map((p) => {
                      const label = labelFor(p);
                      return (
                        <span
                          key={p}
                          className="rounded-md border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground/80 shadow-xs"
                        >
                          {label}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    setDraft({
                      id: r.id,
                      fullName: r.full_name ?? "",
                      email: r.email ?? "",
                      password: "",
                      permissions: [...r.permissions],
                      active: r.active,
                    })
                  }
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10" onClick={() => setRemoving(r)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      <AppModal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit staff permissions" : "Add new staff member"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {draft?.id ? "Update Staff" : "Create Account"}
            </Button>
          </div>
        }
      >
        {draft && (
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
            {/* Account Credentials */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Full name (নাম)</Label>
                <Input
                  value={draft.fullName}
                  onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                  placeholder="যেমন: মোঃ সাব্বির আহমেদ"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Email (লগইন ইমেইল)</Label>
                <Input
                  value={draft.email}
                  disabled={!!draft.id}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder="staff@gmail.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" /> {draft.id ? "New password (ঐচ্ছিক)" : "Password (পাসওয়ার্ড)"}
                </Label>
                <Input
                  value={draft.password}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                  placeholder={draft.id ? "পরিবর্তন না করতে চাইলে খালি রাখুন" : "কমপক্ষে ৬ অক্ষর"}
                  className="mt-1"
                />
              </div>
              {draft.id && (
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, active: !draft.active })}
                    className={`h-10 w-full rounded-lg border text-xs font-bold transition ${
                      draft.active ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    স্ট্যাটাস: {draft.active ? "Active (সক্রিয়)" : "Disabled (বন্ধ)"}
                  </button>
                </div>
              )}
            </div>

            {/* Quick Presets */}
            <div className="rounded-xl border bg-muted/40 p-3.5">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                কুইক পারমিশন প্রিসেট (Quick Presets)
              </div>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                {PRESETS.map((pr) => (
                  <button
                    key={pr.label}
                    type="button"
                    onClick={() => setDraft({ ...draft, permissions: [...pr.keys] })}
                    className="flex flex-col items-start rounded-lg border bg-background p-2 text-left text-xs transition-all hover:border-primary hover:shadow-xs active:scale-98"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      {pr.icon} {pr.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{pr.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Granular Permission Toggles */}
            <div>
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <Label className="text-sm font-bold">মেনু ও কাজের অনুমতি (Permissions)</Label>
                  <p className="text-xs text-muted-foreground">নির্দিষ্ট মেনু বা অপারেশনে টিক দিন</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs font-bold text-primary hover:underline"
                    onClick={() => setDraft({ ...draft, permissions: [...ALL_RESELLER_PERMISSIONS] })}
                  >
                    Select all
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    className="text-xs font-bold text-muted-foreground hover:underline"
                    onClick={() => setDraft({ ...draft, permissions: [] })}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-4">
                {RESELLER_MENU_PERMISSIONS.map((g) => (
                  <div key={g.group} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-primary">
                        {g.group} <span className="text-muted-foreground font-normal">({g.groupBn})</span>
                      </div>
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground hover:text-foreground font-semibold"
                        onClick={() => {
                          const groupKeys = g.items.map((i) => i.key);
                          const allSelected = groupKeys.every((k) => draft.permissions.includes(k));
                          if (allSelected) {
                            setDraft({
                              ...draft,
                              permissions: draft.permissions.filter((p) => !groupKeys.includes(p)),
                            });
                          } else {
                            const combined = Array.from(new Set([...draft.permissions, ...groupKeys]));
                            setDraft({ ...draft, permissions: combined });
                          }
                        }}
                      >
                        Toggle group
                      </button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {g.items.map((i) => {
                        const on = draft.permissions.includes(i.key);
                        return (
                          <div
                            key={i.key}
                            onClick={() =>
                              setDraft({
                                ...draft,
                                permissions: on
                                  ? draft.permissions.filter((p) => p !== i.key)
                                  : [...draft.permissions, i.key],
                              })
                            }
                            className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer select-none transition-all ${
                              on
                                ? "border-primary bg-primary/5 shadow-xs"
                                : "border-border/60 hover:border-primary/40 bg-background/50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => {}}
                              className="mt-0.5 h-4 w-4 rounded text-primary focus:ring-primary"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                                <span>{i.label}</span>
                                <span className="text-[10px] text-muted-foreground font-normal">({i.labelBn})</span>
                              </div>
                              <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                                {i.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </AppModal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        title="Delete staff account?"
        description={`${removing?.full_name || removing?.email} এর একাউন্ট মুছে ফেলা হবে এবং তিনি আর লগইন করতে পারবেন না।`}
        confirmText="Delete"
        onConfirm={async () => {
          if (!removing) return;
          try {
            await deleteResellerStaff(removing.id);
            toast.success("স্টাফ একাউন্ট মুছে ফেলা হয়েছে");
            setRemoving(null);
            await load();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </div>
  );
}

function labelFor(key: string) {
  for (const g of RESELLER_MENU_PERMISSIONS) {
    const hit = g.items.find((i) => i.key === key);
    if (hit) return `${hit.label} (${hit.labelBn})`;
  }
  return key;
}

function Metric({ icon, label, value, tile }: { icon: React.ReactNode; label: string; value: number; tile: string }) {
  return (
    <div className="surface-card flex items-center gap-3 p-4">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tile}`}>{icon}</span>
      <div>
        <div className="text-lg font-black leading-none">{value}</div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
