const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';

/**
 * Search for addresses and POIs using Nominatim (OpenStreetMap).
 * No API key required. Rate limit: 1 req/s (enforced by debouncing in the UI).
 *
 * @param {string} query
 * @param {number} [limit=5]
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array<{id:string, label:string, lat:number, lng:number}>>}
 */
export async function searchLocations(query, limit = 5, signal) {
  if (!query || query.trim().length < 2) return [];

  const params = new URLSearchParams({
    q: query.trim(),
    format: 'json',
    limit: String(limit),
    addressdetails: '0',
  });

  const res = await fetch(`${NOMINATIM_BASE}?${params}`, {
    signal,
    headers: {
      // Nominatim ToS requires a descriptive User-Agent
      'Accept-Language': 'en',
    },
  });

  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);

  const data = await res.json();
  return data.map((item) => ({
    id: String(item.place_id),
    label: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));
}
