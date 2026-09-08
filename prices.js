function words(value = "") {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b\d+[-\s]*(?:inch|in|ct|count|piece|pc)s?\b/g, " ")
    .replace(/\b(?:footlong|small|large|half|full)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word && !["the", "a", "an", "and"].includes(word));
}

const DISTINGUISHING_INGREDIENTS = new Set([
  "avocado", "bacon", "beef", "cheese", "chicken", "egg", "ham", "pork", "salmon", "shrimp", "steak", "tuna", "turkey",
]);

function matchScore(left, right) {
  const leftWords = words(left);
  const rightWords = words(right);
  if (!leftWords.length || !rightWords.length) return 0;
  if (leftWords.join(" ") === rightWords.join(" ")) return 1;
  const leftSet = new Set(leftWords);
  const rightSet = new Set(rightWords);
  const shared = leftWords.filter((word) => rightSet.has(word)).length;
  const leftIngredients = leftWords.filter((word) => DISTINGUISHING_INGREDIENTS.has(word));
  const rightIngredients = rightWords.filter((word) => DISTINGUISHING_INGREDIENTS.has(word));
  const conflictingIngredient = leftIngredients.some((word) => !rightSet.has(word)) && rightIngredients.length
    || rightIngredients.some((word) => !leftSet.has(word)) && leftIngredients.length;
  if (conflictingIngredient) return 0;
  return shared / Math.max(leftWords.length, rightWords.length);
}

export function matchMenuPrice(itemName, prices = []) {
  const matches = prices
    .filter((entry) => Number.isFinite(entry.price) && entry.price > 0)
    .map((entry) => ({ ...entry, score: matchScore(itemName, entry.name) }))
    .filter((entry) => entry.score >= 0.75)
    .sort((left, right) => right.score - left.score);
  if (!matches.length) return null;

  const best = matches[0];
  const equallyNamed = matches.filter((entry) => entry.score === best.score);
  const equallyNamedPrices = new Set(equallyNamed.map((entry) => entry.price.toFixed(2)));
  if (equallyNamedPrices.size > 1) {
    const wantsSmall = /\b(?:6[-\s]*(?:inch|in)|small|half)\b/i.test(itemName);
    const wantsLarge = /\b(?:12[-\s]*(?:inch|in)|footlong|large|full)\b/i.test(itemName);
    if (!wantsSmall && !wantsLarge) return null;
    return equallyNamed.sort((left, right) => wantsSmall ? left.price - right.price : right.price - left.price)[0];
  }
  if (matches[1] && best.score - matches[1].score < 0.1 && matches[1].price !== best.price) return null;
  return best;
}
