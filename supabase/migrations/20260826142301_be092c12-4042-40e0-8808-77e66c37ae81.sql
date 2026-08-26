-- Deleting a deposit entry must also clear the reseller-side submission that
-- created it, otherwise the reseller keeps seeing it as "approved".
CREATE OR REPLACE FUNCTION public.deposit_request_cleanup_on_deposit_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.deposit_requests WHERE deposit_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS reseller_deposits_cleanup_requests ON public.reseller_deposits;
CREATE TRIGGER reseller_deposits_cleanup_requests
BEFORE DELETE ON public.reseller_deposits
FOR EACH ROW EXECUTE FUNCTION public.deposit_request_cleanup_on_deposit_delete();

-- Reject now means "remove it" — no leftover row anywhere, no effect on balances.
CREATE OR REPLACE FUNCTION public.deposit_request_review(_id uuid, _approve boolean, _admin_note text DEFAULT NULL::text)
RETURNS deposit_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  req public.deposit_requests;
  new_deposit uuid;
BEGIN
  PERFORM public.assert_admin_permission(ARRAY['deposits.manage','resellers.manage','finance.view','payouts.manage']);

  SELECT * INTO req FROM public.deposit_requests WHERE id = _id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Deposit request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'This request is already %', req.status; END IF;

  IF NOT _approve THEN
    DELETE FROM public.deposit_requests WHERE id = _id;
    req.status := 'rejected';
    RETURN req;
  END IF;

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

  UPDATE public.deposit_requests
     SET status = 'approved',
         admin_note = COALESCE(_admin_note, admin_note),
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         deposit_id = new_deposit
   WHERE id = _id
   RETURNING * INTO req;

  RETURN req;
END;
$function$;