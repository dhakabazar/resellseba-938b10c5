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
import { Check, KeyRound, Loader2, Pencil, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";

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

const emptyDraft: Draft = { fullName: "", email: "", password: "", permissions: ["dashboard", "orders"], active: true };

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
    setBusy(true);
    try {
      if (draft.id) {
        await updateResellerStaff({
          id: draft.id,
          fullName: draft.fullName,
          permissions: draft.permissions,
          active: draft.active,
          password: draft.password || null,
        });
        toast.success("Staff updated");
      } else {
        await createResellerStaff({
          email: draft.email,
          password: draft.password,
          fullName: draft.fullName,
          permissions: draft.permissions,
        });
        toast.success("Staff account created");
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
            নিজের টিমের জন্য আলাদা লগইন তৈরি করুন — মেনু ধরে ধরে অনুমতি দিন।
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
          label="Menus available"
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
          এখনো কোনো স্টাফ নেই। “Add staff” চাপুন।
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <div key={r.id} className="surface-card flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold">{r.full_name || r.email}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      r.active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.active ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.permissions.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground">No menu access</span>
                  ) : (
                    r.permissions.map((p) => (
                      <span key={p} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                        {labelFor(p)}
                      </span>
                    ))
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
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRemoving(r)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AppModal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit staff" : "Add staff"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        }
      >
        {draft && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Full name</Label>
                <Input
                  value={draft.fullName}
                  onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                  placeholder="Staff name"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={draft.email}
                  disabled={!!draft.id}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder="staff@example.com"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" /> {draft.id ? "New password (optional)" : "Password"}
                </Label>
                <Input
                  value={draft.password}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                  placeholder="কমপক্ষে ৬ অক্ষর"
                />
              </div>
              {draft.id && (
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, active: !draft.active })}
                    className={`h-10 w-full rounded-lg border text-sm font-bold transition ${
                      draft.active ? "brand-tile-3 border-transparent" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {draft.active ? "Active" : "Disabled"}
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Menu permissions</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-[11px] font-bold text-primary hover:underline"
                    onClick={() => setDraft({ ...draft, permissions: [...ALL_RESELLER_PERMISSIONS] })}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-[11px] font-bold text-muted-foreground hover:underline"
                    onClick={() => setDraft({ ...draft, permissions: [] })}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-3">
                {RESELLER_MENU_PERMISSIONS.map((g) => (
                  <div key={g.group}>
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {g.group}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {g.items.map((i) => {
                        const on = draft.permissions.includes(i.key);
                        return (
                          <button
                            key={i.key}
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                permissions: on
                                  ? draft.permissions.filter((p) => p !== i.key)
                                  : [...draft.permissions, i.key],
                              })
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                              on ? "catalog-chip-active" : "bg-card hover:border-primary/40"
                            }`}
                          >
                            {i.label}
                          </button>
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

      <ConfirmModal
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        title="Delete staff account?"
        description={`${removing?.full_name || removing?.email} আর লগইন করতে পারবে না।`}
        confirmText="Delete"
        onConfirm={async () => {
          if (!removing) return;
          try {
            await deleteResellerStaff(removing.id);
            toast.success("Staff deleted");
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
    if (hit) return hit.label;
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
