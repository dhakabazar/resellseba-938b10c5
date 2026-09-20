-- Admin Resellers page: single bootstrap RPC (one round trip instead of 6)
CREATE OR REPLACE FUNCTION public.admin_resellers_bootstrap()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
BEGIN
  PERFORM public.assert_admin_permission(ARRAY[
    'staff.manage','resellers.manage','resellers.view','resellers.view_all',
    'resellers.edit','resellers.verify','resellers.password','resellers.impersonate'
  ]);

  WITH o AS (
    SELECT o.reseller_id,
           COUNT(*)::bigint AS orders,
           COALESCE(SUM(CASE WHEN o.status IN ('delivered','returned','cancelled') THEN o.reseller_profit ELSE 0 END), 0) AS delivered_profit
    FROM public.orders o GROUP BY o.reseller_id
  ), p AS (
    SELECT py.reseller_id,
           COALESCE(SUM(CASE WHEN py.status IN ('pending','approved') THEN py.amount ELSE 0 END), 0) AS pending_payout,
           COALESCE(SUM(CASE WHEN py.status = 'paid' THEN py.amount ELSE 0 END), 0) AS paid_out
    FROM public.payouts py GROUP BY py.reseller_id
  ), d AS (
    SELECT rd.reseller_id, COALESCE(SUM(rd.amount),0) AS deposit_balance
    FROM public.reseller_deposits rd GROUP BY rd.reseller_id
  ), rws AS (
    SELECT jsonb_build_object(
      'id', r.id, 'user_id', r.user_id, 'avatar_url', r.avatar_url,
      'business_name', r.business_name, 'code', r.code,
      'contact_phone', r.contact_phone, 'address', r.address, 'nid_number', r.nid_number,
      'status', r.status, 'commission_rate', r.commission_rate,
      'leader_id', r.leader_id, 'agent_id', r.agent_id,
      'notes', r.notes, 'notes_by', r.notes_by, 'notes_at', r.notes_at,
      'approved_at', r.approved_at, 'created_at', r.created_at,
      'payout_method', r.payout_method, 'payout_account_name', r.payout_account_name,
      'payout_account_number', r.payout_account_number, 'payout_bank_name', r.payout_bank_name,
      'payout_branch', r.payout_branch, 'payout_routing', r.payout_routing,
      'deposit_required', r.deposit_required, 'deposit_required_amount', r.deposit_required_amount,
      'frozen_amount', r.frozen_amount,
      'subscription_plan', r.subscription_plan,
      'subscription_expires_at', r.subscription_expires_at,
      'subscription_trial_ends_at', r.subscription_trial_ends_at,
      'subscription_exempt', r.subscription_exempt,
      'subscription_enrolled', r.subscription_enrolled,
      'subscription_enrolled_at', r.subscription_enrolled_at,
      'email', u.email::text,
      'email_confirmed', (u.email_confirmed_at IS NOT NULL),
      'email_verified', (pr.email_verified_at IS NOT NULL),
      'phone_verified', (pr.phone_verified_at IS NOT NULL),
      'notes_author', na.full_name,
      'orders', COALESCE(o.orders, 0),
      'delivered_profit', COALESCE(o.delivered_profit, 0),
      'pending_payout', COALESCE(p.pending_payout, 0),
      'paid_out', COALESCE(p.paid_out, 0),
      'available', GREATEST(COALESCE(o.delivered_profit,0)+COALESCE(d.deposit_balance,0)-COALESCE(p.pending_payout,0)-COALESCE(p.paid_out,0)-COALESCE(r.frozen_amount,0),0),
      'deposit_balance', COALESCE(d.deposit_balance, 0)
    ) AS j, r.created_at AS ca
    FROM public.resellers r
    LEFT JOIN auth.users u ON u.id = r.user_id
    LEFT JOIN public.profiles pr ON pr.id = r.user_id
    LEFT JOIN public.profiles na ON na.id = r.notes_by
    LEFT JOIN o ON o.reseller_id = r.id
    LEFT JOIN p ON p.reseller_id = r.id
    LEFT JOIN d ON d.reseller_id = r.id
  )
  SELECT jsonb_build_object(
    'resellers', COALESCE((SELECT jsonb_agg(j ORDER BY ca DESC) FROM rws), '[]'::jsonb),
    'agents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'display_name', a.display_name, 'user_id', a.user_id)
                       ORDER BY a.display_name)
      FROM public.agents a
    ), '[]'::jsonb)
  ) INTO v;

  RETURN v;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_resellers_bootstrap() TO authenticated;

CREATE INDEX IF NOT EXISTS idx_resellers_created_at ON public.resellers (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_verify ON public.profiles (id) INCLUDE (email_verified_at, phone_verified_at, full_name);
ANALYZE public.resellers;