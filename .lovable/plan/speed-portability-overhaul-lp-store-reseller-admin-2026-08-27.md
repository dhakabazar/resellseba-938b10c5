# Speed + portability overhaul (LP, Store, Reseller, Admin)

Goal: every page loads from **1–2 backend calls**, indexes cover every filter/sort, and nothing is tied to this specific domain or backend instance — so the project can be moved to another domain or a self-hosted backend and just work.

## Approach: one "page bootstrap" call per page

Today most pages fire 5–16 separate queries (admin dashboard 10, admin/reseller orders 16, reseller dashboard 9, landing 9, storefront 5). Each page gets a single database function that returns one JSON payload with everything that page needs, called through one server/RPC call and cached client-side.

New database functions (JSON returning, security definer, RLS-safe by checking the caller's role/reseller inside):

| Portion | Function | Replaces |
|---|---|---|
| Landing | `lp_bootstrap()` | 9 calls (counts, categories, featured, top sellers) |
| Storefront | `store_bootstrap(code)` | 5 calls (store, listings, categories, menu, settings) |
| Reseller | `reseller_bootstrap()` | reseller row + settings + notices + profit summary |
| Reseller | `reseller_dashboard()` | 9 calls (orders, listings, payouts, commissions, top products) |
| Orders (both) | `orders_page(filters, page)` | 16 calls → 1 (rows + items + shipments + status counts, paginated server-side) |
| Admin | `admin_dashboard()` | 10 calls |
| Admin | `admin_lookups()` | resellers/products/categories/brands pickers used by modals, cached once per session |

Shared reference data (global settings, my reseller, catalog lookups) moves into one session cache module so no page re-fetches it — the existing `src/lib/app-data.ts` cache is extended instead of adding a new pattern.

## Pagination and payload discipline

- Orders lists paginate and count in the database instead of pulling up to 5000 rows and all statuses to the browser.
- Every select lists only the columns the UI renders; no `select("*")` on wide tables.
- Report pages keep their existing RPCs (already single-call) but get date-range pushdown so they stop over-fetching.

## Indexing

One migration adding the missing indexes behind current filters and sorts, e.g.
`orders(created_at desc)`, `orders(reseller_id, created_at desc)`, `orders(updated_at desc)`, `orders(customer_phone)`, `orders(order_number)`, `order_items(product_id)`, `products(is_active, created_at desc)`, `products(is_active, is_featured)`, trigram index for product name/code search, `reseller_listings(reseller_id, is_active, created_at desc)`, `categories(is_active, sort_order)`, `brands(is_active, sort_order)`, `shipments(order_id, created_at desc)`, `payouts(reseller_id, status)`, `deposit_requests(status, created_at desc)`, `leader_commissions(leader_id, status)`.

## Portability (no hardcoding)

- All absolute URLs (callbacks, webhooks, sitemaps, OG images, share links) derive from the request origin or `global_settings.callback_base_url` — the remaining `example.com` placeholder in the sitemap route and the `your-panel.com` sample text get replaced with dynamic values.
- Backend URL/keys come only from env (`VITE_SUPABASE_*` in browser, `SUPABASE_*` on the server), so a self-hosted backend needs no code change.
- Third-party API base URLs (couriers, gateways, SMS/email) stay configurable from their existing config rows, with the code default only as a fallback.
- Branding, colors, logos, contact info keep coming from `global_settings` / `reseller_settings`.

## Order of work

1. Index migration + shared session cache (foundation, benefits every page).
2. Landing page.
3. Storefront (`/s/:code` home, category, product, checkout).
4. Reseller portion (dashboard, orders, listings, catalog, finance).
5. Admin portion (dashboard, orders, products, resellers, reports).
6. Portability sweep + final verification of each page's call count in the browser network panel.

Each step ends with the page rendering identically, verified against the live preview.

## Technical notes

- New DB functions are `security definer` with `search_path = public` and re-check `has_role` / `current_reseller_id()` internally, so RLS guarantees are preserved; grants go to `authenticated` (and `anon` only for LP/storefront reads).
- Client calls go through `supabase.rpc(...)` for user-scoped data and existing `createServerFn` wrappers for public SSR reads, keeping SEO/head metadata intact.
- No UI/behavior changes are intended; this is a data-path refactor.
