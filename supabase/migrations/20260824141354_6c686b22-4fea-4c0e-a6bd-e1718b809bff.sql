
-- 1. Reseller delete own early-stage orders
CREATE POLICY "Resellers delete own early orders"
ON public.orders FOR DELETE TO authenticated
USING (
  reseller_id = public.current_reseller_id()
  AND status IN ('draft','pending','forwarded','cancelled')
  AND NOT EXISTS (SELECT 1 FROM public.shipments s WHERE s.order_id = orders.id)
);

CREATE POLICY "Resellers delete own early order items"
ON public.order_items FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.reseller_id = public.current_reseller_id()
      AND o.status IN ('draft','pending','forwarded','cancelled')
  )
);

CREATE POLICY "Resellers delete own early order history"
ON public.order_status_history FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND o.reseller_id = public.current_reseller_id()
      AND o.status IN ('draft','pending','forwarded','cancelled')
  )
);

-- 2. Order notes timeline
CREATE TABLE public.order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  author_role text NOT NULL DEFAULT 'staff',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_notes_order_idx ON public.order_notes(order_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_notes TO authenticated;
GRANT ALL ON public.order_notes TO service_role;

ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;

-- 20 word limit enforced server side too
CREATE OR REPLACE FUNCTION public.order_notes_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.body := btrim(NEW.body);
  IF NEW.body = '' THEN
    RAISE EXCEPTION 'Note cannot be empty';
  END IF;
  IF array_length(regexp_split_to_array(NEW.body, '\s+'), 1) > 20 THEN
    RAISE EXCEPTION 'Note cannot be longer than 20 words';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_notes_validate_trg
BEFORE INSERT OR UPDATE ON public.order_notes
FOR EACH ROW EXECUTE FUNCTION public.order_notes_validate();

-- helper: can the current reseller write notes on this order?
CREATE OR REPLACE FUNCTION public.reseller_can_note(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = _order_id
      AND o.reseller_id = public.current_reseller_id()
      AND o.status IN ('draft','pending','forwarded','cancelled')
  )
$$;

CREATE OR REPLACE FUNCTION public.order_visible_to_me(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = _order_id
      AND (
        o.reseller_id = public.current_reseller_id()
        OR public.is_super_admin(auth.uid())
        OR public.has_any_permission(auth.uid(), ARRAY['orders.view','orders.edit','orders.create','orders.delete'])
      )
  )
$$;

CREATE POLICY "Read notes on visible orders"
ON public.order_notes FOR SELECT TO authenticated
USING (public.order_visible_to_me(order_id));

CREATE POLICY "Staff write notes"
ON public.order_notes FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_any_permission(auth.uid(), ARRAY['orders.edit','orders.create'])
    OR public.reseller_can_note(order_id)
  )
);

CREATE POLICY "Staff update notes"
ON public.order_notes FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_any_permission(auth.uid(), ARRAY['orders.edit'])
  OR (author_id = auth.uid() AND public.reseller_can_note(order_id))
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.has_any_permission(auth.uid(), ARRAY['orders.edit'])
  OR (author_id = auth.uid() AND public.reseller_can_note(order_id))
);

CREATE POLICY "Staff delete notes"
ON public.order_notes FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_any_permission(auth.uid(), ARRAY['orders.edit','orders.delete'])
  OR (author_id = auth.uid() AND public.reseller_can_note(order_id))
);
