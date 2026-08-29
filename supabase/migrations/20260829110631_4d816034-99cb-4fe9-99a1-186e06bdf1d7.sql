-- 1. Metadata columns for menu-organized permission UI
ALTER TABLE public.permissions
  ADD COLUMN IF NOT EXISTS group_key text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS group_label text NOT NULL DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100;

-- 2. Fine-grained permissions
INSERT INTO public.permissions (name, description) VALUES
  ('products.create', 'Add new products'),
  ('products.edit', 'Edit existing products'),
  ('products.delete', 'Delete products'),
  ('brands.view', 'View product brands'),
  ('brands.create', 'Add brands'),
  ('brands.edit', 'Edit brands'),
  ('brands.delete', 'Delete brands'),
  ('categories.view', 'View product categories'),
  ('categories.create', 'Add categories'),
  ('categories.edit', 'Edit categories'),
  ('categories.delete', 'Delete categories'),
  ('customers.view', 'View the customer list and export it'),
  ('resellers.view', 'View the reseller list'),
  ('resellers.create', 'Create resellers'),
  ('resellers.edit', 'Edit reseller details and status'),
  ('resellers.delete', 'Delete resellers'),
  ('resellers.verify', 'Verify reseller email / mobile'),
  ('resellers.deposit', 'Manage reseller deposit & frozen balance'),
  ('resellers.password', 'Reset a reseller password'),
  ('resellers.impersonate', 'Log in as a reseller'),
  ('agents.create', 'Add commission agents'),
  ('agents.edit', 'Edit commission agents'),
  ('agents.delete', 'Delete commission agents'),
  ('expenses.view', 'View business expenses'),
  ('payouts.view', 'View reseller payouts'),
  ('deposits.view', 'View reseller deposits')
ON CONFLICT (name) DO NOTHING;

-- 3. Menu grouping + labels
UPDATE public.permissions SET group_key = d.group_key, group_label = d.group_label, label = d.label, sort_order = d.sort_order
FROM (VALUES
  ('dashboard.view','dashboard','Dashboard','View dashboard',10),
  ('products.view','catalog','Catalog','View products',20),
  ('products.create','catalog','Catalog','Add product',21),
  ('products.edit','catalog','Catalog','Edit product',22),
  ('products.delete','catalog','Catalog','Delete product',23),
  ('products.manage','catalog','Catalog','Full product access',24),
  ('brands.view','catalog','Catalog','View brands',30),
  ('brands.create','catalog','Catalog','Add brand',31),
  ('brands.edit','catalog','Catalog','Edit brand',32),
  ('brands.delete','catalog','Catalog','Delete brand',33),
  ('brands.manage','catalog','Catalog','Full brand access',34),
  ('categories.view','catalog','Catalog','View categories',40),
  ('categories.create','catalog','Catalog','Add category',41),
  ('categories.edit','catalog','Catalog','Edit category',42),
  ('categories.delete','catalog','Catalog','Delete category',43),
  ('categories.manage','catalog','Catalog','Full category access',44),
  ('orders.view','orders','Orders','View orders',50),
  ('orders.create','orders','Orders','Add order',51),
  ('orders.edit','orders','Orders','Edit order',52),
  ('orders.status','orders','Orders','Change status (incl. bulk scan)',53),
  ('orders.ship','orders','Orders','Courier booking & shipments',54),
  ('orders.delete','orders','Orders','Delete order',55),
  ('customers.view','customers','Customers','View & export customers',60),
  ('finance.view','finance','Finance','View transaction report',70),
  ('reports.view','finance','Finance','View business report',71),
  ('expenses.view','finance','Finance','View expenses',72),
  ('expenses.manage','finance','Finance','Add / edit / delete expenses',73),
  ('payouts.view','finance','Finance','View payouts',74),
  ('payouts.manage','finance','Finance','Manage payouts',75),
  ('commissions.manage','finance','Finance','Manage leader commissions',76),
  ('deposits.view','finance','Finance','View deposits',77),
  ('deposits.manage','finance','Finance','Manage deposits & transactions',78),
  ('resellers.view','resellers','Resellers','View reseller list',80),
  ('resellers.create','resellers','Resellers','Add reseller',81),
  ('resellers.edit','resellers','Resellers','Edit reseller / change status',82),
  ('resellers.verify','resellers','Resellers','Verify email / mobile',83),
  ('resellers.deposit','resellers','Resellers','Deposit & freeze',84),
  ('resellers.password','resellers','Resellers','Reset password',85),
  ('resellers.impersonate','resellers','Resellers','Login as reseller',86),
  ('resellers.delete','resellers','Resellers','Delete reseller',87),
  ('resellers.manage','resellers','Resellers','Full reseller access',88),
  ('agents.view','agents','Agents','View agent report',90),
  ('agents.create','agents','Agents','Add agent',91),
  ('agents.edit','agents','Agents','Edit agent',92),
  ('agents.delete','agents','Agents','Delete agent',93),
  ('agents.manage','agents','Agents','Full agent access',94),
  ('visitors.view','visitors','Store visitors','View visitor report',100),
  ('marketing.manage','growth','Growth','Manage marketing / pixels',110),
  ('notifications.manage','growth','Growth','Manage notifications & notices',111),
  ('landing.manage','system','System','Manage landing page & tutorials',120),
  ('couriers.manage','system','System','Manage couriers',121),
  ('payments.manage','system','System','Manage payment methods',122),
  ('staff.manage','system','System','Manage staff, roles & permissions',123),
  ('domains.manage','system','System','Manage custom domains',124),
  ('maintenance.manage','system','System','Cache & cleanup tools',125),
  ('settings.advanced','system','System','Advanced settings',126),
  ('settings.manage','system','System','Global settings & privacy policy',127)
) AS d(name, group_key, group_label, label, sort_order)
WHERE public.permissions.name = d.name;

-- 4. Broad "manage" implies the matching granular actions, so existing roles keep access
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.custom_role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = _user_id
        AND ur.role = 'staff'
        AND (
          p.name = _permission
          OR (
            split_part(_permission, '.', 2) <> 'manage'
            AND p.name = split_part(_permission, '.', 1) || '.manage'
          )
        )
    );
$function$;

CREATE OR REPLACE FUNCTION public.has_any_permission(_user_id uuid, _permissions text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM unnest(_permissions) AS req(name)
      WHERE public.has_permission(_user_id, req.name)
    );
$function$;

-- 5. my_permissions expands manage umbrellas so the UI sees the granular set
CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.is_super_admin(auth.uid())
      THEN (SELECT COALESCE(array_agg(DISTINCT p.name), ARRAY[]::text[]) FROM public.permissions p)
    ELSE (
      SELECT COALESCE(array_agg(DISTINCT n), ARRAY[]::text[])
      FROM (
        SELECT p.name AS n
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.custom_role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = auth.uid() AND ur.role = 'staff'
        UNION
        -- expand: <domain>.manage grants every <domain>.* permission
        SELECT all_p.name
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.custom_role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        JOIN public.permissions all_p
          ON split_part(all_p.name, '.', 1) = split_part(p.name, '.', 1)
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'staff'
          AND split_part(p.name, '.', 2) = 'manage'
      ) x
    )
  END;
$function$;