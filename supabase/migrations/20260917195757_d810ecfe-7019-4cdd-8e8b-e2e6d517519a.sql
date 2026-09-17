CREATE OR REPLACE FUNCTION public.agent_deposit_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _agent uuid;
  _out jsonb;
BEGIN
  SELECT a.id INTO _agent FROM public.agents a WHERE a.user_id = auth.uid() AND a.is_active LIMIT 1;
  IF _agent IS NULL THEN
    RETURN jsonb_build_object('agent_id', NULL, 'resellers', '[]'::jsonb, 'deposits', '[]'::jsonb);
  END IF;
  IF NOT public.has_any_permission(auth.uid(), ARRAY['deposits.collect_own','deposits.manage']) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT jsonb_build_object(
    'agent_id', _agent,
    'resellers', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'business_name')
      FROM (
        SELECT jsonb_build_object(
          'id', r.id,
          'business_name', r.business_name,
          'code', r.code,
          'phone', r.contact_phone,
          'status', r.status,
          'deposit_required', r.deposit_required,
          'deposit_required_amount', r.deposit_required_amount,
          'balance', COALESCE((SELECT SUM(d.amount) FROM public.reseller_deposits d WHERE d.reseller_id = r.id), 0)
        ) AS x
        FROM public.resellers r
        WHERE r.agent_id = _agent
      ) s
    ), '[]'::jsonb),
    'deposits', COALESCE((
      SELECT jsonb_agg(y ORDER BY y->>'created_at' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', d.id,
          'reseller_id', d.reseller_id,
          'business_name', r.business_name,
          'code', r.code,
          'amount', d.amount,
          'method', d.method,
          'reference', d.reference,
          'note', d.note,
          'created_by', d.created_by,
          'mine', (d.created_by = auth.uid()),
          'created_at', d.created_at
        ) AS y
        FROM public.reseller_deposits d
        JOIN public.resellers r ON r.id = d.reseller_id
        WHERE r.agent_id = _agent
        ORDER BY d.created_at DESC
      ) t
    ), '[]'::jsonb)
  ) INTO _out;

  RETURN _out;
END;
$fn$;