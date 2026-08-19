CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  spent_on date NOT NULL DEFAULT current_date,
  method text,
  reference text,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance staff can view expenses" ON public.expenses
FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['finance.view','reports.view','settings.manage']));

CREATE POLICY "Finance staff can add expenses" ON public.expenses
FOR INSERT TO authenticated
WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['finance.view','settings.manage']));

CREATE POLICY "Finance staff can edit expenses" ON public.expenses
FOR UPDATE TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['finance.view','settings.manage']));

CREATE POLICY "Finance staff can delete expenses" ON public.expenses
FOR DELETE TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['finance.view','settings.manage']));

CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_expenses_spent_on ON public.expenses (spent_on DESC);