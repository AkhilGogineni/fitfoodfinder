import assert from "node:assert/strict";
import { brandAliases, commonRestaurants } from "./data.js";
import { fitLabel, formatMoney, hasStrongProteinRatio, pricePerProtein, proteinRatio, rankMeals, scoreMeal } from "./matcher.js";
import { mapNearbyRestaurants } from "./nearby.js";
import catalogHandler from "./api/catalog.js";
import nutritionHandler, { MAX_RESTAURANTS_PER_REQUEST, mapWithConcurrency, mealsFromFatSecret, parseFoodDescription, sameBrand, signedSearchUrl } from "./api/nutrition.js";
import { extractPriceEntries } from "./api/prices.js";
import { matchMenuPrice } from "./prices.js";

assert.equal(brandAliases["taco bell"], "Taco Bell");
assert.ok(commonRestaurants.includes("McDonald's"));
assert.ok(commonRestaurants.includes("Taco Bell"));
assert.equal(commonRestaurants.length, new Set(commonRestaurants).size);

const grilled = {
  id: "fixture-grilled",
  restaurant: "Fixture Chicken",
  name: "8 ct Grilled Nuggets",
  cuisine: "Chicken",
  calories: 130,
  protein: 25,
  carbs: 1,
  fat: 3,
  price: 6.19,
  source: "https://restaurant.example/grilled",
};
const fixtureMeals = [
  grilled,
  { ...grilled, id: "fixture-olive-1", restaurant: "Olive Garden", name: "Grilled Chicken", cuisine: "Italian", calories: 650, protein: 65 },
  { ...grilled, id: "fixture-olive-2", restaurant: "Olive Garden", name: "Grilled Salmon", cuisine: "Italian", calories: 610, protein: 45 },
  { ...grilled, id: "fixture-taco", restaurant: "Taco Bell", name: "Chicken Bowl", cuisine: "Mexican", calories: 520, protein: 40 },
];

assert.equal(proteinRatio(grilled), 5.2);
assert.equal(Number(pricePerProtein(grilled).toFixed(3)), 0.248);

const ranked = rankMeals(fixtureMeals, { calorieTarget: 650, proteinTarget: 50 });
assert.equal(ranked.length, fixtureMeals.length);
assert.ok(ranked[0].fit >= ranked[1].fit, "results should be sorted by fit");
assert.ok(scoreMeal({ calories: 500, protein: 50 }, 500, 50) > scoreMeal({ calories: 900, protein: 30 }, 500, 50));
assert.equal(hasStrongProteinRatio({ calories: 600, protein: 45 }), true, "near-target ratios should pass");
assert.equal(hasStrongProteinRatio({ calories: 800, protein: 100 }), true, "8 cal/g should remain included");
assert.equal(hasStrongProteinRatio({ calories: 700, protein: 100 }), true, "7 cal/g should remain included");
assert.equal(hasStrongProteinRatio({ calories: 600, protein: 30 }), false, "20 cal/g should be filtered out");
assert.equal(hasStrongProteinRatio({ calories: 1000, protein: 60 }), false, "16.7 cal/g should be filtered out");
assert.ok(scoreMeal({ calories: 250, protein: 50 }, 0, 0) >= scoreMeal({ calories: 500, protein: 50 }, 0, 0), "ratios below 10 cal/g should not be penalized");

const filtered = rankMeals(fixtureMeals, { query: "olive garden", strongRatioOnly: true });
assert.equal(filtered.length, 2);
assert.equal(filtered[0].restaurant, "Olive Garden");
assert.ok(rankMeals(fixtureMeals, { cuisine: "Italian" }).every((meal) => meal.restaurant === "Olive Garden"));
assert.ok(rankMeals(fixtureMeals, { query: "mexican" }).every((meal) => meal.cuisine === "Mexican"));
assert.ok(fixtureMeals.every((meal) => meal.calories > 0 && meal.protein > 0 && meal.source.startsWith("https://")));
assert.equal(rankMeals(fixtureMeals, { nearbyBrands: new Set() }).length, 0, "nearby mode must not fall back to unrelated restaurants");

const nearby = mapNearbyRestaurants(
  [
    { tags: { name: "Olive Garden", amenity: "restaurant" } },
    { tags: { name: "College Corner Cafe", amenity: "cafe" } },
    { tags: { name: "College Corner Cafe", amenity: "cafe" } },
  ],
  { "olive garden": "Olive Garden" },
  new Set(["Olive Garden"]),
);
assert.deepEqual(nearby, [
  { name: "College Corner Cafe", restaurant: "College Corner Cafe", website: null, isChain: false, nutritionStatus: "pending", hasNutrition: false, kind: "Cafe" },
  { name: "Olive Garden", restaurant: "Olive Garden", website: null, isChain: true, nutritionStatus: "found", hasNutrition: true, kind: "Restaurant" },
]);
const discoveredChain = mapNearbyRestaurants(
  [{ tags: { name: "Arby's", brand: "Arby's", amenity: "fast_food" } }],
  { "arby's": "Arby's" },
  new Set(),
);
assert.equal(discoveredChain[0].nutritionStatus, "pending");
assert.equal(discoveredChain[0].website, null);
assert.deepEqual(parseFoodDescription("Per 1 serving - Calories: 510kcal | Fat: 18g | Carbs: 52g | Protein: 42g"), {
  calories: 510,
  protein: 42,
  carbs: 52,
  fat: 18,
});
const liveResult = mealsFromFatSecret("Chipotle", {
  foods: {
    food: [
      {
        food_id: "123",
        food_name: "Chicken Burrito Bowl",
        brand_name: "Chipotle Mexican Grill",
        food_url: "https://foods.fatsecret.com/calories-nutrition/chipotle/chicken-burrito-bowl",
        food_description: "Per 1 bowl - Calories: 620kcal | Fat: 19g | Carbs: 65g | Protein: 48g",
      },
      {
        food_id: "456",
        food_name: "Unrelated Bowl",
        brand_name: "Another Restaurant",
        food_description: "Per 1 bowl - Calories: 400kcal | Fat: 10g | Carbs: 30g | Protein: 30g",
      },
    ],
  },
});
assert.equal(liveResult.foods.length, 2);
assert.deepEqual(liveResult.meals, [{
  id: "fatsecret-123",
  restaurant: "Chipotle",
  name: "Chicken Burrito Bowl",
  calories: 620,
  protein: 48,
  carbs: 65,
  fat: 19,
  price: null,
  source: "https://foods.fatsecret.com/calories-nutrition/chipotle/chicken-burrito-bowl",
}]);
const signedUrl = new URL(signedSearchUrl("Chipotle", "consumer-key", "consumer-secret", { timestamp: 1700000000, nonce: "fixed-nonce" }));
assert.equal(`${signedUrl.origin}${signedUrl.pathname}`, "https://platform.fatsecret.com/rest/server.api");
assert.equal(signedUrl.searchParams.get("method"), "foods.search");
assert.equal(signedUrl.searchParams.get("search_expression"), "Chipotle");
assert.equal(signedUrl.searchParams.get("oauth_signature_method"), "HMAC-SHA1");
assert.equal(signedUrl.searchParams.get("oauth_signature"), "4hzN68+AqepeK0UiIthdUGWwI+o=");

const originalFetch = global.fetch;
const originalConsumerKey = process.env.FATSECRET_CONSUMER_KEY;
const originalConsumerSecret = process.env.FATSECRET_CONSUMER_SECRET;
const originalSearchDelay = process.env.FATSECRET_SEARCH_DELAY_MS;
let activeProviderRequests = 0;
let maximumProviderRequests = 0;
global.fetch = async () => {
  activeProviderRequests += 1;
  maximumProviderRequests = Math.max(maximumProviderRequests, activeProviderRequests);
  await new Promise((resolve) => setTimeout(resolve, 5));
  activeProviderRequests -= 1;
  return new Response(JSON.stringify({ foods: { food: [] } }), { status: 200 });
};
process.env.FATSECRET_CONSUMER_KEY = "test-key";
process.env.FATSECRET_CONSUMER_SECRET = "test-secret";
process.env.FATSECRET_SEARCH_DELAY_MS = "0";
let handlerStatus;
let handlerBody;
await nutritionHandler(
  { method: "GET", query: { restaurants: "One,Two,Three" } },
  {
    setHeader() {},
    status(value) {
      handlerStatus = value;
      return this;
    },
    json(value) {
      handlerBody = value;
      return value;
    },
  },
);
const nutritionConcurrency = maximumProviderRequests;
maximumProviderRequests = 0;
let catalogStatus;
let catalogBody;
const catalogHeaders = {};
await catalogHandler(
  { method: "GET", query: {} },
  {
    setHeader(name, value) {
      catalogHeaders[name] = value;
    },
    status(value) {
      catalogStatus = value;
      return this;
    },
    json(value) {
      catalogBody = value;
      return value;
    },
  },
);
global.fetch = originalFetch;
if (originalConsumerKey === undefined) delete process.env.FATSECRET_CONSUMER_KEY;
else process.env.FATSECRET_CONSUMER_KEY = originalConsumerKey;
if (originalConsumerSecret === undefined) delete process.env.FATSECRET_CONSUMER_SECRET;
else process.env.FATSECRET_CONSUMER_SECRET = originalConsumerSecret;
if (originalSearchDelay === undefined) delete process.env.FATSECRET_SEARCH_DELAY_MS;
else process.env.FATSECRET_SEARCH_DELAY_MS = originalSearchDelay;
assert.equal(handlerStatus, 200);
assert.deepEqual(handlerBody.searched, ["One", "Two", "Three"]);
assert.equal(catalogStatus, 200);
assert.equal(catalogBody.lookups.length, commonRestaurants.length);
assert.equal(catalogHeaders["Vercel-CDN-Cache-Control"], "public, max-age=79200, stale-while-revalidate=7200",
  "an expired catalog must be served while it refreshes, and never beyond FatSecret's 24-hour storage limit");
const catalogConcurrency = maximumProviderRequests;
assert.ok(nutritionConcurrency > 1, "nutrition lookups must overlap instead of sleeping between every restaurant");
assert.ok(nutritionConcurrency <= 6, "nutrition lookups must stay within the concurrency bound");
assert.ok(catalogConcurrency > 1, "catalog lookups must overlap instead of sleeping between every restaurant");
assert.ok(catalogConcurrency <= 6, "catalog lookups must stay within the concurrency bound");

// A provider rate-limit (error 12) must stop the remaining lookups rather than hammering the API.
let attempted = 0;
const rateLimitedResults = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 2, async (item) => {
  attempted += 1;
  if (item === 1) {
    const error = new Error("Too many actions");
    error.providerCode = 12;
    throw error;
  }
  return item;
});
assert.ok(attempted < 8, "a rate-limit response must stop further provider calls");
assert.equal(rateLimitedResults[0].reason.providerCode, 12);
assert.deepEqual(await mapWithConcurrency([1, 2, 3], 2, async (n) => n * 2), [
  { status: "fulfilled", value: 2 },
  { status: "fulfilled", value: 4 },
  { status: "fulfilled", value: 6 },
], "results must stay in input order regardless of completion order");

// Real chains extend their own brand name; unrelated packaged-goods brands must not match.
assert.equal(sameBrand("Chipotle Mexican Grill", "Chipotle"), true);
assert.equal(sameBrand("Domino's Pizza", "Domino's"), true);
assert.equal(sameBrand("Dunkin' Donuts", "Dunkin'"), true);
assert.equal(sameBrand("Popeyes Chicken & Biscuits", "Popeyes"), true);
assert.equal(sameBrand("Blue Ribbon", "Blue Ribbon Sushi Bar & Grill"), true);
assert.equal(sameBrand("Shake Shack", "Shake Shack"), true);
assert.equal(sameBrand("Aurora Natural", "Aurora"), false, "packaged-goods brands must not be served as a restaurant menu");
assert.equal(sameBrand("Smart Pressed Juice", "Pressed"), false, "an unrelated brand must not match on a shared word");
assert.equal(sameBrand("Alice's Caribbean Kitchen", "Alice"), false);
assert.equal(sameBrand("Maria", "Anna Maria"), false);
assert.equal(mealsFromFatSecret("Aurora", { foods: { food: [{
  brand_name: "Aurora Natural",
  food_id: "81587",
  food_name: "Organic Raw Walnuts",
  food_description: "Per 1/4 cup - Calories: 200kcal | Fat: 20.00g | Carbs: 4.00g | Protein: 5.00g",
}] } }).meals.length, 0, "grocery items must not appear as a nearby restaurant's menu");
assert.ok(MAX_RESTAURANTS_PER_REQUEST >= 25, "batches must be large enough to keep round trips low");

const scrapedPrices = extractPriceEntries(`
  <div aria-label="Rotisserie-Style Chicken, $8.49, 310 calories"></div>
  <h4>Cheesy Bean and Rice Burrito</h4><p><span>$1.49</span> | 400 Cal</p>
  <div aria-label="Your Order, $0.00"></div>
`, "https://restaurant.example/menu");
assert.deepEqual(scrapedPrices, [
  { name: "Rotisserie-Style Chicken", price: 8.49, source: "https://restaurant.example/menu" },
  { name: "Cheesy Bean and Rice Burrito", price: 1.49, source: "https://restaurant.example/menu" },
]);
assert.equal(matchMenuPrice("6-inch Rotisserie-Style Chicken", scrapedPrices).price, 8.49);
const sizedPrices = [
  { name: "Steak Philly", price: 7.79, source: "https://restaurant.example/menu" },
  { name: "Steak Philly", price: 11.99, source: "https://restaurant.example/menu" },
];
assert.equal(matchMenuPrice("6-inch Steak Philly", sizedPrices).price, 7.79);
assert.equal(matchMenuPrice("Footlong Steak Philly", sizedPrices).price, 11.99);
assert.equal(matchMenuPrice("Steak Philly", sizedPrices), null, "ambiguous sizes must stay unpriced");
assert.equal(matchMenuPrice("6-inch Oven Roasted Turkey and Ham", [{ name: "Oven-Roasted Turkey", price: 4.99, source: "https://restaurant.example/menu" }]), null, "different ingredients must not inherit another item's price");
assert.equal(matchMenuPrice("Bean Burrito", scrapedPrices), null, "partial names must not receive a different item's price");
assert.equal(formatMoney(null), "—");
assert.equal(fitLabel(49), "Misses target");
assert.equal(fitLabel(90), "Nailed it");

console.log("✓ production catalog is live-only");
console.log("✓ ranking, filtering, ratio, and price math passed");
