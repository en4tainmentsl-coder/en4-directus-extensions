# kyc-document-review

A Directus interface extension for reviewing En4tainment KYC identity
documents from the admin panel.

## What it does

Renders NIC front/back images or PDFs, and venue Business Registration
certificates, held privately in Cloudflare R2. Documents are fetched through
the `r2-deliver` Edge Function, which issues a presigned URL valid for 120
seconds and writes an audit row to `sensitive_asset_access_log` *before* the
URL is issued.

## Behaviour worth knowing

- **Nothing loads on mount.** Each load writes an audit row, so scrolling past
  the field must not create one. Loading is an explicit button press.
- **120-second expiry.** The viewer blanks and state clears when it lapses.
- **PDFs render in an `<iframe>`**, images in an `<img>`, chosen by the object
  key's suffix. Both are possible for NIC front and back; only the venue
  Business Registration is always a PDF.
- **Amber banner when `nic_hash` is NULL**, explaining that the row cannot
  leave `pending` — `talent_identity_complete_when_submitted_check` requires
  all four fields, and only the talent can supply the NIC.

## Authentication

Directus and Supabase are separate identity systems, so the extension carries
its own per-reviewer Supabase sign-in. Each reviewer needs a Supabase account
with `profiles_users.role = 'admin'` alongside their Directus account. A shared
account was rejected: it would record the same identity for every reviewer in
`sensitive_asset_access_log` and destroy that table's purpose.

## Constraint on `types`

`src/index.ts` declares `types: ['string', 'text']`. Directus maps Postgres
`text` to local type `text` and `varchar` to `string`, and the interface picker
filters strictly on the field's type. Every En4tainment application column is
`text`, so an interface declaring only `string` is invisible everywhere, with
nothing logged. CI asserts this in the build output.

## Build and deploy

Run `npm ci` then `npm run build`. The bundle is roughly 228 kB (supabase-js is
bundled). Copy `dist/` and `package.json` into the Directus
`extensions/kyc-document-review/` directory on the VPS and restart the
container. Note that `docker compose up -d` does not recreate a container when
only `.env` has changed — use `--force-recreate`.
