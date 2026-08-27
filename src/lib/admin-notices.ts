import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPanelBootstrapPayload } from "@/lib/panel-bootstrap";

export type NoticeLevel = "info" | "success" | "warning" | "critical";

export type AdminNotice = {
  id: string;
  title: string;
  body: string;
  level: NoticeLevel;
  is_active: boolean;
  is_dismissible: boolean;
  starts_at: string | null;
  ends_at: string | null;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  target_reseller_ids: string[];
  created_at: string;
  updated_at: string;
};

export const NOTICE_LEVELS: { value: NoticeLevel; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "success", label: "Good news" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Urgent" },
];

function isLive(n: AdminNotice, now = Date.now()) {
  if (!n.is_active) return false;
  if (n.starts_at && new Date(n.starts_at).getTime() > now) return false;
  if (n.ends_at && new Date(n.ends_at).getTime() < now) return false;
  return true;
}

/**
 * Live admin notices for the signed-in user, minus the ones they already dismissed.
 * Targeted notices only surface for the listed resellers.
 */
export function useLiveNotices(userId: string | undefined, resellerId: string | null) {
  const [notices, setNotices] = useState<AdminNotice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (force = true) => {
    if (!userId) return;
    // The panel bootstrap already filtered live, undismissed, targeted notices.
    const primed = force ? null : getPanelBootstrapPayload()?.notices;
    if (primed) {
      setNotices(primed as AdminNotice[]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [noticeRes, seenRes] = await Promise.all([
      supabase.from("admin_notices").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("admin_notice_dismissals").select("notice_id").eq("user_id", userId),
    ]);
    const seen = new Set((seenRes.data ?? []).map((d) => d.notice_id));
    const rows = ((noticeRes.data ?? []) as unknown as AdminNotice[]).filter((n) => {
      if (!isLive(n)) return false;
      if (seen.has(n.id)) return false;
      const targets = n.target_reseller_ids ?? [];
      if (targets.length && (!resellerId || !targets.includes(resellerId))) return false;
      return true;
    });
    setNotices(rows);
    setLoading(false);
  }, [userId, resellerId]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const dismiss = useCallback(
    async (id: string) => {
      setNotices((prev) => prev.filter((n) => n.id !== id));
      const boot = getPanelBootstrapPayload();
      if (boot) boot.notices = (boot.notices ?? []).filter((n: any) => n?.id !== id);
      if (!userId) return;
      await supabase.from("admin_notice_dismissals").upsert(
        { notice_id: id, user_id: userId },
        { onConflict: "notice_id,user_id" },
      );
    },
    [userId],
  );

  return { notices, loading, dismiss, reload: load };
}
