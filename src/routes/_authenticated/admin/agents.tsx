import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { useServerFn } from "@tanstack/react-start";
import { listAgentCandidates, type AgentCandidate } from "@/lib/agents.functions";
import { bdt, type Agent } from "@/lib/agents";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  Users,
  Target,
  Phone,
  Mail,
  UserCheck,
  Search,
  Power,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/agents")({
  component: AgentsPage,
});

type ResellerLite = {
  id: string;
  business_name: string;
  code: string;
  status: string;
  contact_phone: string | null;
  agent_id: string | null;
};

const cls = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function AgentsPage() {
  const candidatesFn = useServerFn(listAgentCandidates);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [resellers, setResellers] = useState<ResellerLite[]>([]);
  const [candidates, setCandidates] = useState<AgentCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Agent | "new" | null>(null);
  const [assignFor, setAssignFor] = useState<Agent | null>(null);
  const [removing, setRemoving] = useState<Agent | null>(null);

  async function load() {
    setLoading(true);
    const [agentsRes, resellerRes] = await Promise.all([
      supabase.from("agents").select("*").order("display_name"),
      supabase
        .from("resellers")
        .select("id,business_name,code,status,contact_phone,agent_id")
        .order("business_name"),
    ]);
    if (agentsRes.error) toast.error(agentsRes.error.message);
    setAgents((agentsRes.data ?? []) as Agent[]);
    setResellers((resellerRes.data ?? []) as ResellerLite[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    candidatesFn()
      .then((rows) => setCandidates(rows))
      .catch(() => setCandidates([]));
  }, []);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of resellers) if (r.agent_id) map[r.agent_id] = (map[r.agent_id] ?? 0) + 1;
    return map;
  }, [resellers]);

  async function toggleActive(a: Agent) {
    const { error } = await supabase.from("agents").update({ is_active: !a.is_active }).eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success(a.is_active ? "Agent deactivated" : "Agent activated");
    load();
  }

  async function remove(a: Agent) {
    const { error } = await supabase.from("agents").delete().eq("id", a.id);
    setRemoving(null);
    if (error) return toast.error(error.message);
    toast.success("Agent removed");
    load();
  }

  return (
    <div>
      <PageHeader
        title="Commission Agents"
        description="Assign resellers to agents, set their sales target and let them follow up on business growth."
        actions={
          <button
            onClick={() => setEditing("new")}
            className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> Add agent
          </button>
        }
      />

      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          title="No agents yet"
          description="Create an agent from a staff account, then assign the resellers they will follow up with."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => (
            <div key={a.id} className="surface-card p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold uppercase text-primary">
                    {a.display_name.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-bold">{a.display_name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {a.email && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" /> {a.email}
                        </span>
                      )}
                      {a.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {a.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span
                  className={
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase " +
                    (a.is_active
                      ? "bg-emerald-500/15 text-emerald-600"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {a.is_active ? "Active" : "Off"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg border bg-muted/40 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Sale target</div>
                  <div className="text-sm font-black text-primary">{bdt(Number(a.sale_target))}</div>
                </div>
                <div
                  className="rounded-lg border bg-muted/40 p-2.5"
                  title="Commission = this % × settled net profit of the assigned resellers' delivered orders."
                >
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Commission</div>
                  <div className="text-sm font-black">{Number(a.commission_rate ?? 0)}%</div>
                </div>
                <div className="rounded-lg border bg-muted/40 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Resellers</div>
                  <div className="text-sm font-black">{counts[a.id] ?? 0}</div>
                </div>
              </div>


              {a.notes && <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{a.notes}</p>}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setAssignFor(a)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold hover:bg-muted"
                >
                  <Users className="h-3.5 w-3.5" /> Assign resellers
                </button>
                <button
                  onClick={() => setEditing(a)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold hover:bg-muted"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => toggleActive(a)}
                  title={a.is_active ? "Deactivate" : "Activate"}
                  className="inline-flex items-center justify-center rounded-md border px-2.5 py-2 hover:bg-muted"
                >
                  <Power className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setRemoving(a)}
                  title="Remove agent"
                  className="inline-flex items-center justify-center rounded-md border border-destructive/40 px-2.5 py-2 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <AgentModal
          agent={editing === "new" ? null : editing}
          candidates={candidates}
          taken={agents.map((a) => a.user_id)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {assignFor && (
        <AssignModal
          agent={assignFor}
          resellers={resellers}
          onClose={() => setAssignFor(null)}
          onSaved={() => {
            setAssignFor(null);
            load();
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!removing}
        title="Remove this agent?"
        description={`${removing?.display_name ?? ""} will be unassigned from every reseller. The staff account itself is not deleted.`}
        confirmText="Remove agent"
        variant="danger"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await remove(removing);
        }}
      />
    </div>
  );
}

function AgentModal({
  agent,
  candidates,
  taken,
  onClose,
  onSaved,
}: {
  agent: Agent | null;
  candidates: AgentCandidate[];
  taken: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [userId, setUserId] = useState(agent?.user_id ?? "");
  const [name, setName] = useState(agent?.display_name ?? "");
  const [phone, setPhone] = useState(agent?.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(agent?.whatsapp ?? "");
  const [email, setEmail] = useState(agent?.email ?? "");
  const [target, setTarget] = useState(String(agent?.sale_target ?? 0));
  const [rate, setRate] = useState(String(agent?.commission_rate ?? 0));

  const [active, setActive] = useState(agent?.is_active ?? true);
  const [notes, setNotes] = useState(agent?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const available = candidates.filter((c) => c.user_id === agent?.user_id || !taken.includes(c.user_id));

  function pickUser(id: string) {
    setUserId(id);
    const c = candidates.find((x) => x.user_id === id);
    if (c) {
      if (!name) setName(c.full_name || c.email || "Agent");
      if (!email) setEmail(c.email ?? "");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return toast.error("Select the staff account for this agent");
    setBusy(true);
    const payload = {
      user_id: userId,
      display_name: name.trim(),
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      email: email.trim() || null,
      sale_target: Number(target) || 0,
      commission_rate: Number(rate) || 0,

      is_active: active,
      notes: notes.trim() || null,
    };
    const { error } = agent
      ? await supabase.from("agents").update(payload).eq("id", agent.id)
      : await supabase.from("agents").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(agent ? "Agent updated" : "Agent created");
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        className="surface-card flex max-h-[92dvh] w-full max-w-lg flex-col rounded-b-none sm:max-h-[88dvh] sm:rounded-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
          <h3 className="truncate text-base font-semibold">{agent ? "Edit agent" : "New agent"}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
          <div>
            <label className="mb-1 block text-xs font-medium">Staff account</label>
            <select value={userId} onChange={(e) => pickUser(e.target.value)} className={cls} disabled={!!agent}>
              <option value="">— Select staff / admin user —</option>
              {available.map((c) => (
                <option key={c.user_id} value={c.user_id}>
                  {(c.full_name || "Unnamed") + (c.email ? ` · ${c.email}` : "")}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              The agent logs in with this account. Give the account a role that includes the agent report permission.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Display name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Sale target (৳)</label>
              <input type="number" min={0} value={target} onChange={(e) => setTarget(e.target.value)} className={cls} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">Commission rate (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className={cls}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Commission = this % × settled net profit of the assigned resellers' orders (final delivered amount −
                delivery charge − product cost − packaging cost). Returned / cancelled orders reduce the base.
              </p>
            </div>
            <div>

              <label className="mb-1 block text-xs font-medium">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">WhatsApp</label>
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={cls} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">Contact email (shown to resellers)</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={cls} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Internal notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={cls} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active agent (resellers can see the contact info)
          </label>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            disabled={busy}
            className="btn-brand inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </form>
    </div>
  );
}

function AssignModal({
  agent,
  resellers,
  onClose,
  onSaved,
}: {
  agent: Agent;
  resellers: ResellerLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>(
    resellers.filter((r) => r.agent_id === agent.id).map((r) => r.id),
  );
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const rows = t
      ? resellers.filter(
          (r) =>
            r.business_name.toLowerCase().includes(t) ||
            r.code.toLowerCase().includes(t) ||
            (r.contact_phone ?? "").includes(t),
        )
      : resellers;
    return [...rows].sort((a, b) => Number(selected.includes(b.id)) - Number(selected.includes(a.id)));
  }, [resellers, q]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function save() {
    setBusy(true);
    const before = resellers.filter((r) => r.agent_id === agent.id).map((r) => r.id);
    const toAdd = selected.filter((id) => !before.includes(id));
    const toRemove = before.filter((id) => !selected.includes(id));
    try {
      if (toAdd.length) {
        const { error } = await supabase.from("resellers").update({ agent_id: agent.id }).in("id", toAdd);
        if (error) throw error;
      }
      if (toRemove.length) {
        const { error } = await supabase.from("resellers").update({ agent_id: null }).in("id", toRemove);
        if (error) throw error;
      }
      toast.success(`${selected.length} reseller(s) assigned to ${agent.display_name}`);
      onSaved();
    } catch (err: any) {
      toast.error(err?.message || "Could not save assignments");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface-card flex max-h-[92dvh] w-full max-w-lg flex-col rounded-b-none sm:max-h-[88dvh] sm:rounded-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">Assign resellers</h3>
            <p className="truncate text-xs text-muted-foreground">
              {agent.display_name} · {selected.length} selected
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b px-4 py-3 sm:px-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search reseller name, ID or phone…"
              className={cls + " pl-9"}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 sm:px-6">
          {list.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No reseller found.</p>}
          {list.map((r) => {
            const other = r.agent_id && r.agent_id !== agent.id;
            const on = selected.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggle(r.id)}
                className={
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition " +
                  (on ? "border-primary bg-primary/5" : "hover:bg-muted")
                }
              >
                <span
                  className={
                    "grid h-5 w-5 shrink-0 place-items-center rounded border " +
                    (on ? "border-primary bg-primary text-primary-foreground" : "")
                  }
                >
                  {on && <UserCheck className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.business_name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    #{r.code} · {r.status}
                    {other ? " · assigned to another agent" : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="btn-brand inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />} Save assignments
          </button>
        </div>
      </div>
    </div>
  );
}
