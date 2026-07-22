# Reseller Platform – Full Build Plan

Ekta multi-tenant reseller e-commerce platform banabo. Super Admin (SA) product/brand/category own korbe, resellers nijeder store e listing korbe with own pricing, own domain, own branding — customer ke SA er kono info dekha jabe na.

Big scope, tai ami phase-wise build korbo. Nicher plan e full scope + flow + phases sob thakbe.

---

## 1. Core Roles & Tenancy Model

- **Super Admin (SA)** – platform owner. Product/brand/category master, courier booking, global settings, payment gateway config, ads config, all resellers ke control kore.
- **Reseller (Tenant)** – signup kore, SA er product theke listing kore nijer store e, own price/profit set kore, own branding/domain.
- **Sub-user under Reseller** – (optional Phase 2) reseller er order manager / staff.
- **Leader Reseller** – special reseller jara onno reseller ke refer/manage kore, commission pay.
- **Customer** – reseller store e visit kore order kore. SA er kono trace dekhbe na.

**Tenancy:** single database, `reseller_id` column diye row-level isolation. Custom domain → reseller resolve → sob query auto-scoped. RLS + server-side guard duitai thakbe.

---

## 2. Phased Delivery (bড় project, tai step by step)

### Phase 0 – Foundation (ei phase e ami start korbo)
- Lovable Cloud enable (DB, auth, storage, edge)
- Global design system: color tokens, typography, spacing, radius, shadow — sob `styles.css` e semantic token. Card, Button, Input, Modal/Popup, Table, EmptyState, Toast — ekta shared UI kit. Sob screen ei kit use korbe (consistency).
- Global settings table (site name, logo, favicon, OG image, primary color, title template) — SA ekbar set korbe, sob jaigai use hobe. **Kono hardcode nai.**
- Auth: email/password + Google (SA + Reseller alada role, `user_roles` table separate)
- Base layouts: `/admin/*`, `/reseller/*`, tenant storefront `/*` (domain-based)
- SEO base: dynamic `<head>` per route, sitemap, robots, JSON-LD helper

### Phase 1 – Catalog (SA)
- Brand CRUD (name, slug, logo, SEO fields)
- Category CRUD (nested, slug, SEO fields, banner)
- Product CRUD:
  - Title, slug, description (rich text), short desc
  - Multi-image upload
  - Variants (size/color) + stock
  - **SA cost breakdown:** buying price, packaging cost, delivery cost inside/outside — reseller ei gulo clearly dekhbe
  - Suggested MRP, min selling price (reseller er lowest listing price)
  - Delivery override: flat / inside Dhaka / outside Dhaka / per-product custom
  - SEO fields: meta title, meta desc, OG title/desc/image, canonical, keywords
- **Image upload security & optimization pipeline:**
  - Client validate: mime, extension, magic-byte check, max input 10MB
  - Server (edge function): re-decode via sharp-equivalent (WASM `@jsquash/*` — worker-safe), strip EXIF, reject if not real image → prevents virus/polyglot upload
  - Auto compress + resize to WebP, target **≤ 200KB** (iterative quality reduction until under threshold)
  - Store in Lovable Cloud storage, public bucket for product images
  - Return only sanitized URL

### Phase 2 – Reseller Onboarding & Store
- Signup / login, KYC fields (name, phone, address, NID optional)
- Reseller dashboard: sales, due, commission, order stats, top products
- **Store design settings (per reseller):**
  - Logo, favicon, OG image, primary/accent color, store name, tagline
  - Homepage sections toggle (hero, featured category, new arrivals, testimonials)
  - Footer info, social links, WhatsApp button
  - Contact page fields
- Custom domain via Cloudflare SaaS (Custom Hostnames API): reseller adds domain → we create hostname → show CNAME → auto SSL. Middleware host-header → reseller resolve.
- **Info isolation:** storefront e SA branding/name kothao nai. Invoice/email/SMS sob reseller branding use kore.

### Phase 3 – Reseller Listing
- Product browser (SA catalog) → "Add to my store"
- Set own selling price (validated ≥ min price), own title/desc override optional, own SEO override optional
- Reseller store frontend: home, category, product, cart, checkout, order tracking — SA er design pattern, but reseller branding/pricing
- Wishlist, search, filter (brand/category/price)

### Phase 4 – Order Flow
- Customer places order on reseller storefront (COD default + online gateways)
- Order sits in **reseller's panel** – status: `Pending / Confirmed / Ready to Send`
- **Reseller "Send to Admin" action** → tokhoni order SA panel e visible hobe (auto forward na)
- SA panel: receive → confirm → book courier
- Statuses: Pending → Confirmed → Sent to Admin → Booked → In Transit → Delivered / Returned / Cancelled
- **Both SA and reseller** parcel history & timeline dekhbe (read-only for reseller after send)
- Bulk actions, filter, export CSV, invoice PDF (reseller branding)

### Phase 5 – Courier Integrations
Config UI (SA global) — enable/disable + credentials per courier:
- **Steadfast** – API booking, status webhook, fetch balance
- **Pathao** – OAuth + booking API + city/zone/area fetch
- **RedX / eCourier** – (extensible adapter pattern)
- **Carrybee** – API booking
- Adapter interface: `book(order)`, `track(consignmentId)`, `cancel()`, `webhookHandler()`
- SA order screen e "Book with [courier]" dropdown, auto sync tracking

### Phase 6 – Payment Gateways
Config UI (SA global) — each toggle + credentials:
- **bKash / Nagad / Rocket – Personal** (manual: TxID input from customer, reseller/SA verify)
- **bKash / Nagad – API** (Merchant / Tokenized Checkout)
- **SSLCommerz**
- **Aamarpay / ShurjoPay** (extensible)
- Reseller o nijer personal number use korte parbe (per-reseller override)
- Payment reconciliation, refund status

### Phase 7 – Delivery Charge Engine
Rules cascade: product-level → category-level → brand-level → global
- Inside Dhaka / Outside Dhaka / Sub-city custom
- Flat rate / weight-based / free above X
- Reseller can add own extra charge (markup) on top

### Phase 8 – Financials
- Per-reseller ledger: sales, cost (SA price), profit, delivery, packaging, courier fee, COD collected, paid to reseller, due
- SA dashboard: total sales, gross, net, per-reseller breakdown, commission payable, pending payout
- **Leader reseller commission:** % from downline reseller's profit, auto-calc
- Payout requests, mark as paid, transaction log
- Invoice generation

### Phase 9 – Marketing / Ads / SEO
- **Facebook Ads config (per reseller):** Pixel ID, Conversion API access token, test event code, event mapping (ViewContent, AddToCart, InitiateCheckout, Purchase). Server-side CAPI edge function auto fires.
- **TikTok Ads config (per reseller):** Pixel ID, Events API access token — via TikTok connector. Same event mapping.
- Google Analytics 4 + GTM ID
- SEO Manager: per-page meta override, sitemap auto-regen, robots editor, schema markup (Product, Breadcrumb, Organization, Review)
- Blog module (optional) for SEO content

### Phase 10 – Notifications
- Email (SMTP config global) — order, signup, payout
- SMS gateway config (BulkSMSBD / SSL / Alpha) — order confirm, delivery update
- In-app notifications
- WhatsApp click-to-chat

### Phase 11 – Polish
- Analytics dashboards (Recharts)
- Activity log / audit trail
- Role-based permission fine-tune
- Rate limiting, security scan, RLS review
- Performance: image CDN, route-level code split, ISR-like caching

---

## 3. Global UI Kit (age banabo, sob screen use korbe)

Ei components sob jaigai identical:
- `<PageHeader>`, `<StatCard>`, `<DataTable>` (sorting/filter/pagination/bulk-action built-in)
- `<FormField>`, `<ImageUploader>` (200KB pipeline built-in), `<RichTextEditor>`
- `<Modal>`, `<ConfirmDialog>`, `<Drawer>`, `<Toast>`, `<EmptyState>`, `<StatusBadge>`
- `<PriceBreakdown>` (SA cost + reseller profit view)
- `<AddressPicker>` (division/district/thana cascade)

Ek jaigai style change → sob jaigai reflect.

---

## 4. Data Model (high level)

`profiles`, `user_roles(app_role: super_admin|reseller|leader|staff|customer)`, `resellers`, `reseller_settings`, `reseller_domains`, `brands`, `categories`, `products`, `product_images`, `product_variants`, `product_costs`, `reseller_listings`, `orders`, `order_items`, `order_status_history`, `couriers_config`, `courier_bookings`, `payment_methods_config`, `payments`, `delivery_rules`, `ledger_entries`, `commissions`, `payouts`, `ads_config`, `seo_overrides`, `global_settings`, `notifications`, `audit_log`.

Sob table e RLS + `reseller_id` scoping (jekhane applicable). `has_role()` security-definer function.

---

## 5. Info Leak Prevention (critical)

- Storefront responses SA er kono field expose korbe na (SA cost, SA name, other reseller data)
- Server function level whitelist projections
- Custom domain reseller resolve — mismatch hole 404
- Invoice/email templates 100% reseller-branded
- Admin routes strictly gated (`/admin` requires super_admin role, `/reseller` requires reseller role)

---

## 6. Tech Stack

- TanStack Start (already scaffolded), Tailwind v4, shadcn variants
- Lovable Cloud (Supabase): Postgres + Auth + Storage + Edge
- Cloudflare for Custom Hostnames (SSL) — API integration
- Image processing: WASM (worker-compatible, no sharp binary)
- Payments/Courier: adapter pattern, easily add new providers

---

## 7. First Delivery (ei chat er por ki hobe)

Ami start korbo **Phase 0 + Phase 1** ekshathe:
1. Lovable Cloud enable
2. Design system + global UI kit
3. Auth + roles (SA / Reseller)
4. Global settings screen
5. Brand / Category / Product CRUD with secure image pipeline (≤200KB, virus-safe)
6. Basic SA dashboard shell + Reseller dashboard shell
7. Landing / auth pages with polished UI

Phase 2+ er kaj tumi confirm korle porer turn e continue korbo — ekta message e sob build korle stability & review kora kothin hoye jai.

---

## Confirm korar age 2 ta clarification

1. **Custom domain (Cloudflare):** tomar Cloudflare account ache? Cloudflare for SaaS (Custom Hostnames) enable kora ache? Na thakle Phase 2 e ei feature parallel setup korte hobe (API token lagbe).
2. **Reseller signup:** open signup (keu signup korte parbe) na SA approval lagbe? (Recommended: signup → pending → SA approve → active)

Ei duitar answer diye "start" bolle ami Phase 0+1 build shuru kore dibo.
