---
name: Page bootstrap architecture
description: One-RPC-per-page data loading (lp_bootstrap, store_bootstrap), shared caches for settings/branding/delivery/pixels
type: feature
---

Every page loads its data from ONE database function call, cached per session in `src/lib/bootstrap.ts`.

- `lp_bootstrap(_host)` — landing page: settings + landing content + stats + categories + products, plus the reseller a custom domain belongs to.
- `store_bootstrap(_code)` — storefront: store settings, listings (with images), categories, menu, platform settings + delivery rule, marketing pixels, manual payment methods.

Shared seeding (no page re-fetches these):
- `src/lib/platform-branding.ts` — favicon/primary/accent pushed by whichever bootstrap ran; `__root.tsx` only subscribes via `usePlatformBranding()`. Root must never query `global_settings`.
- `primeGlobalSettings()` in `src/lib/app-data.ts` seeds the session settings cache from a bootstrap payload.
- `injectTrackingFromRows()` in `src/lib/tracking.ts` injects pixels from bootstrap rows (reseller-owned wins over platform).

Rule: do not add per-component `supabase.from(...)` reads for data a bootstrap payload can carry — extend the RPC instead.
