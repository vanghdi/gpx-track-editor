const ORS_BASE = 'https://api.openrouteservice.org/v2/directions';

export const ROUTING_PROFILES = [
  { value: 'cycling-mountain', label: 'Cycling — Off-road / MTB' },
  { value: 'cycling-regular', label: 'Cycling — Road / Touring' },
  { value: 'foot-hiking',     label: 'Hiking' },
];

/**
 * Get a route through an ordered array of waypoints using OpenRouteService.
 * API key is read from the VITE_ORS_API_KEY environment variable (.env.local).
 * @param {Array<{lat:number, lng:number}>} waypoints  — at least 2 points
 * @param {string} profile  — ORS profile string
 * @returns {Promise<Array<{lat:number, lng:number}>>}
 */
export async function getRoute(waypoints, profile = 'cycling-mountain') {
  if (waypoints.length < 2) throw new Error('Need at least 2 waypoints');

  const apiKey = import.meta.env.VITE_ORS_API_KEY;
  if (!apiKey || apiKey === 'paste_your_key_here') {
    throw new Error('Set VITE_ORS_API_KEY in .env.local — get a free key at openrouteservice.org');
  }

  const coordinates = waypoints.map((p) => [p.lng, p.lat]);

  const res = await fetch(`${ORS_BASE}/${profile}/geojson`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
    body: JSON.stringify({ coordinates }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `ORS request failed: ${res.status}`);
  }

  const data = await res.json();
  const coords = data.features?.[0]?.geometry?.coordinates;
  if (!coords) throw new Error('No route found');

  return coords.map(([lng, lat]) => ({ lat, lng }));
}
