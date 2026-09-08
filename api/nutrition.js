import { createHmac, randomBytes } from "node:crypto";

const SERVER_URL = "https://platform.fatsecret.com/rest/server.api";

export const config = { maxDuration: 30 };

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function valueFrom(description, label) {
  const match = description.match(new RegExp(`${label}:\\s*([\\d.]+)`, "i"));
  return match ? Number(match[1]) : null;
}

export function parseFoodDescription(description = "") {
  return {
    calories: valueFrom(description, "Calories"),
    protein: valueFrom(description, "Protein"),
    carbs: valueFrom(description, "Carbs"),
    fat: valueFrom(description, "Fat"),
  };
}

function normalize(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sameBrand(left, right) {
  const leftKey = normalize(left);
  const rightKey = normalize(right);
  return Boolean(leftKey && rightKey && (leftKey.includes(rightKey) || rightKey.includes(leftKey)));
}

function percentEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function signedSearchUrl(restaurant, consumerKey, consumerSecret, { timestamp = Math.floor(Date.now() / 1000), nonce = randomBytes(16).toString("hex") } = {}) {
  const parameters = {
    format: "json",
    max_results: "50",
    method: "foods.search",
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(timestamp),
    oauth_version: "1.0",
    page_number: "0",
    search_expression: restaurant,
  };
  const normalized = Object.entries(parameters)
    .map(([key, value]) => [percentEncode(key), percentEncode(value)])
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const signatureBase = `GET&${percentEncode(SERVER_URL)}&${percentEncode(normalized)}`;
  parameters.oauth_signature = createHmac("sha1", `${percentEncode(consumerSecret)}&`).update(signatureBase).digest("base64");
  return `${SERVER_URL}?${new URLSearchParams(parameters)}`;
}

async function providerJson(result, operation) {
  let data;
  try {
    data = await result.json();
  } catch {
    data = {};
  }

  const providerError = data.error;
  if (!result.ok || providerError) {
    const message = typeof providerError === "object"
      ? providerError.message
      : data.error_description || providerError;
    const error = new Error(message || `FatSecret ${operation} returned ${result.status}`);
    error.providerCode = Number(typeof providerError === "object" ? providerError.code : null) || null;
    if (error.providerCode === null && /invalid ip address/i.test(error.message)) error.providerCode = 21;
    throw error;
  }
  return data;
}

export function mealsFromFatSecret(restaurant, data) {
  const found = data.foods?.food ?? [];
  const foods = Array.isArray(found) ? found : [found];

  const meals = foods.flatMap((food) => {
    if (!sameBrand(food.brand_name, restaurant)) return [];
    const macros = parseFoodDescription(food.food_description);
    if (!(macros.calories > 0) || !(macros.protein > 0) || !Number.isFinite(macros.carbs) || !Number.isFinite(macros.fat)) return [];
    return [{
      id: `fatsecret-${food.food_id}`,
      restaurant,
      name: food.food_name,
      ...macros,
      price: null,
      source: food.food_url || "https://platform.fatsecret.com/platform-api",
    }];
  });

  return { foods, meals };
}

export async function fatSecretMenu(restaurant, consumerKey, consumerSecret) {
  const result = await fetch(signedSearchUrl(restaurant, consumerKey, consumerSecret), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  const data = await providerJson(result, "search");
  const { foods, meals } = mealsFromFatSecret(restaurant, data);

  return {
    restaurant,
    candidates: foods.length,
    matches: meals.length,
    meals,
  };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method && request.method !== "GET") return response.status(405).json({ error: "Method not allowed." });

  const restaurants = String(request.query.restaurants || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (!restaurants.length || restaurants.some((name) => name.length > 80)) {
    return response.status(400).json({ error: "One to six restaurant names are required." });
  }

  try {
    const consumerKey = process.env.FATSECRET_CONSUMER_KEY;
    const consumerSecret = process.env.FATSECRET_CONSUMER_SECRET;
    if (!consumerKey || !consumerSecret) {
      return response.status(200).json({ providerConfigured: false, meals: [], searched: restaurants });
    }
    const searchDelayMs = Number(process.env.FATSECRET_SEARCH_DELAY_MS ?? 1250);
    const menus = [];
    for (const restaurant of restaurants) {
      try {
        menus.push({ status: "fulfilled", value: await fatSecretMenu(restaurant, consumerKey, consumerSecret) });
      } catch (reason) {
        menus.push({ status: "rejected", reason });
        if (reason.providerCode === 12) break;
      }
      if (restaurants.length > 1 && searchDelayMs > 0) await wait(searchDelayMs);
    }
    const fulfilled = menus.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const failed = menus.filter((result) => result.status === "rejected");
    const rateLimited = failed.find((result) => result.reason?.providerCode === 12);
    if (rateLimited) throw rateLimited.reason;
    if (!fulfilled.length && failed.length) throw failed[0].reason;
    const meals = [...new Map(fulfilled.flatMap((result) => result.meals).map((meal) => [meal.id, meal])).values()];
    const lookups = menus.map((result, index) => result.status === "fulfilled"
      ? { restaurant: result.value.restaurant, candidates: result.value.candidates, matches: result.value.matches }
      : { restaurant: restaurants[index], candidates: 0, matches: 0, error: result.reason?.message || "Lookup failed" });
    response.setHeader("Cache-Control", "public, max-age=60, must-revalidate");
    response.setHeader("Vercel-CDN-Cache-Control", "public, max-age=82800");
    return response.status(200).json({ providerConfigured: true, provider: "FatSecret", meals, searched: restaurants, lookups });
  } catch (error) {
    if (error.providerCode === 12) {
      return response.status(429).json({
        error: "FatSecret is temporarily rate limiting menu searches.",
        code: "provider_rate_limited",
      });
    }
    if (error.providerCode === 21) {
      return response.status(503).json({
        error: "FatSecret rejected this server's outbound IP address.",
        code: "provider_ip_restricted",
      });
    }
    return response.status(502).json({ error: "Nutrition provider request failed." });
  }
}
