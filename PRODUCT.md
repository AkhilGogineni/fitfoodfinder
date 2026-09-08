# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated: static HTML, CSS, and JavaScript with no runtime dependencies. This keeps the greenfield MVP portable and makes the nutrition-matching logic independently testable.

## Users

College students who are trying to lose weight but still eat at restaurants because of time, cravings, or social plans.

## Product Purpose

Help a user quickly find restaurant meals that fit a remaining calorie and protein target, with full macro and available local-price visibility.

Success means a user can enter calories and/or protein, compare ranked options, and understand why each option fits.

## Positioning

The product ranks restaurant meals by how well they close a specific calorie-and-protein gap, instead of treating “healthy” as a generic category.

## Operating Context

- Used on a phone while deciding where to eat, often with limited attention.
- Also useful on desktop for planning a meal before going out.
- Nearby discovery lists every named restaurant and cafe returned by the map lookup. Meal ranking starts with nearby matches from the daily-refreshed common-chain catalog, then adds matches from automatic lookups for every uncovered restaurant.

## Capabilities and Constraints

- Accept a calorie target, a protein target, or both.
- Rank meals around a target of roughly 10 calories per gram of protein, treat lower ratios as equally strong, and let the strong-ratio filter include meals up to 15 calories per protein gram.
- Show calories, protein, carbohydrates, fat, price per gram of protein, and target fit.
- Search by restaurant, meal, or cuisine; filter the catalog by cuisine.
- After a nearby scan, switch between matched nearby meals and any manually loaded meals without losing the nearby directory.
- Load common-chain meals from the shared 23-hour edge catalog, automatically check every uncovered nearby restaurant, and retain manual search. Every ranked meal requires sourced calories and protein.
- Cache completed nearby scans in the browser so reloads do not repeat the full lookup.

## Evidence on Hand

- The initial user brief defines the audience, meal-fit inputs, macro fields, and preferred protein-to-calorie ratio.
- Each live meal links to its provider nutrition record, and matched prices link to the restaurant menu page that supplied them.
- No logo, brand assets, production restaurant database, or user accounts were supplied.

## Product Principles

- Start with the user’s remaining macros, not a generic health score.
- Make tradeoffs legible in seconds.
- Be explicit about data freshness and variation.
- Never block the core matcher on location access.

## Accessibility & Inclusion

Keyboard navigation, visible focus, semantic controls, reduced-motion support, readable contrast, and responsive layouts are required.
