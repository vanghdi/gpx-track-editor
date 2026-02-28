const ORS_BASE = 'https://api.openrouteservice.org/v2/directions';

export const ROUTING_PROFILES = [
  { value: 'cycling-mountain', label: 'Cycling — Off-road / MTB' },
  { value: 'cycling-regular', label: 'Cycling — Road / Touring' },
  { value: 'foot-hiking',     label: 'Hiking' },
];

/**
 * Get a route through an ordered array of waypoints using OpenRouteService.
 * @param {Array<{lat:number, lng:number}>} waypoints  — at least 2 points
 * @param {string} profile  — ORS profile string
 * @param {string} apiKey   — OpenRouteService API key
 * @returns {Promise<Array<{lat:number, lng:number}>>}
 */
export async function getRoute(waypoints, profile = 'cycling-mountain', apiKey) {
  if (waypoints.length < 2) throw new Error('Need at least 2 waypoints');

  if (!apiKey) {
    throw new Error('No API key set — add your OpenRouteService key in Settings.');
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
