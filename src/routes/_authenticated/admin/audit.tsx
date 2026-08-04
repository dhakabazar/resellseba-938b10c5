import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Loader2 } from "lucide-react";

type Row = {
  id: string;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditPage,
});

function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Audit log" description="Critical actions — last 200 events." />
      {loading ? (
        <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <EmptyState title="No audit events yet" description="Critical actions will be tracked here." />
      ) : (
        <div className="surface-card divide-y overflow-hidden">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-1 gap-2 px-4 py-3 text-sm md:grid-cols-[180px_1fr]">
              <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
              <div>
                <div>
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{r.action}</span>{" "}
                  <span className="text-muted-foreground">on</span> <span className="font-medium">{r.entity}</span>
                  {r.entity_id && <span className="ml-2 font-mono text-xs text-muted-foreground">{r.entity_id.slice(0, 8)}</span>}
                </div>
                {r.actor_role && <div className="text-xs text-muted-foreground">by {r.actor_role}</div>}
                {Object.keys(r.metadata ?? {}).length > 0 && (
                  <pre className="mt-1 max-w-full overflow-x-auto rounded bg-muted p-2 text-[11px]">{JSON.stringify(r.metadata, null, 2)}</pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
