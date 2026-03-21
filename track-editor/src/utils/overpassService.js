const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export const POI_CATEGORIES = [
  { key: 'bar',                     label: 'Bar',        icon: '🍺', tagKey: 'amenity', tagValue: 'bar' },
  { key: 'pub',                     label: 'Pub',        icon: '🍻', tagKey: 'amenity', tagValue: 'pub' },
  { key: 'restaurant',              label: 'Restaurant', icon: '🍽', tagKey: 'amenity', tagValue: 'restaurant' },
  { key: 'cafe',                    label: 'Café',       icon: '☕', tagKey: 'amenity', tagValue: 'cafe' },
  { key: 'supermarket',             label: 'Supermarket',icon: '🛒', tagKey: 'shop',    tagValue: 'supermarket' },
  { key: 'camp_site',               label: 'Campsite',   icon: '🏕', tagKey: 'tourism', tagValue: 'camp_site' },
  { key: 'viewpoint',               label: 'Viewpoint',  icon: '🔭', tagKey: 'tourism', tagValue: 'viewpoint' },
  { key: 'drinking_water',          label: 'Water',      icon: '💧', tagKey: 'amenity', tagValue: 'drinking_water' },
  { key: 'bicycle_repair_station',  label: 'Bike Repair',icon: '🔧', tagKey: 'amenity', tagValue: 'bicycle_repair_station' },
  { key: 'picnic_site',             label: 'Picnic',     icon: '🧺', tagKey: 'tourism', tagValue: 'picnic_site' },
];

function buildQuery(categories, radiusM, coords) {
  const coordStr = coords.flat().join(',');
  const filters = categories.map(
    (cat) => `  nwr["${cat.tagKey}"="${cat.tagValue}"](around:${radiusM},${coordStr});`
  );
  return `[out:json][timeout:15];\n(\n${filters.join('\n')}\n);\nout center tags;`;
}

function parseResults(elements) {
  return elements.map((el) => {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) return null;

    const tags = el.tags || {};
    const category = POI_CATEGORIES.find((c) => tags[c.tagKey] === c.tagValue);

    return {
      id: crypto.randomUUID(),
      osmType: el.type,
      osmId: el.id,
      lat,
      lng,
      name: tags.name || category?.label || 'POI',
      category: category?.key ?? 'unknown',
      categoryLabel: category?.label ?? '',
      categoryIcon: category?.icon ?? '📍',
      tags: {
        openingHours: tags['opening_hours'],
        website: /^https?:\/\//i.test(tags['website'] ?? '') ? tags['website'] : null,
        phone: tags['phone'],
        street: tags['addr:street'],
        houseNumber: tags['addr:housenumber'],
        city: tags['addr:city'],
      },
    };
  }).filter(Boolean);
}

export async function searchPoiNearTrack({ categories, radiusM, points, signal }) {
  const query = buildQuery(categories, radiusM, points);
  const body = new URLSearchParams({ data: query });

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal,
  });

  if (!res.ok) throw new Error(`Overpass returned ${res.status}`);

  const data = await res.json();
  return parseResults(data.elements ?? []);
}
