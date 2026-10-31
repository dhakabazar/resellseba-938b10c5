-- Sidebar badges: three counts in one call (RLS applies to the caller).
CREATE OR REPLACE FUNCTION public.admin_nav_counts()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'payouts', (SELECT count(*) FROM public.payouts WHERE status = 'pending'),
    'forwarded', (SELECT count(*) FROM public.orders WHERE status = 'forwarded'),
    'rider', (SELECT count(*) FROM public.orders WHERE rider_assigned_at IS NOT NULL)
  );
$$;

-- Reseller profile / payouts page: everything in one call (RLS applies).
CREATE OR REPLACE FUNCTION public.reseller_account_overview(_reseller_id uuid, _with_history boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
DECLARE
  r public.resellers%ROWTYPE;
  v_leader text;
  v_sum jsonb;
BEGIN
  SELECT * INTO r FROM public.resellers WHERE id = _reseller_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF r.leader_id IS NOT NULL THEN
    SELECT business_name || ' (#' || code || ')' INTO v_leader FROM public.resellers WHERE id = r.leader_id;
  END IF;
  SELECT to_jsonb(s) INTO v_sum FROM public.reseller_profit_summary(_reseller_id) s LIMIT 1;
  RETURN jsonb_build_object(
    'reseller', jsonb_build_object(
      'id', r.id, 'code', r.code, 'avatar_url', r.avatar_url, 'business_name', r.business_name, 'status', r.status,
      'contact_phone', r.contact_phone, 'address', r.address, 'nid_number', r.nid_number,
      'commission_rate', r.commission_rate, 'leader_id', r.leader_id, 'notes', r.notes,
      'created_at', r.created_at, 'approved_at', r.approved_at,
      'payout_method', r.payout_method, 'payout_account_name', r.payout_account_name,
      'payout_account_number', r.payout_account_number, 'payout_bank_name', r.payout_bank_name,
      'payout_branch', r.payout_branch, 'payout_routing', r.payout_routing,
      'deposit_required', r.deposit_required, 'deposit_required_amount', r.deposit_required_amount,
      'frozen_amount', r.frozen_amount),
    'leader_name', v_leader,
    'summary', v_sum,
    'orders', (SELECT count(*) FROM public.orders WHERE reseller_id = _reseller_id),
    'payouts', CASE WHEN _with_history THEN (
      SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC, p.id), '[]'::jsonb)
      FROM public.payouts p WHERE p.reseller_id = _reseller_id) ELSE NULL END,
    'ledger', CASE WHEN _with_history THEN public.reseller_ledger_all(_reseller_id, 0) ELSE NULL END
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_nav_counts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reseller_account_overview(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_nav_counts() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reseller_account_overview(uuid, boolean) TO authenticated, service_role;