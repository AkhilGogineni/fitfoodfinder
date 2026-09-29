# Nutrition Pipeline

## Goal

Turn restaurant names discovered near the user into sourced menu items without maintaining one scraper per restaurant.

## Implemented flow

1. `/api/nearby` discovers named restaurants and cafes from OpenStreetMap.
2. `nearby.js` normalizes known chains and preserves every independent restaurant or cafe name.
3. `/api/catalog` refreshes 33 common US chains once daily, searches them six at a time, and caches the combined response at Vercel's edge for 22 hours, serving that copy for up to 2 more hours while a refresh runs.
4. The browser downloads that single shared catalog and immediately keeps meals whose restaurant was found nearby.
5. Every restaurant without a catalog match is then looked up automatically through `/api/nutrition` in batches of up to 30, which the server searches six at a time. Only nearby chains hold the progress overlay; independent restaurants fill in afterwards in the background. FatSecret throttles bursts of roughly 100 searches per minute (error 12), so the background pass waits out a throttle while the overlay never does. A reload during the background pass resumes it from the browser cache.
6. Restaurants without any provider match remain visible and unranked. Manual lookup also remains available.
7. For every matched result whose nearby venue has an official website, `/api/prices` visits the location page and a small set of same-site menu/order links.
8. The price extractor reads structured data and accessible menu-card labels, then attaches a price only when the live nutrition item strongly matches one menu item. Ambiguous sizes and conflicting ingredients stay unpriced.

Users can also enter a restaurant name and select **Fetch menu** to run the same lookup without sharing location.

## Provider setup

For local use, copy `.env.example` to the ignored `.env.local` file and set:

- `FATSECRET_CONSUMER_KEY`
- `FATSECRET_CONSUMER_SECRET`

Run `npm start` and open <http://localhost:4173>. Never expose credential values in client-side JavaScript or commit them to the repository. The server signs each FatSecret request with OAuth 1.0 HMAC-SHA1, avoiding a dependency on Vercel's changing egress IP.

Provider documentation:

- Authentication: <https://platform.fatsecret.com/docs/guides/authentication/oauth2>
- Food search: <https://platform.fatsecret.com/docs/v1/foods.search>
- Platform coverage: <https://platform.fatsecret.com/platform-api>

## Source policy

- Calories and protein are required before an item can enter ranking.
- Provider results are labeled **Verified database**.
- The client ships with zero meal records. Every displayed meal comes from the current provider-backed catalog, an automatic lookup for an uncovered nearby restaurant, or an explicit manual lookup.
- The common catalog is cached at Vercel's edge for 22 hours plus up to 2 hours of stale-while-revalidate, and refreshed by a once-daily Vercel Cron job, within FatSecret's 24-hour content-storage limit.
- Matched prices link to the exact menu page that supplied them. Unknown or ambiguous prices display as an em dash and do not participate in price sorting.
- Successful price lookups are cached at Vercel's edge for six hours. The endpoint validates every URL and redirect and blocks private network addresses before fetching.
- A completed nearby scan is cached in the browser for six hours. A reload restores the venue, nutrition, and price data without calling any API again.

## Price scraping

`/api/prices` is a generic official-menu crawler rather than a restaurant-specific price table. It supports server-rendered HTML, JSON-LD offers, accessible menu labels, and embedded name/price objects. It follows up to three high-confidence menu links on the same site and two category links when needed. The current Oxford acceptance fixture extracts 158 Taco Bell prices and 161 Subway size/form price records.

The matcher requires at least 75% normalized name overlap, rejects conflicting protein ingredients, selects the low or high price only when the nutrition name explicitly identifies a small/6-inch or large/footlong size, and refuses other price ambiguity.

Restaurants that hide prices behind a mobile app or private ordering API remain unpriced. This is represented honestly in the UI instead of substituting a national average or venue-level price range.

## Nutrition scraping fallback

Do not begin with arbitrary search-result scraping. Add it only for provider misses, in this order:

1. Use the restaurant website from OSM when present; otherwise use a licensed search API.
2. Accept only same-brand official domains.
3. Locate nutrition/menu links and record the source URL plus retrieval date.
4. Route HTML, PDF, and calculator-backed pages through separate extractors.
5. Require an item name, calories, protein, serving description, and source before publishing.
6. Quarantine ambiguous extraction results for review instead of showing them.
7. Schedule freshness checks and retire disappeared menu items.

This nutrition fallback needs a search provider, PDF extraction, structured validation, and persistent storage. It should be implemented after live provider coverage is measured, not as a replacement for the provider.

## Verification

- `npm run check`
- Search a configured restaurant and confirm new items appear with **Verified database** badges.
- Run nearby discovery and confirm every uncovered venue moves through **Checking menu…** to **Nutrition found** or **No menu match**.
- Confirm a matched live item shows a numeric **$/protein** value and an **Open price source** link.
- Confirm browser credentials, provider tokens, and secret values never appear in requests or console output.
