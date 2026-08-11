INSERT INTO public.permissions (name, description) VALUES
('couriers.manage', 'Manage courier configurations'),
('categories.manage', 'Manage product categories'),
('brands.manage', 'Manage product brands'),
('reports.view', 'View advanced sales reports'),
('settings.manage', 'Manage global system settings')
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
    sa_id UUID;
    p_record RECORD;
BEGIN
    -- Ensure Super Admin role exists
    INSERT INTO public.roles (name, description, is_system)
    VALUES ('Super Admin', 'Full system access', true)
    ON CONFLICT (name) DO UPDATE SET is_system = true
    RETURNING id INTO sa_id;

    -- Grant all permissions to Super Admin
    FOR p_record IN SELECT id FROM public.permissions LOOP
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (sa_id, p_record.id)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

GRANT SELECT ON public.roles TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;