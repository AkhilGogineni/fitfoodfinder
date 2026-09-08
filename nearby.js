function canonicalRestaurant(label, brandAliases) {
  const normalized = label.toLowerCase();
  return Object.entries(brandAliases)
    .sort(([left], [right]) => right.length - left.length)
    .find(([alias]) => normalized.includes(alias))?.[1] ?? null;
}

export function mapNearbyRestaurants(elements, brandAliases, coveredRestaurants) {
  const byName = new Map();

  elements.forEach(({ tags = {} }) => {
    const name = (tags.name || tags.brand || "").trim();
    if (!name) return;

    const canonical = canonicalRestaurant(`${tags.brand || ""} ${name}`, brandAliases);
    const isChain = Boolean(canonical || tags.brand || tags["brand:wikidata"] || tags["brand:wikipedia"]);
    const restaurant = canonical || tags.brand || name;
    let website = tags.website || tags["contact:website"] || null;
    try {
      if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
      if (website && !["http:", "https:"].includes(new URL(website).protocol)) website = null;
    } catch {
      website = null;
    }
    const key = name.toLocaleLowerCase();
    const venue = {
      name,
      restaurant,
      website,
      isChain,
      nutritionStatus: coveredRestaurants.has(restaurant) ? "found" : "pending",
      hasNutrition: Boolean(restaurant && coveredRestaurants.has(restaurant)),
      kind: tags.cuisine
        ? tags.cuisine.split(";").join(" · ")
        : tags.amenity === "cafe" ? "Cafe" : tags.amenity === "fast_food" ? "Quick service" : "Restaurant",
    };

    const existing = byName.get(key);
    if (!existing || venue.hasNutrition || (venue.isChain && !existing.isChain)) byName.set(key, venue);
  });

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
