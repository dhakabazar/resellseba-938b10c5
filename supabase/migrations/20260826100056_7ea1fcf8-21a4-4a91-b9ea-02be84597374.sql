-- Payment method reference on existing deposit ledger rows
ALTER TABLE public.reseller_deposits
  ADD COLUMN IF NOT EXISTS payment_config_id uuid REFERENCES public.payment_configs(id) ON DELETE SET NULL;

CREATE TABLE public.deposit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_config_id uuid REFERENCES public.payment_configs(id) ON DELETE SET NULL,
  method text,
  reference text,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  deposit_id uuid REFERENCES public.reseller_deposits(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deposit_requests_reseller_idx ON public.deposit_requests (reseller_id, created_at DESC);
CREATE INDEX deposit_requests_status_idx ON public.deposit_requests (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposit_requests TO authenticated;
GRANT ALL ON public.deposit_requests TO service_role;

ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deposit_requests_select_own_or_admin" ON public.deposit_requests
  FOR SELECT TO authenticated
  USING (
    reseller_id = public.current_reseller_id()
    OR public.has_any_permission(auth.uid(), ARRAY['deposits.manage','resellers.manage','finance.view','reports.view','payouts.manage','dashboard.view'])
  );

CREATE POLICY "deposit_requests_reseller_insert" ON public.deposit_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    reseller_id = public.current_reseller_id()
    AND status = 'pending'
    AND amount > 0
  );

CREATE POLICY "deposit_requests_reseller_delete_pending" ON public.deposit_requests
  FOR DELETE TO authenticated
  USING (reseller_id = public.current_reseller_id() AND status = 'pending');

CREATE POLICY "deposit_requests_admin_update" ON public.deposit_requests
  FOR UPDATE TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY['deposits.manage','resellers.manage','finance.view','payouts.manage']))
  WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['deposits.manage','resellers.manage','finance.view','payouts.manage']));

CREATE POLICY "deposit_requests_admin_delete" ON public.deposit_requests
  FOR DELETE TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY['deposits.manage','resellers.manage','payouts.manage']));

CREATE TRIGGER deposit_requests_updated_at
  BEFORE UPDATE ON public.deposit_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Approving a request is the only way it turns into real deposit money.
CREATE OR REPLACE FUNCTION public.deposit_request_review(_id uuid, _approve boolean, _admin_note text DEFAULT NULL)
RETURNS public.deposit_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.deposit_requests;
  new_deposit uuid;
BEGIN
  PERFORM public.assert_admin_permission(ARRAY['deposits.manage','resellers.manage','finance.view','payouts.manage']);

  SELECT * INTO req FROM public.deposit_requests WHERE id = _id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Deposit request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'This request is already %', req.status; END IF;

  IF _approve THEN
    INSERT INTO public.reseller_deposits (reseller_id, amount, method, reference, note, payment_config_id, created_by)
    VALUES (
      req.reseller_id,
      req.amount,
      req.method,
      req.reference,
      COALESCE(NULLIF(req.note, ''), 'Reseller deposit payment'),
      req.payment_config_id,
      auth.uid()
    )
    RETURNING id INTO new_deposit;
  END IF;

  UPDATE public.deposit_requests
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         admin_note = COALESCE(_admin_note, admin_note),
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         deposit_id = new_deposit
   WHERE id = _id
   RETURNING * INTO req;

  RETURN req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deposit_request_review(uuid, boolean, text) TO authenticated;