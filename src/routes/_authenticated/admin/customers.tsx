import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { CustomersReport } from "@/components/customers-report";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  component: AdminCustomersPage,
});

function AdminCustomersPage() {
  const [names, setNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("resellers").select("id, code, business_name").order("business_name");
      const m = new Map<string, string>();
      for (const r of (data ?? []) as { id: string; code: string; business_name: string }[]) {
        m.set(r.id, `${r.business_name} (${r.code})`);
      }
      setNames(m);
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Every customer across all stores — order history, value and contact. Export to Excel or CSV anytime."
      />
      <CustomersReport resellerNames={names} showStore allowExport />
    </div>
  );
}
