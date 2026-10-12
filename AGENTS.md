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
- Custom-domain apex and www records are one reseller-facing unit; group removal runs server-side and retains any row whose Cloudflare cleanup fails so it can be retried.
- Store body category selections live under a shared reserved theme-settings key, saved atomically through an invoker RPC and resolved separately in store context; this preserves theme settings, header navigation and catalog routes while keeping storefront loading in its existing bootstrap.
- DataToolbar exposes an opt-in stacked mobile layout so dense reseller-network controls fit narrow screens without changing other page layouts.
