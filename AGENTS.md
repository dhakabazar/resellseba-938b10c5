<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Bulk courier status checks run in client-side batches of 4 and server-side with at most 4 workers; this keeps requests below hosting limits while avoiding courier API floods.
- Reseller product stock displays use the shared stock-visibility policy and existing advanced-settings cache; keep admin visibility and inventory validation separate so hiding stock does not change order rules.
- Custom-domain apex and www records are one reseller-facing unit; group removal runs server-side and retains any row whose Cloudflare cleanup fails so it can be retried.
- Store body category selections live under a shared reserved theme-settings key, saved atomically through an invoker RPC and resolved separately in store context; this preserves theme settings, header navigation and catalog routes while keeping storefront loading in its existing bootstrap.
- DataToolbar exposes an opt-in two-column phone layout while preserving its desktop row; reseller-network filter collapse is phone-only and keeps the original flat filter items.
- Reseller network cards use compact wrapping metadata below the mobile name/action header and a four-column financial grid; VerifyBadges accepts an opt-in layout class so other verification views and desktop layouts remain unchanged.
- Storefront compare-at prices are nullable listing-level display metadata carried by store_bootstrap; all order, payment and tracking calculations continue using selling_price.
- Shared product-presentation helpers resolve discount and sold-range behavior across isolated theme bundles; random sold values are generated after hydration to avoid SSR mismatches.
- Storefront sold badges share one theme-token presentation, with grid price rows using two-column tracks and product quantity/badge pairs grouped to preserve placement across screen sizes.
- Theme header scroll state collapses top strips only and retains the sticky main header; announcement controls use theme content with legacy fallback to preserve existing stores.
- Admin orders, resellers, products and customers plus reseller orders, catalog, listings and customers load in two phases (first page via the RPC _limit argument, then the full list in the background); filtering and paging stay client-side over the full set so they remain instant.
- Admin order pages use user/tab/date-scoped Query caches with stale-while-revalidate; mutations invalidate every affected page and count cache, and the limited request finishes before full loading starts to avoid competing first-page work.
- Reseller Pricing separates the directory from the product table and uses a tabbed modal for rate edits; drafts stay isolated until saved to avoid accidental changes.
- Reseller-wide rate reset deletes overrides through a reseller-scoped helper under existing RLS, never copying defaults into overrides or modifying saved orders; this preserves future master-rate inheritance.
- Reseller rate maps use explicit reseller scope (null means master-only), and existing order edits preserve saved cost snapshots and delivery charges so later rate changes cannot silently reprice them.

- Order prepaid money is mirrored in advance_amount/paid_amount, courier received_amount excludes it; shared helpers and normalization keep status and COD consistent without rewriting historical orders, while remaining online payments subtract both confirmed sources to prevent overcollection.
- Verified gateway captures use a locked database RPC and provider/transaction uniqueness; receiving account ownership is required so webhook retries cannot double-credit money.
- Payment verification binds provider-confirmed order references or stored checkout intents before capture and records gross customer payment, not gateway fees.
- Exchanges are separate linked orders (parent_order_id, is_exchange); DB trigger turns delivered into 'exchanged', admin share is credited in sync_order_profit/orderMargin, and every report status list that includes 'delivered' must also include 'exchanged'; this keeps original orders untouched and reports consistent.
