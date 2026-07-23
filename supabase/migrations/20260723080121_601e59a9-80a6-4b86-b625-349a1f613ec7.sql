CREATE TABLE public.notification_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid REFERENCES public.resellers(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('sms','email')),
  provider text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_name text,
  from_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_configs TO authenticated;
GRANT ALL ON public.notification_configs TO service_role;
ALTER TABLE public.notification_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA manage all notif" ON public.notification_configs FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Reseller manage own notif" ON public.notification_configs FOR ALL TO authenticated
  USING (reseller_id = public.current_reseller_id()) WITH CHECK (reseller_id = public.current_reseller_id());
CREATE TRIGGER trg_notification_configs_updated BEFORE UPDATE ON public.notification_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  channel text NOT NULL,
  recipient text NOT NULL,
  template text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA read all notif logs" ON public.notification_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Reseller read own notif logs" ON public.notification_logs FOR SELECT TO authenticated
  USING (reseller_id = public.current_reseller_id());
CREATE POLICY "System insert notif logs" ON public.notification_logs FOR INSERT TO authenticated
  WITH CHECK (true);