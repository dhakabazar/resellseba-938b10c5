create index if not exists idx_products_active_brand_created on public.products (is_active, brand_id, created_at desc);
create index if not exists idx_product_categories_cat_product on public.product_categories (category_id, product_id);
create index if not exists idx_categories_slug on public.categories (slug);
create index if not exists idx_brands_slug on public.brands (slug);