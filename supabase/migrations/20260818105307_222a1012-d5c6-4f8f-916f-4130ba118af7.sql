
CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  phone text,
  email text,
  whatsapp text,
  sale_target numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read agents" ON public.agents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Agent managers insert agents" ON public.agents
  FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'agents.manage'));

CREATE POLICY "Agent managers update agents" ON public.agents
  FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'agents.manage'));

CREATE POLICY "Agent managers delete agents" ON public.agents
  FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'agents.manage'));

CREATE TRIGGER agents_updated_at BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.resellers
  ADD COLUMN agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;

CREATE INDEX idx_resellers_agent_id ON public.resellers(agent_id);

CREATE OR REPLACE FUNCTION public.current_agent_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.agents WHERE user_id = auth.uid() AND is_active LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_agent_id() TO authenticated;

CREATE POLICY "Agents view assigned resellers" ON public.resellers
  FOR SELECT TO authenticated
  USING (agent_id IS NOT NULL AND agent_id = public.current_agent_id());

CREATE POLICY "Agents view assigned reseller orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    reseller_id IN (
      SELECT r.id FROM public.resellers r
      WHERE r.agent_id IS NOT NULL AND r.agent_id = public.current_agent_id()
    )
  );

INSERT INTO public.permissions (name, description) VALUES
  ('agents.manage', 'Manage commission agents and their reseller assignments'),
  ('agents.view', 'View the agent performance report')
ON CONFLICT (name) DO NOTHING;
