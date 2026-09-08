import { commonRestaurants } from "../data.js";
import { fatSecretMenu } from "./nutrition.js";

export const config = { maxDuration: 120 };

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method && request.method !== "GET") return response.status(405).json({ error: "Method not allowed." });

  const consumerKey = process.env.FATSECRET_CONSUMER_KEY;
  const consumerSecret = process.env.FATSECRET_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) {
    return response.status(200).json({ providerConfigured: false, meals: [] });
  }

  const searchDelayMs = Number(process.env.FATSECRET_SEARCH_DELAY_MS ?? 1250);
  const menus = [];
  for (let index = 0; index < commonRestaurants.length; index += 1) {
    const restaurant = commonRestaurants[index];
    try {
      menus.push(await fatSecretMenu(restaurant, consumerKey, consumerSecret));
    } catch (error) {
      if (error.providerCode === 12) {
        return response.status(429).json({ error: "The common menu catalog is temporarily rate limited.", code: "provider_rate_limited" });
      }
      menus.push({ restaurant, candidates: 0, matches: 0, meals: [], error: error.message });
    }
    if (index < commonRestaurants.length - 1 && searchDelayMs > 0) await wait(searchDelayMs);
  }

  const meals = [...new Map(menus.flatMap((menu) => menu.meals).map((meal) => [meal.id, meal])).values()];
  const lookups = menus.map(({ restaurant, candidates, matches, error }) => ({ restaurant, candidates, matches, ...(error ? { error } : {}) }));
  response.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
  response.setHeader("Vercel-CDN-Cache-Control", "public, max-age=82800");
  return response.status(200).json({ providerConfigured: true, generatedAt: new Date().toISOString(), meals, lookups });
}
