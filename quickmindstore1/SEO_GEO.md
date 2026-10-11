# Store1 SEO / GEO release — 2026-10-11

Scope: owner-private QuickMind Store1, not the production WordPress website.

Build with `node scripts/build-store1.cjs` (Node.js, Python3 and lxml). It regenerates English, languages, Store1 presentation, then the SEO/GEO enrichment. Do not run only the older builders before publishing, because they overwrite enriched metadata. The hosting identity remains in the Sites source; it is excluded from GitHub exports.

Changes: runtime hreflang now uses the current origin rather than the old preview; actual-answer descriptions; complete social metadata; coherent Organization/WebSite/Breadcrumb/Product/Question/ScholarlyArticle graphs; product facts and context for translated answers; original-language research summaries; nonhero image lazy loading; launch-only sitemap excludes internal reviews, metrics and aliases.

No fabricated ratings, offers, product approval, medical review or treatment claims. Private access and noindex retained. Public launch needs a confirmed origin, hosting access/HTTP checks, index directives and public sitemap, Search Console/Bing setup and real analytics. The empty served sitemap is intentional for this private preview; `sitemap-launch.xml` is not yet published as an indexable live sitemap.

Validation: `node scripts/test-seo-geo.cjs`, the existing interaction/language/geolocation/currency checks, and `python3 scripts/audit-seo.py`. Browser visual QA, Core Web Vitals and actual indexing were not measured. Direct-answer content is a content quality improvement, not a guarantee of AI citations. No special AI file is required by Google.

Review: /pages/seo-geo-review/ ; per-page change inventory: seo-geo-changes.csv. Baseline 243 pages, 37 pages sharing a description; after 244 pages including this report, only 2 intentional alias pages share a description. 232 customer canonical routes in launch inventory.
