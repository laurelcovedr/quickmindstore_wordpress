# QuickMind Store1

Independent Withings-inspired comparison edition. This is the Sites static source, not a production WordPress/WooCommerce backup or an installable WordPress theme.

Private preview: https://quickmind-store1.lawrence-wan-0405.chatgpt.site
Chinese preview: https://quickmind-store1.lawrence-wan-0405.chatgpt.site/zh-CN/
Design comparison: https://quickmind-store1.lawrence-wan-0405.chatgpt.site/pages/design-review/

## Local preview
Run from this directory:
```
python3 -m http.server 8080 --directory dist
```
Then open http://localhost:8080/. Root-relative assets require an HTTP server.

## Source map
- dist/: complete served website, 243 HTML pages, images and referenced PDFs.
- dist/store1-content.js and dist/store1.css: Store1 home content and design.
- dist/app.js: English routes, forms and interactions.
- locales/: translated copy and FX reference data.
- scripts/: builders, audits and regression checks.
- commerce/: discount, attribution and invoice design specifications.
- shopify-theme/, shopify-handoff/, build-theme.cjs: inherited legacy scaffold; not deployed by Store1.

## Rebuild (Node.js, Python3 + lxml)
```
node scripts/build-store1.cjs
```
For another host update seo-config.json and dist/seo.js. Hosting identity and credentials are excluded; importing this directory does not deploy or replace any website.

## Checks
```
node scripts/test-seo-geo.cjs
node scripts/test-interactions.cjs
node scripts/test-languages.cjs
node scripts/test-geolocation.cjs
node scripts/test-currency.cjs
node scripts/test-attribution.cjs
node scripts/test-commerce.cjs
python3 scripts/audit-seo.py
```
Static and mocked checks do not validate real payment or browser layout.

## Current boundaries
Eight languages; IP-based defaults with manual overrides; indicative local-currency display. Existing PayPal hosted button settles USD. No automatic order synchronization, recurring billing, invoice emails or dealer settlement. Enquiry forms prepare email drafts. Coupon/dealer/invoice functionality remains a design demonstration. Proposed prices and terms require written confirmation.

Contains no customer database, WordPress server backup, Git credentials or payment secrets. Existing merchant contact details and PayPal public SDK client ID are retained.

SEO / GEO release: see SEO_GEO.md and /pages/seo-geo-review/. This release remains private and noindex; public indexing and live AI citations have not been measured.
