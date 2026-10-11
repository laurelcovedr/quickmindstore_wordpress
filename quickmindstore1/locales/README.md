# QuickMind language editions

English remains at the existing root URLs. Seven localized editions use `/zh-CN/`, `/es/`, `/fr/`, `/de/`, `/ja/`, `/ko/` and `/id/`.

Rebuild after changes to English templates or translations:

```
node scripts/build-seo.cjs
node scripts/build-languages.cjs
```

The language generator creates matching canonical routes, reciprocal hreflang links and eight-option selectors. PDF sources and scientific article titles stay in their original language. Product software languages require separate confirmation. The USD base prices and PayPal checkout currency remain shared. Local price displays use the language-to-currency mapping and dated ECB reference snapshot in exchange-rates.json. currency-prices.cjs rounds rental and annual amounts to currency precision and sums those rounded components for the first-year display. PayPal hosted-button identity, contact address and private noindex access remain shared.

Verify with `node scripts/test-languages.cjs` and `python scripts/audit-seo.py`. Generated language HTML is deployable without JavaScript; enquiry submission needs JavaScript and creates an email draft, not a sent lead. The existing tracking script carries source and campaign data into the draft and stores anonymous measurements only in the visitor's browser.

## IP-based defaults and manual preferences

The client queries `https://ipapi.co/json/` once per browser tab per day for IP country defaults. Only country and cache expiry are retained in session storage, not the IP address or other response fields. The request has a three-second timeout, sends no credentials/referrer, and failures retain a usable browser-language/current-page fallback. The external service can be unavailable or rate-limited; production volume may require its own account or a future same-origin server endpoint.

Country maps select language and currency independently, e.g. Singapore English/SGD and Mexico Spanish/MXN. The supported FX snapshot has 24 currencies; unsupported currencies use USD. Geo defaults never determine actual shipping destination, regulatory eligibility or payable amount. PayPal summary and checkout remain USD.

Explicit language URLs stay in that language. Manual language and currency overrides are saved in `qm-preferences-v1` and take priority over IP defaults. Changing currency never switches language. Auto language navigation preserves route, UTM and hash and will not interrupt a visitor who has started interacting with the page. Prices are re-rendered from canonical USD amounts, rather than repeatedly converting already converted text.

Build locale runtime data after changing rates: `node scripts/build-locale-data.cjs`. Then use the ordinary SEO/language builds. Validate with `node scripts/test-geolocation.cjs`. Browser QA and live visitor-IP behavior still need a supported browser environment.
