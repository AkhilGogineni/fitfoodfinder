export const IDEAL_PROTEIN_RATIO = 10;
export const STRONG_PROTEIN_RATIO_MAX = 15;

export function proteinRatio(item) {
  return item.protein > 0 ? item.calories / item.protein : Number.POSITIVE_INFINITY;
}

export function hasStrongProteinRatio(item) {
  return proteinRatio(item) <= STRONG_PROTEIN_RATIO_MAX;
}

export function pricePerProtein(item) {
  return item.protein > 0 && Number.isFinite(item.price) ? item.price / item.protein : Number.POSITIVE_INFINITY;
}

export function scoreMeal(item, calorieTarget, proteinTarget) {
  const calories = Number(calorieTarget) || 0;
  const protein = Number(proteinTarget) || 0;
  const ratioPenalty = Math.min(Math.max(proteinRatio(item) - IDEAL_PROTEIN_RATIO, 0) / IDEAL_PROTEIN_RATIO, 1.5);
  let penalty = ratioPenalty * 0.18;

  if (calories > 0) {
    const difference = item.calories - calories;
    penalty += (Math.abs(difference) / calories) * (difference > 0 ? 0.9 : 0.4);
  }

  if (protein > 0) {
    const difference = item.protein - protein;
    penalty += (Math.abs(difference) / protein) * (difference < 0 ? 0.95 : 0.18);
  }

  if (!calories && !protein) penalty += Math.max(proteinRatio(item) - IDEAL_PROTEIN_RATIO, 0) / 18;
  return Math.max(0, Math.round(100 - penalty * 100));
}

export function fitLabel(score) {
  if (score >= 90) return "Nailed it";
  if (score >= 78) return "Strong fit";
  if (score >= 64) return "Close fit";
  if (score >= 50) return "Loose fit";
  return "Misses target";
}

export function rankMeals(meals, options = {}) {
  const {
    calorieTarget = 0,
    proteinTarget = 0,
    query = "",
    cuisine = "",
    strongRatioOnly = false,
    nearbyBrands = null,
    sort = "fit",
  } = options;
  const needle = query.trim().toLowerCase();

  const ranked = meals
    .filter((meal) => {
      const matchesQuery = !needle || `${meal.restaurant} ${meal.name} ${meal.cuisine}`.toLowerCase().includes(needle);
      const matchesCuisine = !cuisine || meal.cuisine === cuisine;
      const matchesRatio = !strongRatioOnly || hasStrongProteinRatio(meal);
      const matchesNearby = nearbyBrands === null || nearbyBrands.has(meal.restaurant);
      return matchesQuery && matchesCuisine && matchesRatio && matchesNearby;
    })
    .map((meal) => ({ ...meal, fit: scoreMeal(meal, calorieTarget, proteinTarget) }));

  const sorters = {
    fit: (a, b) => b.fit - a.fit || proteinRatio(a) - proteinRatio(b),
    ratio: (a, b) => proteinRatio(a) - proteinRatio(b),
    price: (a, b) => pricePerProtein(a) - pricePerProtein(b),
    protein: (a, b) => b.protein - a.protein,
    calories: (a, b) => a.calories - b.calories,
  };

  return ranked.sort(sorters[sort] || sorters.fit);
}

export function formatMoney(value) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
