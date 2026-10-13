# Roadmap

- [x] Align payment/advance ownership, paid/unpaid/partial, courier COD, add/edit/view and financial reports; 26 regressions plus rolled-back capture/retry/overcollection SQL checks pass, signed-in temporary order save/readback and transaction-report retained-cash assertions pass; temporary rows removed
- [ ] Live gateway capture and courier booking confirmation — blocked on real-money/provider operations; not performed during safe audit

- [x] Add selected-reseller Reset for all custom rates; 12 tests pass and signed-in temporary rate save/reset/reload confirms defaults with original custom reseller unchanged

- [x] Optimize admin order status switching with account/status/date cache and mutation invalidation; signed-in revisit has zero order requests, 20/50 paging verified, typed status index access and limit-before-joins confirmed, tests/build pass

- [x] Redesign Reseller Pricing with separate rate editor and custom-reseller directory tabs; signed-in save/read-back verified
- [x] Audit custom-rate RPCs and test catalog, reseller/admin order calculations and checkout; 19 tests pass, temporary rates removed, no real orders submitted

- [x] Align highlighted sold count with grid prices and after product quantity across all five themes; desktop/mobile badge placement verified

- [x] Restore original reseller-network desktop filters; mobile-only collapse and two-column toolbar (build OK; signed-in account lacks admin access for browser verification)

- [x] Product-page sold range and hide storefront product codes
- [x] Single-listing previous price with storefront discounts; preserve bulk behavior
- [x] Compact theme headers/top strip on scroll, announcement controls and selected mobile cart labels
- [x] Larger load-more button and reduced footer gap; verify storefront flows

- [x] Align reseller-network search/date controls on mobile and collapse status filters by default

- [x] Add independent header menu / body category tabs and apply active body categories across all themes

- [x] Storefront cleanup: remove promo/trust copy, paginate products, link all-products page, simplify category header
- [ ] Catalog redesign (LP /catalog + /catalog/$slug) — deferred outside current payment audit
- [ ] Reseller staff account management — deferred outside current payment audit
- [x] Add a fifth clean storefront theme with fully distinct pages and load only the active theme bundle; keep tracking global
- [x] Group reseller apex + www domains into one card and make Cloudflare pair cleanup retryable
- [x] Clean root-level custom domain routing for all storefront pages and components

