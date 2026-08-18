ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS commission_rate numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.agent_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  kind text NOT NULL DEFAULT 'payment',
  status text NOT NULL DEFAULT 'pending',
  method text,
  reference text,
  note text,
  admin_note text,
  period_from date,
  period_to date,
  created_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_payouts_agent ON public.agent_payouts(agent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_payouts TO authenticated;
GRANT ALL ON public.agent_payouts TO service_role;

ALTER TABLE public.agent_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agent payout managers read" ON public.agent_payouts;
CREATE POLICY "Agent payout managers read" ON public.agent_payouts
  FOR SELECT TO authenticated
  USING (
    public.has_any_permission(auth.uid(), ARRAY['agents.manage','agents.view'])
    OR agent_id = public.current_agent_id()
  );

DROP POLICY IF EXISTS "Agent payout managers insert" ON public.agent_payouts;
CREATE POLICY "Agent payout managers insert" ON public.agent_payouts
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'agents.manage'));

DROP POLICY IF EXISTS "Agent payout managers update" ON public.agent_payouts;
CREATE POLICY "Agent payout managers update" ON public.agent_payouts
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'agents.manage'));

DROP POLICY IF EXISTS "Agent payout managers delete" ON public.agent_payouts;
CREATE POLICY "Agent payout managers delete" ON public.agent_payouts
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'agents.manage'));

DROP TRIGGER IF EXISTS agent_payouts_updated_at ON public.agent_payouts;
CREATE TRIGGER agent_payouts_updated_at BEFORE UPDATE ON public.agent_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();