## What does this change?

<!-- One or two sentences. What problem does this solve? -->

## Which extension?

- [ ] kyc-document-review
- [ ] Repo-level (CI, config, tooling)

## Checklist

- [ ] `npm run build` succeeds, and `npm run validate` was run **after** the build
- [ ] No secrets, API keys, or Supabase service-role values in this diff
- [ ] Interface extensions declare `types: ['string', 'text']` — every En4tainment column is Postgres `text`, and omitting `'text'` makes the extension invisible in the field picker with no error
- [ ] Nothing here runs DDL. Schema ownership stays with `Audience-Interface` migrations

## If this touches document rendering

- [ ] Both image **and** PDF paths handled — NIC front/back may be either
- [ ] PDFs use `<iframe>`, not `<object>` or `<embed>` (CSP sets `object-src 'none'`)
- [ ] Presigned URLs are rendered immediately and never cached, stored, or logged
- [ ] Every document fetch still writes a `sensitive_asset_access_log` row before the URL is issued

## Notes for reviewer (or future me)

<!-- Context: why a workaround was used, what to test manually, known follow-ups -->
