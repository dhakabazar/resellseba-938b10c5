-- Create permissions table
create table if not exists public.permissions (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    description text,
    created_at timestamptz default now()
);

-- Create custom roles table
create table if not exists public.roles (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    description text,
    is_system boolean default false,
    created_at timestamptz default now()
);

-- Join table for roles and permissions
create table if not exists public.role_permissions (
    role_id uuid references public.roles(id) on delete cascade,
    permission_id uuid references public.permissions(id) on delete cascade,
    primary key (role_id, permission_id)
);

-- Update user_roles to reference custom roles
do $$ 
begin 
    if not exists (select 1 from information_schema.columns where table_name='user_roles' and column_name='custom_role_id') then
        alter table public.user_roles add column custom_role_id uuid references public.roles(id) on delete set null;
    end if;
end $$;

-- Grant access
grant select, insert, update, delete on public.roles to authenticated;
grant select, insert, update, delete on public.permissions to authenticated;
grant select, insert, update, delete on public.role_permissions to authenticated;
grant all on public.roles to service_role;
grant all on public.permissions to service_role;
grant all on public.role_permissions to service_role;

-- Enable RLS
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

-- Policies (Admins can do everything)
drop policy if exists "Admins can manage roles" on public.roles;
create policy "Admins can manage roles" on public.roles for all to authenticated using (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Admins can manage permissions" on public.permissions;
create policy "Admins can manage permissions" on public.permissions for all to authenticated using (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Admins can manage role_permissions" on public.role_permissions;
create policy "Admins can manage role_permissions" on public.role_permissions for all to authenticated using (public.has_role(auth.uid(), 'super_admin'));

-- Seed default permissions
insert into public.permissions (name, description) values
('orders.view', 'View orders'),
('orders.create', 'Create new orders'),
('orders.edit', 'Edit order details'),
('orders.delete', 'Delete orders'),
('products.view', 'View products'),
('products.manage', 'Add/Edit/Delete products'),
('staff.manage', 'Manage staff and roles'),
('finance.view', 'View financial reports')
on conflict (name) do nothing;

-- Seed system roles
insert into public.roles (name, description, is_system) values
('Super Admin', 'Full system access', true),
('Staff', 'Regular administrative access', true),
('Reseller', 'Storefront and order management', true)
on conflict (name) do nothing;
