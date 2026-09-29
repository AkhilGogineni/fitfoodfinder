import { commonRestaurants } from "../data.js";
import { fatSecretMenu, mapWithConcurrency, providerConcurrency } from "./nutrition.js";

export const config = { maxDuration: 60 };

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method && request.method !== "GET") return response.status(405).json({ error: "Method not allowed." });

  const consumerKey = process.env.FATSECRET_CONSUMER_KEY;
  const consumerSecret = process.env.FATSECRET_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) {
    return response.status(200).json({ providerConfigured: false, meals: [] });
  }

  const results = await mapWithConcurrency(commonRestaurants, providerConcurrency(), (restaurant) =>
    fatSecretMenu(restaurant, consumerKey, consumerSecret));
  if (results.some((result) => result?.reason?.providerCode === 12)) {
    return response.status(429).json({ error: "The common menu catalog is temporarily rate limited.", code: "provider_rate_limited" });
  }
  const menus = results.map((result, index) => result?.status === "fulfilled"
    ? result.value
    : { restaurant: commonRestaurants[index], candidates: 0, matches: 0, meals: [], error: result?.reason?.message || "Lookup failed" });

  const meals = [...new Map(menus.flatMap((menu) => menu.meals).map((meal) => [meal.id, meal])).values()];
  const lookups = menus.map(({ restaurant, candidates, matches, error }) => ({ restaurant, candidates, matches, ...(error ? { error } : {}) }));
  response.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
  // Serve the previous catalog while a refresh runs; 22h fresh + 2h stale stays within FatSecret's 24h storage limit.
  response.setHeader("Vercel-CDN-Cache-Control", "public, max-age=79200, stale-while-revalidate=7200");
  return response.status(200).json({ providerConfigured: true, generatedAt: new Date().toISOString(), meals, lookups });
}
