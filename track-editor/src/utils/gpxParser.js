/**
 * Parse a GPX XML string into an array of track points.
 * Returns { name, points: [{lat, lng, ele, time}] }
 */
export function parseGPX(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const nameEl = doc.querySelector('trk > name') || doc.querySelector('name');
  const name = nameEl ? nameEl.textContent.trim() : 'Unnamed Track';

  const trkpts = Array.from(doc.querySelectorAll('trkpt'));
  const points = trkpts.map((pt) => {
    const lat = parseFloat(pt.getAttribute('lat'));
    const lng = parseFloat(pt.getAttribute('lon'));
    const eleEl = pt.querySelector('ele');
    const timeEl = pt.querySelector('time');
    return {
      lat,
      lng,
      ele: eleEl ? parseFloat(eleEl.textContent) : undefined,
      time: timeEl ? timeEl.textContent.trim() : undefined,
    };
  }).filter((p) => !isNaN(p.lat) && !isNaN(p.lng));

  return { name, points };
}
