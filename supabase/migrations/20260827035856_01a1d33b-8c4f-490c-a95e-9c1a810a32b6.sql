create extension if not exists pg_trgm;

create index if not exists idx_orders_created on public.orders (created_at desc);
create index if not exists idx_orders_updated on public.orders (updated_at desc);
create index if not exists idx_orders_reseller_created on public.orders (reseller_id, created_at desc);
create index if not exists idx_orders_status_created on public.orders (status, created_at desc);
create index if not exists idx_orders_phone on public.orders (customer_phone);
create index if not exists idx_orders_number_trgm on public.orders using gin (order_number gin_trgm_ops);
create index if not exists idx_orders_customer_trgm on public.orders using gin (customer_name gin_trgm_ops);
create index if not exists idx_orders_area on public.orders (area);
create index if not exists idx_orders_payment_status on public.orders (payment_status);

create index if not exists idx_order_items_product on public.order_items (product_id);
create index if not exists idx_order_items_listing on public.order_items (listing_id);

create index if not exists idx_products_active_created on public.products (is_active, created_at desc);
create index if not exists idx_products_active_featured on public.products (is_active, is_featured);
create index if not exists idx_products_name_trgm on public.products using gin (name gin_trgm_ops);
create index if not exists idx_products_code_trgm on public.products using gin (product_code gin_trgm_ops);

create index if not exists idx_pimages_product_sort on public.product_images (product_id, sort_order);

create index if not exists idx_listings_reseller_active on public.reseller_listings (reseller_id, is_active, created_at desc);

create index if not exists idx_categories_active_sort on public.categories (is_active, sort_order);
create index if not exists idx_brands_active_sort on public.brands (is_active, sort_order);

create index if not exists idx_shipments_order_created on public.shipments (order_id, created_at desc);
create index if not exists idx_payouts_reseller_status2 on public.payouts (reseller_id, status, created_at desc);
create index if not exists idx_deposit_requests_status_created on public.deposit_requests (status, created_at desc);
create index if not exists idx_leader_commissions_leader on public.leader_commissions (leader_id, status);
create index if not exists idx_leader_commissions_order on public.leader_commissions (order_id);
create index if not exists idx_resellers_status on public.resellers (status, created_at desc);
create index if not exists idx_agent_payouts_status on public.agent_payouts (status, created_at desc);
create index if not exists idx_menu_items_reseller_active on public.reseller_menu_items (reseller_id, is_active, sort_order);
create index if not exists idx_tutorials_active_sort on public.tutorials (is_active, sort_order);
create index if not exists idx_notif_logs_reseller_created on public.notification_logs (reseller_id, created_at desc);
create index if not exists idx_order_notes_order_created on public.order_notes (order_id, created_at desc);
create index if not exists idx_status_history_order_created on public.order_status_history (order_id, created_at desc);
create index if not exists idx_expenses_created on public.expenses (created_at desc);

analyze public.orders;
analyze public.order_items;
analyze public.products;
analyze public.reseller_listings;