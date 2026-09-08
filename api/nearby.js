const OVERPASS_ENDPOINTS = [
  "https://overpass.deflock.org/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export const config = { maxDuration: 15 };

export default async function handler(request, response) {
  const latitude = Number(request.query.latitude);
  const longitude = Number(request.query.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return response.status(400).json({ error: "Valid latitude and longitude are required." });
  }

  const query = `[out:json][timeout:8];(nwr[amenity~"restaurant|fast_food|cafe"](around:5000,${latitude},${longitude}););out tags 250;`;
  const controllers = OVERPASS_ENDPOINTS.map(() => new AbortController());
  const timer = setTimeout(() => controllers.forEach((controller) => controller.abort()), 12000);

  try {
    const data = await Promise.any(OVERPASS_ENDPOINTS.map(async (endpoint, index) => {
      const upstream = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
        signal: controllers[index].signal,
        headers: { Accept: "application/json", "User-Agent": "FitFoodFinder/1.0" },
      });
      if (!upstream.ok) throw new Error(`Overpass returned ${upstream.status}`);
      return upstream.json();
    }));
    controllers.forEach((controller) => controller.abort());
    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
    return response.status(200).json({ elements: data.elements ?? [] });
  } catch {
    return response.status(502).json({ error: "Nearby restaurant providers did not respond." });
  } finally {
    clearTimeout(timer);
  }
}
