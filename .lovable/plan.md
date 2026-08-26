# Remove production service-role dependency

## Goal
Make reseller 3-dot account actions and automatic payment flows work on the Cloudflare custom domain without requiring `SUPABASE_SERVICE_ROLE_KEY` in that deployment.

## Changes
- Keep reseller password reset, email confirmation, and impersonation on authenticated, permission-checked database functions; verify no action falls back to the privileged server client.
- Replace payment gateway reads and settlement writes that currently call the service-role client with narrowly scoped database functions.
- Public checkout functions will use the publishable backend client only for approved operations; credential-returning functions remain server-only and expose no credentials to browsers.
- Preserve dynamic callback URLs from the incoming custom-domain request.
- Add grants and permission checks for every new database function, then apply the migration.

## Validation
- Test reseller password reset and “Login as reseller” through the authenticated server-function path.
- Test active gateway loading and starting an ePaySeba deposit without a service-role binding.
- Verify return/webhook routes resolve on the custom-domain-compatible request path and no longer throw the missing-key error.
