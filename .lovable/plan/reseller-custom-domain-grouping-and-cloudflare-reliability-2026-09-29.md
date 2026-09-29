# Reseller custom domain grouping and Cloudflare reliability

## What will change
- Show an apex domain and its `www` address inside one clean domain card, with one status summary and both DNS records grouped together.
- Redesign the add area and domain cards for clearer mobile and desktop use, while keeping the existing Cloudflare/Server DNS choice.
- Make add/remove operations treat the apex and `www` pair as one unit and report partial Cloudflare failures clearly instead of silently hiding them.
- Keep each reseller isolated so they can only view and manage their own domain pair.

## Connection checks
- Verify that adding an apex domain creates both custom hostnames in Cloudflare and saves both returned Cloudflare IDs.
- Verify that removing the grouped card removes both Cloudflare custom hostnames and any attached Worker domains before deleting the saved rows.
- Ensure a failed automatic `www` creation or Cloudflare deletion is visible to the reseller and can be retried safely.

## Validation
- Check the page at desktop and mobile sizes.
- Confirm the current preview builds successfully and the grouped add/status/remove controls behave consistently.
