import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 2_500_000;
const USER_AGENT = "FitFoodFinder/1.0 (+https://fit-food-finder-zeta.vercel.app)";

export const config = { maxDuration: 30 };

function decodeHtml(value = "") {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function plainText(value = "") {
  return decodeHtml(value)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validEntry(name, price) {
  return name.length >= 2
    && name.length <= 140
    && price > 0
    && price < 500
    && !/subtotal|sales tax|delivery fee|service fee|gratuity|your order|checkout|gift card|offer details|promotion details/i.test(name);
}

export function extractPriceEntries(html, source) {
  const entries = [];
  const add = (rawName, rawPrice) => {
    const name = plainText(rawName).replace(/^price:\s*/i, "").trim();
    const price = Number(rawPrice);
    if (validEntry(name, price)) entries.push({ name, price, source });
  };

  for (const match of html.matchAll(/aria-label=["']([^"']{2,180}?),\s*\$\s*(\d{1,3}(?:\.\d{1,2})?)(?:,|["'])/gi)) add(match[1], match[2]);
  for (const match of html.matchAll(/<h[1-6]\b[^>]*>([\s\S]{2,240}?)<\/h[1-6]>[\s\S]{0,450}?\$\s*(\d{1,3}(?:\.\d{1,2})?)/gi)) add(match[1], match[2]);
  for (const match of html.matchAll(/"name"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"[\s\S]{0,700}?"price"\s*:\s*\{[^{}]{0,350}?"value"\s*:\s*(\d+(?:\.\d+)?)/g)) add(match[1].replace(/\\u0026/g, "&"), match[2]);

  for (const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const queue = [JSON.parse(decodeHtml(script[1]))];
      while (queue.length) {
        const value = queue.pop();
        if (Array.isArray(value)) queue.push(...value);
        else if (value && typeof value === "object") {
          const price = value.offers?.price ?? value.price;
          if (value.name && price != null) add(value.name, price);
          queue.push(...Object.values(value));
        }
      }
    } catch {
      // Invalid JSON-LD is ignored; the HTML extractors still run.
    }
  }

  return [...new Map(entries.map((entry) => [`${entry.name.toLowerCase()}|${entry.price.toFixed(2)}`, entry])).values()];
}

function isPrivateAddress(address) {
  if (address.startsWith("::ffff:")) return isPrivateAddress(address.slice(7));
  if (isIP(address) === 4) {
    const [first, second] = address.split(".").map(Number);
    return first === 0 || first === 10 || first === 127 || first === 169 && second === 254
      || first === 172 && second >= 16 && second <= 31 || first === 192 && second === 168;
  }
  const normalized = address.toLowerCase();
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc")
    || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized);
}

async function assertPublicUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Unsupported menu URL.");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Unsupported menu port.");
  if (isIP(url.hostname) || url.hostname === "localhost" || url.hostname.endsWith(".local")) throw new Error("Private menu host.");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("Private menu host.");
  return url;
}

async function fetchPage(value) {
  let url = await assertPublicUrl(value);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const result = await fetch(url, {
      redirect: "manual",
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(9000),
    });
    if (result.status >= 300 && result.status < 400 && result.headers.get("location")) {
      url = await assertPublicUrl(new URL(result.headers.get("location"), url).href);
      continue;
    }
    if (!result.ok) throw new Error(`Menu page returned ${result.status}.`);
    const type = result.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml\+xml/.test(type)) throw new Error("Menu page is not HTML.");
    const bytes = Buffer.from(await result.arrayBuffer());
    if (bytes.length > MAX_BYTES) throw new Error("Menu page is too large.");
    return { url: url.href, html: bytes.toString("utf8") };
  }
  throw new Error("Too many menu redirects.");
}

function siteKey(hostname) {
  return hostname.toLowerCase().split(".").slice(-2).join(".");
}

function menuLinks(html, pageUrl) {
  const base = new URL(pageUrl);
  const links = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const href = decodeHtml(match[1]).trim();
      const text = plainText(match[2]);
      const url = new URL(href, base);
      const hint = `${url.pathname} ${url.search} ${text}`;
      if (siteKey(url.hostname) !== siteKey(base.hostname) || !/menu|order|\/food(?:\/|\?|$)|category/i.test(hint)) continue;
      if (/cater|account|login|cart|gift|privacy|terms|locator|select-restaurant/i.test(hint)) continue;
      const score = (/[?&](?:store|restaurant|storeid)=/i.test(url.search) ? 8 : 0)
        + (/\/restaurant\/.+\/menu/i.test(url.pathname) ? 7 : 0)
        + (/\/category\//i.test(url.pathname) ? 6 : 0)
        + (/menu/i.test(hint) ? 3 : 0)
        + (/order/i.test(hint) ? 1 : 0);
      links.push({ url: url.href, score });
    } catch {
      // Malformed links are ignored.
    }
  }
  return [...new Map(links.sort((a, b) => b.score - a.score).map((link) => [link.url, link])).values()];
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method && request.method !== "GET") return response.status(405).json({ error: "Method not allowed." });
  const restaurant = String(request.query.restaurant || "").trim();
  const website = String(request.query.website || "").trim();
  if (!restaurant || restaurant.length > 100 || !website || website.length > 500) return response.status(400).json({ error: "Restaurant and website are required." });

  try {
    const pages = [await fetchPage(website)];
    const firstLinks = menuLinks(pages[0].html, pages[0].url).slice(0, 3);
    const firstPages = await Promise.allSettled(firstLinks.map((link) => fetchPage(link.url)));
    pages.push(...firstPages.filter((result) => result.status === "fulfilled").map((result) => result.value));

    let prices = pages.flatMap((page) => extractPriceEntries(page.html, page.url));
    if (prices.length < 20) {
      const seen = new Set(pages.map((page) => page.url));
      const secondLinks = pages.flatMap((page) => menuLinks(page.html, page.url))
        .filter((link) => !seen.has(link.url) && /\/category\//i.test(new URL(link.url).pathname))
        .slice(0, 2);
      const secondPages = await Promise.allSettled(secondLinks.map((link) => fetchPage(link.url)));
      pages.push(...secondPages.filter((result) => result.status === "fulfilled").map((result) => result.value));
      prices = pages.flatMap((page) => extractPriceEntries(page.html, page.url));
    }

    prices = [...new Map(prices.map((entry) => [`${entry.name.toLowerCase()}|${entry.price.toFixed(2)}`, entry])).values()].slice(0, 1000);
    response.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
    response.setHeader("Vercel-CDN-Cache-Control", "public, max-age=21600");
    return response.status(200).json({ prices });
  } catch {
    return response.status(200).json({ prices: [], unavailable: true });
  }
}
