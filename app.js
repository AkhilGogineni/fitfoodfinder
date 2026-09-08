import { brandAliases, commonRestaurants } from "./data.js";
import { fitLabel, formatMoney, pricePerProtein, proteinRatio, rankMeals, scoreMeal } from "./matcher.js";
import { mapNearbyRestaurants } from "./nearby.js";
import { matchMenuPrice } from "./prices.js";

const elements = {
  calorieTarget: document.querySelector("#calorie-target"),
  proteinTarget: document.querySelector("#protein-target"),
  targetSummary: document.querySelector("#target-summary"),
  search: document.querySelector("#search-input"),
  menuSearch: document.querySelector("#menu-search-button"),
  cuisine: document.querySelector("#cuisine-filter"),
  suggestions: document.querySelector("#restaurant-suggestions"),
  ratioFilter: document.querySelector("#ratio-filter"),
  sort: document.querySelector("#sort-select"),
  list: document.querySelector("#meal-list"),
  resultsStatus: document.querySelector("#results-status"),
  detail: document.querySelector("#meal-detail"),
  clear: document.querySelector("#clear-button"),
  locationButton: document.querySelector("#location-button"),
  locationStatus: document.querySelector("#location-status"),
  nearbyDirectory: document.querySelector("#nearby-directory"),
  nearbyCount: document.querySelector("#nearby-count"),
  nearbyList: document.querySelector("#nearby-list"),
  scopeControl: document.querySelector("#scope-control"),
  scopeNearby: document.querySelector("#scope-nearby"),
  scopeAll: document.querySelector("#scope-all"),
  coverage: document.querySelector("#coverage-label"),
  lookupOverlay: document.querySelector("#lookup-overlay"),
  lookupTitle: document.querySelector("#lookup-title"),
  lookupDetail: document.querySelector("#lookup-detail"),
  lookupProgress: document.querySelector("#lookup-progress"),
  lookupPercent: document.querySelector("#lookup-percent"),
  lookupTime: document.querySelector("#lookup-time"),
};

const state = {
  selectedMealId: null,
  nearbyBrands: null,
  nearbyVenues: [],
  nearbyOnly: false,
  locationLabel: "",
  liveMeals: [],
  checkedPriceWebsites: new Set(),
};

const NEARBY_CACHE_KEY = "fitfoodfinder:nearby:v2";
const NEARBY_CACHE_TTL = 6 * 60 * 60 * 1000;
const coveredRestaurants = new Set();
const commonRestaurantSet = new Set(commonRestaurants);
let commonCatalogPromise;

function nearbyMeals() {
  const nearbyRestaurants = new Set(state.nearbyVenues.map((venue) => venue.restaurant));
  return state.liveMeals.filter((meal) => nearbyRestaurants.has(meal.restaurant));
}

function saveNearbyCache() {
  try {
    const nearbyRestaurants = new Set(state.nearbyVenues.map((venue) => venue.restaurant));
    localStorage.setItem(NEARBY_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      venues: state.nearbyVenues,
      meals: state.liveMeals.filter((meal) => nearbyRestaurants.has(meal.restaurant)),
    }));
  } catch {
    // Storage can be unavailable in private browsing; live lookup still works.
  }
}

function restoreNearbyCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(NEARBY_CACHE_KEY));
    if (!Number.isFinite(cached?.savedAt) || Date.now() - cached.savedAt > NEARBY_CACHE_TTL
      || !Array.isArray(cached.venues) || !Array.isArray(cached.meals)) throw new Error("Expired cache");
    state.nearbyVenues = cached.venues;
    state.liveMeals = cached.meals;
    state.nearbyBrands = new Set(cached.venues.filter((venue) => venue.hasNutrition).map((venue) => venue.restaurant));
    state.checkedPriceWebsites = new Set(cached.venues.map((venue) => venue.website).filter(Boolean));
    state.nearbyOnly = true;
    state.locationLabel = "you";
    cached.meals.forEach((meal) => coveredRestaurants.add(meal.restaurant));
    return true;
  } catch {
    try {
      localStorage.removeItem(NEARBY_CACHE_KEY);
    } catch {
      // Ignore storage restrictions.
    }
    return false;
  }
}

function renderCachedNearby() {
  refreshCatalogControls();
  renderNearbyDirectory();
  renderResults({ preserveSelection: false });
  elements.scopeControl.hidden = false;
  elements.scopeNearby.setAttribute("aria-pressed", "true");
  elements.scopeAll.setAttribute("aria-pressed", "false");
  elements.locationButton.textContent = "Showing nearby";
  const loadedMeals = nearbyMeals();
  const message = `Loaded ${loadedMeals.length} nearby menu items instantly from this browser's cache.`;
  setLocationMessage(message);
  elements.lookupOverlay.hidden = true;
  document.body.classList.remove("lookup-active");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function safeSource(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "#data-note";
  } catch {
    return "#data-note";
  }
}

function targets() {
  return {
    calorieTarget: Number(elements.calorieTarget.value) || 0,
    proteinTarget: Number(elements.proteinTarget.value) || 0,
  };
}

function renderTargetSummary() {
  const { calorieTarget, proteinTarget } = targets();
  if (!calorieTarget && !proteinTarget) {
    elements.targetSummary.textContent = "Ranking by protein efficiency";
    return;
  }
  if (!calorieTarget) {
    elements.targetSummary.textContent = `${proteinTarget}g protein target · calories open`;
    return;
  }
  if (!proteinTarget) {
    elements.targetSummary.textContent = `${calorieTarget} calorie ceiling · protein open`;
    return;
  }
  elements.targetSummary.textContent = `Target ratio: ${Math.round(calorieTarget / proteinTarget)} cal / g`;
}

function currentOptions() {
  return {
    ...targets(),
    query: elements.search.value,
    cuisine: elements.cuisine.value,
    strongRatioOnly: elements.ratioFilter.checked,
    nearbyBrands: state.nearbyOnly ? state.nearbyBrands : null,
    sort: elements.sort.value,
  };
}

function renderMealRow(meal) {
  const button = document.createElement("button");
  button.className = "meal-row";
  button.type = "button";
  button.dataset.mealId = meal.id;
  button.setAttribute("aria-pressed", String(state.selectedMealId === meal.id));
  button.setAttribute("aria-label", `${meal.restaurant}, ${meal.name}, ${meal.fit}% target fit`);
  button.innerHTML = `
    <span class="meal-primary">
      <span class="meal-restaurant">${escapeHtml(meal.restaurant)}</span>
      <span class="meal-name">${escapeHtml(meal.name)}</span>
      <span class="confidence-badge">Verified database</span>
    </span>
    <span class="meal-metric"><span class="metric-label" data-short="CAL">Calories</span>${meal.calories}<small> cal</small></span>
    <span class="meal-metric"><span class="metric-label" data-short="PRO">Protein</span>${meal.protein}<small>g</small></span>
    <span class="meal-metric"><span class="metric-label" data-short="$/G">$/protein</span>${formatMoney(pricePerProtein(meal))}</span>
    <span class="fit-cell"><strong>${meal.fit}%</strong><small>${fitLabel(meal.fit)}</small></span>
  `;
  return button;
}

function renderResults({ preserveSelection = true } = {}) {
  renderTargetSummary();
  const ranked = rankMeals(state.liveMeals, currentOptions());
  elements.list.setAttribute("aria-busy", "false");
  elements.list.replaceChildren();

  const locationSuffix = state.nearbyOnly && state.locationLabel ? ` near ${state.locationLabel}` : "";
  elements.resultsStatus.textContent = `${ranked.length} match${ranked.length === 1 ? "" : "es"}${locationSuffix}`;

  if (!ranked.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const noMealsLoaded = state.liveMeals.length === 0;
    const nearbyEmpty = state.nearbyOnly && state.nearbyBrands !== null;
    empty.innerHTML = `
      <div>
        <strong>${noMealsLoaded ? "No live meals loaded yet." : nearbyEmpty ? "No sourced meals nearby yet." : "No meals made that cut."}</strong>
        <p>${noMealsLoaded ? "Share your location to match nearby restaurants, or enter a restaurant above and fetch its menu manually." : nearbyEmpty ? "The nearby directory still shows every restaurant found. Places without sourced calories and protein are intentionally left out of the ranking." : "Try clearing search or widening the data filter. Your targets can stay exactly where they are."}</p>
        <button type="button">${noMealsLoaded ? "Try location again" : nearbyEmpty ? "Show all loaded meals" : "Clear filters"}</button>
      </div>
    `;
    empty.querySelector("button").addEventListener("click", noMealsLoaded ? useLocation : resetFilters);
    elements.list.append(empty);
    state.selectedMealId = null;
    renderDetail();
    return;
  }

  const fragment = document.createDocumentFragment();
  ranked.forEach((meal) => fragment.append(renderMealRow(meal)));
  elements.list.append(fragment);

  if (!preserveSelection || !ranked.some((meal) => meal.id === state.selectedMealId)) {
    state.selectedMealId = ranked[0].id;
  }
  updatePressedRows();
  renderDetail();
}

function selectMeal(mealId) {
  state.selectedMealId = mealId;
  updatePressedRows();
  renderDetail();
  if (window.innerWidth < 820) elements.detail.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updatePressedRows() {
  elements.list.querySelector('.meal-row[aria-pressed="true"]')?.setAttribute("aria-pressed", "false");
  elements.list.querySelector(`[data-meal-id="${CSS.escape(state.selectedMealId || "")}"]`)?.setAttribute("aria-pressed", "true");
}

function renderDetail() {
  const meal = state.liveMeals.find((item) => item.id === state.selectedMealId);
  if (!meal) {
    elements.detail.innerHTML = `<div class="detail-placeholder"><span>Pick a row</span><p>See the full macro and price breakdown.</p></div>`;
    return;
  }

  const fit = scoreMeal(meal, targets().calorieTarget, targets().proteinTarget);
  const source = safeSource(meal.source);
  const sourceText = source.startsWith("http") ? "Open nutrition source" : "Read data note";
  const priceSource = safeSource(meal.priceSource);
  const priceSourceMarkup = meal.priceSource && priceSource.startsWith("http")
    ? `<a class="source-link" href="${priceSource}" target="_blank" rel="noreferrer">Open price source</a>`
    : "";
  elements.detail.innerHTML = `
    <div class="detail-content">
      <div class="detail-main">
        <h3>${escapeHtml(meal.name)}</h3>
        <div class="detail-meta">
          <span class="detail-restaurant">${escapeHtml(meal.restaurant)}</span>
          <span class="detail-confidence">Verified database nutrition</span>
        </div>
        <div class="detail-fit">
          <span>${fitLabel(fit)}</span>
          <strong>${fit}%</strong>
        </div>
        <div class="macro-grid">
          <div class="macro-cell"><small>Calories</small><strong>${meal.calories}</strong></div>
          <div class="macro-cell"><small>Protein</small><strong>${meal.protein}g</strong></div>
          <div class="macro-cell"><small>Carbs</small><strong>${meal.carbs}g</strong></div>
          <div class="macro-cell"><small>Fat</small><strong>${meal.fat}g</strong></div>
          <div class="macro-cell"><small>Cal / protein g</small><strong>${proteinRatio(meal).toFixed(1)}</strong></div>
          <div class="macro-cell"><small>Price / protein g</small><strong>${formatMoney(pricePerProtein(meal))}</strong></div>
        </div>
      </div>
      <div class="detail-options">
        <div class="detail-actions">
          <a class="source-link" href="${source}" ${source.startsWith("http") ? 'target="_blank" rel="noreferrer"' : ""}>${sourceText}</a>
          ${priceSourceMarkup}
          <span class="detail-price"><strong>${formatMoney(meal.price)}</strong><small>${meal.price == null ? "price unavailable" : "official menu price"}</small></span>
        </div>
      </div>
    </div>
  `;

}

function resetFilters() {
  elements.search.value = "";
  elements.cuisine.value = "";
  elements.ratioFilter.checked = false;
  elements.sort.value = "fit";
  state.nearbyBrands = null;
  state.nearbyVenues = [];
  state.nearbyOnly = false;
  state.locationLabel = "";
  elements.locationStatus.hidden = true;
  elements.nearbyDirectory.hidden = true;
  elements.nearbyList.replaceChildren();
  elements.scopeControl.hidden = true;
  elements.locationButton.textContent = "Use my location";
  renderResults({ preserveSelection: false });
}

function setLocationMessage(message, tone = "info") {
  elements.locationStatus.hidden = false;
  elements.locationStatus.dataset.tone = tone;
  elements.locationStatus.textContent = message;
}

function updateLookupOverlay(title, detail, progress, timing) {
  const value = Math.max(0, Math.min(100, Math.round(progress * 10) / 10));
  const label = Number.isInteger(value) ? String(value) : value.toFixed(1);
  elements.lookupOverlay.hidden = false;
  document.body.classList.add("lookup-active");
  elements.lookupTitle.textContent = title;
  elements.lookupDetail.textContent = detail;
  elements.lookupProgress.value = value;
  elements.lookupProgress.textContent = `${label}%`;
  elements.lookupPercent.textContent = `${label}% complete`;
  elements.lookupTime.textContent = timing;
}

function elapsedSeconds(startedAt) {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function roundedSeconds(seconds) {
  return Math.max(5, Math.ceil(seconds / 5) * 5);
}

function startCatalogProgress() {
  const startedAt = Date.now();
  let nearbyCount = null;
  let interval;

  const render = () => {
    const elapsed = elapsedSeconds(startedAt);
    const progress = Math.min(24, 6 + elapsed * 18 / 45 + (nearbyCount === null ? 0 : 2));
    const detail = nearbyCount === null
      ? "Finding nearby restaurants and loading sourced menus."
      : `${nearbyCount} nearby restaurant${nearbyCount === 1 ? "" : "s"} found · loading sourced menus`;
    const timing = elapsed < 3
      ? `${elapsed}s elapsed · checking the shared menu cache`
      : elapsed < 45
        ? `${elapsed}s elapsed · about ${roundedSeconds(45 - elapsed)}s left in this stage if menus need refreshing`
        : `${elapsed}s elapsed · this refresh is taking longer than usual`;
    updateLookupOverlay(nearbyCount === null ? "Finding nearby restaurants" : "Matching nearby menus", detail, progress, timing);
  };

  render();
  interval = window.setInterval(render, 1000);
  return {
    setNearbyCount(count) {
      nearbyCount = count;
      render();
    },
    complete(mealCount, progress = 25) {
      window.clearInterval(interval);
      updateLookupOverlay("Matching nearby menus", `${nearbyCount} nearby restaurants found · ${mealCount} sourced menu items preloaded`, progress, `${elapsedSeconds(startedAt)}s elapsed · common menus ready`);
    },
    stop() {
      window.clearInterval(interval);
    },
  };
}

function startRestaurantProgress(total) {
  const startedAt = Date.now();
  let completed = 0;
  let batchSize = 0;
  let batchStartedAt = startedAt;
  let interval;

  const render = () => {
    const elapsed = elapsedSeconds(startedAt);
    const batchDuration = Math.max(4000, batchSize * 1400);
    const estimatedBatchProgress = batchSize * 0.85 * Math.min(1, (Date.now() - batchStartedAt) / batchDuration);
    const effectiveCompleted = Math.min(total, completed + estimatedBatchProgress);
    const progress = 26 + 48 * effectiveCompleted / total;
    const secondsPerRestaurant = completed ? Math.max(1.25, elapsed / Math.max(1, effectiveCompleted)) : 1.4;
    const remaining = secondsPerRestaurant * (total - effectiveCompleted);
    const detail = completed
      ? `${completed} of ${total} restaurant menus completed${batchSize ? " · current batch in progress" : ""}`
      : `Starting menu lookups for ${total} remaining restaurants`;
    updateLookupOverlay("Checking remaining restaurants", detail, progress, `${elapsed}s elapsed · about ${roundedSeconds(remaining)}s left in this stage`);
  };

  interval = window.setInterval(render, 1000);
  return {
    beginBatch(size) {
      batchSize = size;
      batchStartedAt = Date.now();
      render();
    },
    completeBatch(count) {
      completed = count;
      batchSize = 0;
      render();
    },
    stop() {
      window.clearInterval(interval);
    },
  };
}

function startPriceProgress(total) {
  const startedAt = Date.now();
  let completed = 0;
  let batchSize = 0;
  let batchStartedAt = startedAt;

  const render = () => {
    const elapsed = elapsedSeconds(startedAt);
    const batchDuration = Math.max(5000, batchSize * 3500);
    const estimatedBatchProgress = batchSize * 0.85 * Math.min(1, (Date.now() - batchStartedAt) / batchDuration);
    const effectiveCompleted = Math.min(total, completed + estimatedBatchProgress);
    const percent = 75 + 24 * effectiveCompleted / total;
    const secondsPerMenu = completed ? Math.max(3, elapsed / Math.max(1, effectiveCompleted)) : 3.5;
    const remaining = secondsPerMenu * (total - effectiveCompleted);
    const detail = completed
      ? `Checked ${completed} of ${total} official menus${batchSize ? " · current batch in progress" : ""}`
      : `Starting price checks for ${total} official menu${total === 1 ? "" : "s"}`;
    updateLookupOverlay("Adding local prices", detail, percent, `${elapsed}s elapsed · about ${roundedSeconds(remaining)}s left`);
  };

  const interval = window.setInterval(render, 1000);
  render();
  return {
    beginBatch(size) {
      batchSize = size;
      batchStartedAt = Date.now();
      render();
    },
    completeBatch(count) {
      completed = count;
      batchSize = 0;
      render();
    },
    stop() {
      window.clearInterval(interval);
    },
  };
}

function finishLookupOverlay(detail) {
  updateLookupOverlay("Nearby menus ready", detail, 100, "Complete");
  window.setTimeout(() => {
    elements.lookupOverlay.hidden = true;
    document.body.classList.remove("lookup-active");
  }, 1000);
}

function closeLookupOverlay(title, detail) {
  updateLookupOverlay(title, detail, 100, "Showing the available catalog");
  window.setTimeout(() => {
    elements.lookupOverlay.hidden = true;
    document.body.classList.remove("lookup-active");
  }, 1400);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchNutritionBatch(restaurants) {
  const url = `/api/nutrition?restaurants=${encodeURIComponent(restaurants.join(","))}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response;
    let data;
    try {
      response = await fetch(url);
      data = await response.json();
    } catch (error) {
      if (attempt === 2) throw error;
      await wait(1000 * (attempt + 1));
      continue;
    }
    if (response.ok) return data;

    const error = new Error(data.error || `Nutrition lookup returned ${response.status}`);
    error.code = data.code;
    if (error.code !== "provider_rate_limited" || attempt === 2) throw error;
    await wait(20000 * (attempt + 1));
  }
}

function loadCommonCatalog() {
  if (!commonCatalogPromise) {
    commonCatalogPromise = fetch("/api/catalog").then(async (response) => {
      const data = await response.json();
      if (!response.ok) {
        const error = new Error(data.error || `Common catalog returned ${response.status}`);
        error.code = data.code;
        throw error;
      }
      return data;
    });
  }
  return commonCatalogPromise;
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error("Location is not supported by this browser."));
    else navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  });
}

async function fetchNearbyRestaurants(latitude, longitude) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 14000);
  try {
    const response = await fetch(`/api/nearby?latitude=${Number(latitude).toFixed(2)}&longitude=${Number(longitude).toFixed(2)}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Nearby lookup returned ${response.status}.`);
    const data = await response.json();
    return mapNearbyRestaurants(data.elements, brandAliases, coveredRestaurants);
  } finally {
    controller.abort();
    clearTimeout(timer);
  }
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function refreshCatalogControls() {
  const existingRestaurants = new Set([...elements.suggestions.options].map((option) => option.value));
  [...new Set(state.liveMeals.map((meal) => meal.restaurant))].sort().forEach((restaurant) => {
    if (existingRestaurants.has(restaurant)) return;
    const option = document.createElement("option");
    option.value = restaurant;
    elements.suggestions.append(option);
  });

  const existingCuisines = new Set([...elements.cuisine.options].map((option) => option.value));
  [...new Set(state.liveMeals.map((meal) => meal.cuisine))].filter(Boolean).sort().forEach((cuisine) => {
    if (existingCuisines.has(cuisine)) return;
    const option = document.createElement("option");
    option.value = cuisine;
    option.textContent = cuisine;
    elements.cuisine.append(option);
  });
  elements.coverage.textContent = state.liveMeals.length ? `${state.liveMeals.length} sourced meals` : "Live menu lookup";
}

async function enrichLivePrices() {
  const groups = new Map();
  state.liveMeals.filter((meal) => meal.price == null).forEach((meal) => {
    const venue = state.nearbyVenues.find((item) => item.restaurant === meal.restaurant && item.website);
    if (!venue || state.checkedPriceWebsites.has(venue.website)) return;
    if (!groups.has(venue.website)) groups.set(venue.website, { restaurant: meal.restaurant, website: venue.website });
  });
  const menus = [...groups.values()];
  if (!menus.length) return 0;

  const before = state.liveMeals.filter((meal) => meal.price != null).length;
  const progress = startPriceProgress(menus.length);
  setLocationMessage(`Nutrition loaded. Checking prices on ${menus.length} official menu${menus.length === 1 ? "" : "s"}…`);
  try {
    for (let index = 0; index < menus.length; index += 3) {
      const batch = menus.slice(index, index + 3);
      progress.beginBatch(batch.length);
      const results = await Promise.allSettled(batch.map(async ({ restaurant, website }) => {
        const response = await fetch(`/api/prices?restaurant=${encodeURIComponent(restaurant)}&website=${encodeURIComponent(website)}`);
        if (!response.ok) throw new Error(`Price lookup returned ${response.status}`);
        return response.json();
      }));
      results.forEach((result, resultIndex) => {
        if (result.status !== "fulfilled") return;
        const menu = batch[resultIndex];
        state.checkedPriceWebsites.add(menu.website);
        state.liveMeals = state.liveMeals.map((meal) => {
          if (meal.restaurant !== menu.restaurant || meal.price != null) return meal;
          const match = matchMenuPrice(meal.name, result.value.prices);
          return match ? { ...meal, price: match.price, priceSource: match.source } : meal;
        });
      });
      const completed = Math.min(index + batch.length, menus.length);
      progress.completeBatch(completed);
      setLocationMessage(`Nutrition loaded. Checked ${completed} of ${menus.length} official menus for prices…`);
    }
  } finally {
    progress.stop();
  }
  return state.liveMeals.filter((meal) => meal.price != null).length - before;
}

async function enrichRemainingNutrition(candidates) {
  if (!candidates.length) return { error: null, checked: 0 };

  const candidateSet = new Set(candidates);
  const checked = new Set();
  const failed = new Set();
  const progress = startRestaurantProgress(candidates.length);
  state.nearbyVenues = state.nearbyVenues.map((venue) => candidateSet.has(venue.restaurant)
    ? { ...venue, nutritionStatus: "checking" }
    : venue);
  renderNearbyDirectory();

  let lookupError = null;
  try {
    for (let index = 0; index < candidates.length; index += 6) {
      const batch = candidates.slice(index, index + 6);
      progress.beginBatch(batch.length);
      const data = await fetchNutritionBatch(batch);
      if (data.providerConfigured === false) {
        const error = new Error("The nutrition provider is not connected.");
        error.code = "provider_missing";
        throw error;
      }

      const byId = new Map(state.liveMeals.map((meal) => [meal.id, meal]));
      (data.meals || []).forEach((meal) => {
        const venue = state.nearbyVenues.find((item) => item.restaurant === meal.restaurant);
        const mappedCuisine = venue && !["Restaurant", "Quick service", "Cafe"].includes(venue.kind)
          ? titleCase(venue.kind)
          : "Other";
        byId.set(meal.id, { ...meal, cuisine: meal.cuisine || mappedCuisine });
        coveredRestaurants.add(meal.restaurant);
      });
      state.liveMeals = [...byId.values()];

      if (data.lookups?.length) {
        data.lookups.forEach((lookup) => (lookup.error ? failed : checked).add(lookup.restaurant));
      } else {
        (data.searched || batch).forEach((restaurant) => checked.add(restaurant));
      }
      const matched = new Set(state.liveMeals.map((meal) => meal.restaurant));
      state.nearbyVenues = state.nearbyVenues.map((venue) => {
        if (matched.has(venue.restaurant)) return { ...venue, hasNutrition: true, nutritionStatus: "found" };
        if (failed.has(venue.restaurant)) return { ...venue, hasNutrition: false, nutritionStatus: "lookup-failed" };
        if (checked.has(venue.restaurant)) return { ...venue, hasNutrition: false, nutritionStatus: "no-match" };
        return venue;
      });
      state.nearbyBrands = new Set(state.nearbyVenues.filter((venue) => venue.hasNutrition).map((venue) => venue.restaurant));
      refreshCatalogControls();
      renderNearbyDirectory();
      renderResults({ preserveSelection: true });
      const completed = Math.min(index + batch.length, candidates.length);
      progress.completeBatch(completed);
      setLocationMessage(`${state.nearbyVenues.length} nearby restaurants found. Completed ${completed} of ${candidates.length} remaining menu lookups…`);
    }
  } catch (error) {
    lookupError = error;
    const matched = new Set(state.liveMeals.map((meal) => meal.restaurant));
    state.nearbyVenues = state.nearbyVenues.map((venue) => candidateSet.has(venue.restaurant) && !matched.has(venue.restaurant) && !checked.has(venue.restaurant)
      ? { ...venue, hasNutrition: false, nutritionStatus: "lookup-failed" }
      : venue);
    renderNearbyDirectory();
  } finally {
    progress.stop();
  }

  return { error: lookupError, checked: checked.size };
}

async function fetchSearchedRestaurant() {
  const restaurant = elements.search.value.trim();
  if (restaurant.length < 3) {
    setLocationMessage("Enter at least three characters from a restaurant name.", "error");
    return;
  }

  elements.menuSearch.disabled = true;
  elements.menuSearch.textContent = "Checking…";
  setLocationMessage(`Searching the live nutrition database for ${restaurant}…`);
  try {
    const data = await fetchNutritionBatch([restaurant]);
    if (data.providerConfigured === false) {
      setLocationMessage("Live menu lookup is built but its nutrition provider is not connected yet.", "error");
      return;
    }
    if (!data.meals?.length) {
      setLocationMessage(`No verified menu match was returned for ${restaurant}. The restaurant has not been labeled as having no nutrition.`, "error");
      return;
    }

    const byId = new Map(state.liveMeals.map((meal) => [meal.id, meal]));
    data.meals.forEach((meal) => {
      byId.set(meal.id, { ...meal, cuisine: meal.cuisine || "Other" });
      coveredRestaurants.add(meal.restaurant);
    });
    state.liveMeals = [...byId.values()];
    state.nearbyOnly = false;
    elements.cuisine.value = "";
    if (!elements.scopeControl.hidden) {
      elements.scopeNearby.setAttribute("aria-pressed", "false");
      elements.scopeAll.setAttribute("aria-pressed", "true");
    }
    refreshCatalogControls();
    renderResults({ preserveSelection: false });
    setLocationMessage(`Added ${data.meals.length} sourced ${restaurant} menu item${data.meals.length === 1 ? "" : "s"} to this session.`);
  } catch (error) {
    const message = error.code === "provider_ip_restricted"
      ? "Live menu lookup needs its FatSecret server IP access updated before it can return meals."
      : error.code === "provider_rate_limited"
        ? "The nutrition provider is temporarily rate limited. Try again in a moment."
        : "Live menu lookup failed. Try that restaurant again in a moment.";
    setLocationMessage(message, "error");
  } finally {
    elements.menuSearch.disabled = false;
    elements.menuSearch.textContent = "Fetch menu";
  }
}

function setMealScope(nearbyOnly) {
  state.nearbyOnly = nearbyOnly;
  elements.scopeNearby.setAttribute("aria-pressed", String(nearbyOnly));
  elements.scopeAll.setAttribute("aria-pressed", String(!nearbyOnly));
  renderResults({ preserveSelection: false });
}

function renderNearbyDirectory() {
  elements.nearbyList.replaceChildren();
  const matched = state.nearbyVenues.filter((venue) => venue.hasNutrition).length;
  const loadedMeals = nearbyMeals();
  const menuCounts = new Map();
  loadedMeals.forEach((meal) => menuCounts.set(meal.restaurant, (menuCounts.get(meal.restaurant) || 0) + 1));
  elements.nearbyCount.textContent = `${matched}/${state.nearbyVenues.length} restaurants · ${loadedMeals.length} menu items loaded`;

  const fragment = document.createDocumentFragment();
  state.nearbyVenues.forEach((venue) => {
    const menuCount = menuCounts.get(venue.restaurant) || 0;
    const row = document.createElement("button");
    row.className = "nearby-row";
    row.type = "button";
    row.disabled = menuCount === 0;
    if (menuCount) {
      row.setAttribute("aria-label", `Show ${menuCount} menu item${menuCount === 1 ? "" : "s"} from ${venue.name}`);
      row.dataset.restaurant = venue.restaurant;
    }
    const identity = document.createElement("span");
    const name = document.createElement("strong");
    const kind = document.createElement("small");
    const status = document.createElement("span");
    name.textContent = venue.name;
    kind.textContent = venue.kind;
    const labels = {
      found: `${menuCount} menu item${menuCount === 1 ? "" : "s"}`,
      checking: "Matching menu…",
      queued: "Queued for automatic lookup",
      pending: "Checking menu data",
      "provider-missing": "Provider not connected",
      "no-match": "No menu match",
      "lookup-failed": "Lookup failed",
      "not-checked": "Manual search available",
    };
    status.className = `nearby-status ${venue.hasNutrition ? "available" : ""}`;
    status.textContent = labels[venue.nutritionStatus] || "Not checked";
    identity.append(name, kind);
    row.append(identity, status);
    fragment.append(row);
  });
  elements.nearbyList.append(fragment);
  elements.nearbyDirectory.hidden = false;
}

async function useLocation() {
  let catalogProgress;
  elements.locationButton.disabled = true;
  elements.locationButton.textContent = "Checking…";
  setLocationMessage("Requesting your location, then discovering restaurants and cafes within about 3 miles.");
  updateLookupOverlay("Find restaurants near you", "Approve the browser location request to match nearby restaurants with sourced menus.", 3, "Waiting for location approval");
  try {
    const position = await getPosition();
    const catalogPromise = loadCommonCatalog().then((data) => ({ data }), (error) => ({ error }));
    catalogProgress = startCatalogProgress();
    const venues = await fetchNearbyRestaurants(position.coords.latitude, position.coords.longitude);
    state.nearbyVenues = venues.map((venue) => ({
      ...venue,
      hasNutrition: false,
      nutritionStatus: commonRestaurantSet.has(venue.restaurant) ? "checking" : "queued",
    }));
    state.nearbyBrands = new Set();
    state.nearbyOnly = true;
    state.locationLabel = "you";
    renderNearbyDirectory();
    elements.scopeControl.hidden = false;
    elements.scopeNearby.setAttribute("aria-pressed", "true");
    elements.scopeAll.setAttribute("aria-pressed", "false");
    setLocationMessage(`${venues.length} nearby restaurant${venues.length === 1 ? "" : "s"} found. Matching sourced menu data…`);
    catalogProgress.setNearbyCount(venues.length);
    elements.locationButton.textContent = "Showing nearby";
    renderResults({ preserveSelection: false });

    const catalogResult = await catalogPromise;
    if (catalogResult.error || catalogResult.data.providerConfigured === false) {
      catalogProgress.stop();
      state.nearbyVenues = state.nearbyVenues.map((venue) => ({ ...venue, nutritionStatus: commonRestaurantSet.has(venue.restaurant) ? "lookup-failed" : "not-checked" }));
      renderNearbyDirectory();
      const message = "Nearby restaurants loaded, but sourced menu data is temporarily unavailable. You can still fetch one restaurant manually.";
      setLocationMessage(message, "error");
      closeLookupOverlay("Menu data is unavailable", message);
      return;
    }

    const nearbyRestaurants = new Set(venues.map((venue) => venue.restaurant));
    const matchedRestaurants = new Set();
    const byId = new Map();
    catalogResult.data.meals.filter((meal) => nearbyRestaurants.has(meal.restaurant)).forEach((meal) => {
      const venue = venues.find((item) => item.restaurant === meal.restaurant);
      const mappedCuisine = venue && !["Restaurant", "Quick service", "Cafe"].includes(venue.kind)
        ? titleCase(venue.kind)
        : "Other";
      byId.set(meal.id, { ...meal, cuisine: mappedCuisine });
      matchedRestaurants.add(meal.restaurant);
      coveredRestaurants.add(meal.restaurant);
    });
    state.liveMeals = [...byId.values()];
    state.nearbyVenues = state.nearbyVenues.map((venue) => {
      if (matchedRestaurants.has(venue.restaurant)) return { ...venue, hasNutrition: true, nutritionStatus: "found" };
      return { ...venue, hasNutrition: false, nutritionStatus: "checking" };
    });
    state.nearbyBrands = new Set(state.nearbyVenues.filter((venue) => venue.hasNutrition).map((venue) => venue.restaurant));
    const remainingRestaurants = [...new Set(state.nearbyVenues
      .filter((venue) => !matchedRestaurants.has(venue.restaurant))
      .map((venue) => venue.restaurant))];
    catalogProgress.complete(state.liveMeals.length, remainingRestaurants.length ? 25 : 72);
    refreshCatalogControls();
    renderNearbyDirectory();
    renderResults({ preserveSelection: false });
    const lookupResult = await enrichRemainingNutrition(remainingRestaurants);
    const pricesAdded = await enrichLivePrices();
    if (pricesAdded) renderResults({ preserveSelection: true });
    const loadedMeals = nearbyMeals();
    const pricedMeals = loadedMeals.filter((meal) => meal.price != null).length;
    const failureNote = lookupResult.error ? " Some restaurant lookups could not finish." : "";
    const message = `${state.nearbyVenues.length} nearby restaurants checked. ${state.nearbyBrands.size} returned ${loadedMeals.length} menu items; ${pricedMeals} item${pricedMeals === 1 ? " has" : "s have"} prices.${failureNote}`;
    setLocationMessage(message, lookupResult.error ? "error" : "info");
    saveNearbyCache();
    finishLookupOverlay(message);
  } catch (error) {
    state.nearbyBrands = null;
    state.nearbyVenues = [];
    state.nearbyOnly = false;
    state.locationLabel = "";
    elements.nearbyDirectory.hidden = true;
    elements.scopeControl.hidden = true;
    const message = error?.code === 1
      ? "Location was not shared. Try again or enter a restaurant and fetch its menu manually."
      : "Nearby lookup is unavailable right now. Try again or fetch a restaurant manually.";
    setLocationMessage(message, "error");
    closeLookupOverlay(error?.code === 1 ? "Location was not shared" : "Nearby lookup is unavailable", message);
    elements.locationButton.textContent = "Try location again";
  } finally {
    catalogProgress?.stop();
    elements.locationButton.disabled = false;
  }
}

[elements.calorieTarget, elements.proteinTarget, elements.search].forEach((input) => {
  input.addEventListener("input", () => renderResults());
});
[elements.ratioFilter, elements.sort, elements.cuisine].forEach((control) => {
  control.addEventListener("change", () => renderResults());
});
elements.clear.addEventListener("click", resetFilters);
elements.locationButton.addEventListener("click", useLocation);
elements.menuSearch.addEventListener("click", fetchSearchedRestaurant);
elements.list.addEventListener("click", (event) => {
  const row = event.target.closest(".meal-row");
  if (row) selectMeal(row.dataset.mealId);
});
elements.nearbyList.addEventListener("click", (event) => {
  const row = event.target.closest(".nearby-row[data-restaurant]");
  if (!row) return;
  elements.search.value = row.dataset.restaurant;
  renderResults({ preserveSelection: false });
  elements.list.scrollIntoView({ behavior: "smooth", block: "start" });
});
elements.search.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    fetchSearchedRestaurant();
  }
});
elements.scopeNearby.addEventListener("click", () => setMealScope(true));
elements.scopeAll.addEventListener("click", () => setMealScope(false));

if (restoreNearbyCache()) {
  renderCachedNearby();
} else {
  refreshCatalogControls();
  renderResults({ preserveSelection: false });
  useLocation();
}
