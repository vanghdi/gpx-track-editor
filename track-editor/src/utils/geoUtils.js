/** Haversine distance in metres between two {lat,lng} points */
export function haversineDistance(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const c =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

/**
 * Find the closest point across all uploaded tracks to a given latlng.
 * Returns { trackId, idx, lat, lng } or null.
 */
export function snapToNearest(latlng, uploadedTracks) {
  let best = null;
  let bestDist = Infinity;

  for (const track of uploadedTracks) {
    if (!track.visible) continue;
    for (let i = 0; i < track.points.length; i++) {
      const p = track.points[i];
      const d = haversineDistance(latlng, p);
      if (d < bestDist) {
        bestDist = d;
        best = { trackId: track.id, idx: i, lat: p.lat, lng: p.lng };
      }
    }
  }
  return best;
}

/**
 * Compute a bounding box [[minLat, minLng], [maxLat, maxLng]] for all tracks.
 */
export function getBBox(uploadedTracks) {
  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
  for (const track of uploadedTracks) {
    for (const p of track.points) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng > maxLng) maxLng = p.lng;
    }
  }
  if (!isFinite(minLat)) return null;
  return [[minLat, minLng], [maxLat, maxLng]];
}

/** Sum haversine distances along an array of {lat,lng} points, returns km */
export function pathDistanceKm(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i - 1], points[i]);
  }
  return total / 1000;
}

export function isLoopTrack(track) {
  const points = track?.points || [];
  return points.length >= 3 && areConnected(points[0], points[points.length - 1]);
}

function hasExplicitClosingPoint(points) {
  if (points.length < 2) return false;
  const first = points[0];
  const last = points[points.length - 1];
  return first.lat === last.lat && first.lng === last.lng;
}

function buildWrappedLoopSlicePoints(track, startIdx, endIdx) {
  const points = track.points || [];
  const lastIdx = points.length - 1;
  const hasClosingPoint = hasExplicitClosingPoint(points);
  const loopLength = hasClosingPoint ? lastIdx : points.length;
  if (loopLength < 2) return [];

  const normalizeIndex = (idx) => (
    hasClosingPoint && idx === lastIdx ? 0 : idx
  );

  const startLoopIdx = normalizeIndex(startIdx);
  const endLoopIdx = normalizeIndex(endIdx);
  const step = startIdx > endIdx ? 1 : -1;

  const loopIndices = [startLoopIdx];
  let cursor = startLoopIdx;
  while (cursor !== endLoopIdx) {
    cursor = (cursor + step + loopLength) % loopLength;
    loopIndices.push(cursor);
  }

  const wrappedPoints = loopIndices.map((idx) => points[idx]);
  wrappedPoints[0] = points[startIdx];
  wrappedPoints[wrappedPoints.length - 1] = points[endIdx];
  return wrappedPoints;
}

/**
 * Build the point list for a GPX slice while preserving the user's chosen direction.
 * Same-track slices can run forward or backward; cross-track slices run from the
 * chosen start point to the chosen end point.
 */
export function buildGpxSlicePoints(startTrack, startIdx, endTrack, endIdx, sameTrackMode = 'direct') {
  if (!startTrack) return [];

  if (startTrack.id === endTrack?.id) {
    if (sameTrackMode === 'wrap' && isLoopTrack(startTrack)) {
      return buildWrappedLoopSlicePoints(startTrack, startIdx, endIdx);
    }

    const reversed = startIdx > endIdx;
    const [from, to] = reversed ? [endIdx, startIdx] : [startIdx, endIdx];
    const points = startTrack.points.slice(from, to + 1);
    return reversed ? [...points].reverse() : points;
  }

  return [
    ...startTrack.points.slice(startIdx),
    ...(endTrack ? endTrack.points.slice(0, endIdx + 1) : []),
  ];
}

export function areConnected(a, b) {
  return haversineDistance(a, b) < 20;
}
