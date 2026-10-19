# QuickMind Store1 WordPress staging receiver

This native plugin adapts PR #2's payload and shared eight-language form client to WordPress REST/MySQL. The Python `lead-api/` remains unchanged as a reference and fallback. No WooCommerce, payment, order creation or live-site changes.

## Install on an isolated staging host

1. Requirements: WordPress 6.5+, PHP 8.1+, MySQL/MariaDB (InnoDB and GET_LOCK support), HTTPS. Back up the test database. Do not use the production database or production wp-config.
2. Add `define('WP_ENVIRONMENT_TYPE', 'staging');` to staging wp-config.php. Upload `quickmind-leads-1.0.0.zip` through Plugins > Add New > Upload, activate. Activation creates `{prefix}qm_leads` and an hourly WP-Cron task. Multisite network activation is unsupported; activate per site.
3. Open **QuickMind leads** as an administrator; set the notification mailbox and retention (default 180 days; range 1–730). Configure the host's WordPress SMTP transport, authenticated domain/SPF/DKIM/DMARC and a real cron calling WP-Cron at least hourly. Credentials belong in host/SMTP configuration, never frontend code or this repository.
4. Serve Store1 from the **same staging origin** as WordPress (subdirectory is fine). The public endpoint requires exact same-origin `Origin` and JSON. Cross-origin hosting is deliberately unsupported; do not weaken CORS. For WordPress in a subdirectory, use the actual `rest_url('quickmind/v1/leads')`, including that subdirectory.
5. Before existing app/localized scripts run, set:

```html
<script>window.QM_LEAD_ENDPOINT = '/wp-json/quickmind/v1/leads';</script>
```

Deploy the updated `dist/lead-client.js` from this branch together with the existing Store1 files. The existing English SPA and seven localized scripts already import `/lead-client.js` and call `submit(form)`; keep these handlers. Do not load a second copy. The ZIP includes an identical module at `assets/lead-client.js` for template integrations; importing it must be paired with the existing submit handler. The plugin does not automatically inject forms or scripts into unrelated WordPress pages.

Existing selectors: `[data-quote-form]`, `[data-locale-quote]`. Buyer select order must remain home, clinic, distributor; stable machine-value selections are also supported in the client. Existing fields remain name, email, country, organization, quantity, payment, notes, source_page, source_cta, source_reference and UTM. Languages: en, zh-CN, es, fr, de, ja, ko, id. Consent must be explicitly checked; do not include clinical records. Update the staging privacy notice with controller contact, purpose, hosting/transfers, retention and deletion request instructions before collecting real leads.

With QM_LEAD_ENDPOINT configured, optional anonymous event transport is disabled: this plugin implements inquiry counts, not PR #2's analytics events endpoint. Do not infer conversion rates from these counts. Without this variable the Python path continues to work unchanged.

## Storage, retry and authorization

- POST `/wp-json/quickmind/v1/leads` is public for anonymous prospects; no browser secret or WordPress login is required. Administrator actions require a logged-in user with `manage_options` and a verified nonce. Do not expose an export token or admin REST endpoint.
- Exact origin and content type, 16 KiB body limit, strict enums/contact validation, consent, honeypot and per-REMOTE_ADDR hashed rate limit (30 attempts per sliding minute) reduce unwanted submissions. These are not proof of human identity; configure staging WAF/challenge rules for sustained abuse. No raw IP is stored. Configure proxy REMOTE_ADDR correctly; arbitrary forwarded headers are ignored.
- DB advisory locks serialize insert/dedupe and mail workers; unique submission key also protects against concurrent retries. Lock/DB failures return 503, never stored=true. Retry retains form entries and submission ID; edits create a new ID. Same canonical payload within 24 hours is deduplicated. Notifications are not sent again for duplicates.
- Only a persisted lead returns `{ok:true,stored:true,lead_id:...}` (201 new / 200 duplicate); invalid payload 422, origin 403, conflicting key 409, rate 429, unavailable storage 503. Treat 503/network uncertainty as retriable using the same payload and key.
- Mail is processed asynchronously, at most 20 per hourly run, five attempts with backoff. `pending`, `failed`, `mail_accepted` describe notification processing. `wp_mail()` true means the mail component accepted the request, **not inbox delivery**. No delivery webhook is implemented. Admin can requeue a notification; avoid requeueing accepted mail unless necessary. Worker crashes between transport acceptance and status update can produce duplicate mail (at-least-once delivery).
- Notification email includes a lead reference and administrator link, no submitted PII. Full details are visible only in authenticated admin. CSV is administrator/nonce protected, uncached and formula-prefixed; it contains personal data and must be handled accordingly. View is paginated 25 rows, export in 500-row batches.

## Privacy and rollback

- Server UTC creation time and consent version are recorded. Hourly retention deletes expired rows; no traffic means WP-Cron may not run, hence a real scheduler is required. Purging a row also purges its notification and dedupe data. Transient hashed rate keys expire after 60 seconds; no visitor PII in localStorage.
- Individual Delete permanently removes a row. WordPress Tools > Erase/Export Personal Data uses WordPress's email-verification request workflow and this plugin's callbacks. Administrator must verify identity before manual deletion. Backups, downloaded CSVs and mailbox copies follow separate retention procedures.
- Deactivation stops cron and preserves data. Uninstall preserves data by default; only `define('QM_LEADS_DELETE_ON_UNINSTALL', true);` opts into table deletion. Back up first. Settings/table are specific to the current WP site.
- Rollback: restore the frontend configuration to `QM_LEAD_API` for the old Python service and remove `QM_LEAD_ENDPOINT`; test that endpoint first. Disable this plugin. Do not run two submission handlers. Existing WordPress leads do not automatically migrate to Python. Never silently fall back to mailto while claiming receipt.

## Automated verification

The `WordPress leads staging integration` GitHub workflow provisions a disposable WordPress/MySQL instance, lints PHP, tests all 24 language/type combinations, persistence/attribution, retry/conflict, rejection/origin, DB failure, mocked mail failure/retry, retention, CSV escaping and verified privacy erasure callback. Playwright uses the shipped module in a Spanish form, tests network failure with retained inputs and real REST/database retry. It builds the install ZIP and uploads a screenshot. Run PHP tests ONLY against a disposable database: they truncate the plugin table.

```sh
wp eval-file /absolute/path/wordpress/tests/integration.php --path=/disposable/wordpress
node quickmindstore1/wordpress/tests/browser.cjs
```

See `ACCEPTANCE.md` for the distinction between automated fixtures and actual hosting acceptance.

References: https://developer.wordpress.org/reference/functions/wp_mail/ ; https://developer.wordpress.org/rest-api/extending-the-rest-api/adding-custom-endpoints/
