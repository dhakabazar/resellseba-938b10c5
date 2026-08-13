INSERT INTO public.permissions (name, description) VALUES
  ('dashboard.view', 'View admin dashboard'),
  ('resellers.manage', 'View and manage resellers'),
  ('payouts.manage', 'Manage reseller payouts'),
  ('commissions.manage', 'Manage leader commissions'),
  ('payments.manage', 'Manage payment methods'),
  ('marketing.manage', 'Manage marketing / ads configs'),
  ('notifications.manage', 'Manage notification settings'),
  ('landing.manage', 'Manage landing page content'),
  ('audit.view', 'View audit log')
ON CONFLICT (name) DO NOTHING;