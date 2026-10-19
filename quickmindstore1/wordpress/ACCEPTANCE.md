# Acceptance record — 2026-10-19

No hosting panel URL, staging URL or host credentials were supplied in this task. No access to the user's WordPress host has been attempted. Production quickmindstore.com was not modified. Real orders remain disabled.

| Check | Evidence / status |
|---|---|
| Existing shared JS client success, failure, retained fields, retries, locale dictionary | Local Node DOM harness passed; not a real browser |
| Native WordPress PHP/MySQL and Playwright | Automated workflow added; consult actual PR checks for execution result |
| User staging plugin installation / schema creation | NOT VERIFIED |
| User staging all 8 languages × home/clinic/distributor writes | NOT VERIFIED |
| Actual Store1 layouts and form/browser integration on host | NOT VERIFIED |
| Host SMTP transport acceptance | NOT VERIFIED; CI uses pre_wp_mail mocks |
| Mail received in destination inbox/spam, SPF/DKIM | NOT VERIFIED |
| Host DB outage and timeout retries | NOT VERIFIED |
| Host admin authorization, CSV and deletion | NOT VERIFIED |
| Host cron, mail backlog and retention cleanup | NOT VERIFIED |

## Required host acceptance before release

1. Install ZIP on independent staging using README; confirm staging environment and HTTPS. Send one test inquiry per customer type and language; compare stored UTC, consent version, attribution, UTM and customer/language counts. Use synthetic contacts.
2. Reload/retry after an interrupted response: same reference, one record. Edit entries: new reference. Submit honeypot, missing consent, malformed fields, excessive body and bursts: rejects. Test an actual database write failure on isolated staging and confirm frontend never displays receipt.
3. Open all existing forms on desktop/mobile and localized pages, including modal forms. Interrupt network, restore, retry; input retained, no duplicate; check source page, CTA and campaign match. Current CI uses a synthetic form, not a complete deployed Store1 visual review.
4. Log out and test exports/actions are denied; test subscriber is denied; admin without valid nonce is denied. Export CSV and open spreadsheet safely; exercise delete and WordPress verified privacy requests.
5. Observe pending → mail_accepted with configured WordPress mail transport, then independently verify mailbox receipt and headers. Simulate failure and manual/cron retry; verify stored lead remains intact. A success API response alone is insufficient.
6. Execute cron and shorten retention using aged synthetic records. Verify expiry and deletion of data; establish backup/CSV/mailbox retention with the host operator.
7. Capture screenshots, DB record counts, request IDs and sanitized transport logs; update this record and PR. Remove all test PII. Keep draft until completed.
