/**
 * Extracts all track points visible in the current Leaflet map bounds
 * (with a small buffer) and downsamples them to at most `maxPoints`
 * with at least `minSpacingDeg` degrees between consecutive kept points.
 *
 * @param {Array}  uploadedTracks  - from Zustand store
 * @param {Object} workingTrack    - from Zustand store
 * @param {Object} bounds          - Leaflet LatLngBounds instance
 * @param {number} maxPoints       - hard cap on returned points (default 300)
 * @param {number} minSpacingDeg   - min distance between kept points in degrees (~0.001° ≈ 111m)
 * @returns {Array<[number, number]>} array of [lat, lng] pairs, or [] if none in view
 */
export function sampleTrackInView(
  uploadedTracks,
  workingTrack,
  bounds,
  maxPoints = 300,
  minSpacingDeg = 0.001
) {
  if (!bounds) return [];

  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const latSpan = ne.lat - sw.lat;
  const lngSpan = ne.lng - sw.lng;
  const buf = 0.1;

  const latMin = sw.lat - latSpan * buf;
  const latMax = ne.lat + latSpan * buf;
  const lngMin = sw.lng - lngSpan * buf;
  const lngMax = ne.lng + lngSpan * buf;

  const inBounds = ({ lat, lng }) =>
    lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax;

  // Collect from all visible uploaded tracks
  const allPoints = [];
  for (const track of uploadedTracks) {
    if (track.visible === false) continue;
    for (const pt of track.points) {
      if (inBounds(pt)) allPoints.push(pt);
    }
  }

  // Collect from all working track segments
  for (const seg of workingTrack.segments) {
    for (const pt of seg.points) {
      if (inBounds(pt)) allPoints.push(pt);
    }
  }

  if (allPoints.length === 0) return [];

  // Downsample: keep a point only if it's far enough from the last kept point
  const kept = [allPoints[0]];
  let last = allPoints[0];

  for (let i = 1; i < allPoints.length; i++) {
    const pt = allPoints[i];
    const dLat = pt.lat - last.lat;
    const dLng = pt.lng - last.lng;
    if (Math.sqrt(dLat * dLat + dLng * dLng) >= minSpacingDeg) {
      kept.push(pt);
      last = pt;
      if (kept.length >= maxPoints) break;
    }
  }

  return kept.map(({ lat, lng }) => [lat, lng]);
}
