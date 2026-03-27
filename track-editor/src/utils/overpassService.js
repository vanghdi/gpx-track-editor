const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/**
 * Each group has a `tags` array so a single toggle queries multiple OSM tag combos.
 * `icon` (emoji) is kept for Leaflet HTML popups (plain HTML context).
 * `iconName` is the Phosphor icon name used in the React category picker.
 */
export const POI_CATEGORIES = [
  {
    key: 'food',
    label: 'Food',
    icon: '🍽',
    iconName: 'ForkKnife',
    tags: [
      { tagKey: 'amenity', tagValue: 'restaurant' },
      { tagKey: 'amenity', tagValue: 'fast_food' },
      { tagKey: 'amenity', tagValue: 'bistro' },
    ],
  },
  {
    key: 'drinks',
    label: 'Drinks',
    icon: '🍺',
    iconName: 'Beer',
    tags: [
      { tagKey: 'amenity', tagValue: 'bar' },
      { tagKey: 'amenity', tagValue: 'pub' },
      { tagKey: 'amenity', tagValue: 'cafe' },
      { tagKey: 'amenity', tagValue: 'biergarten' },
    ],
  },
  {
    key: 'supermarket',
    label: 'Supermarket',
    icon: '🛒',
    iconName: 'ShoppingCart',
    tags: [
      { tagKey: 'shop', tagValue: 'supermarket' },
      { tagKey: 'shop', tagValue: 'convenience' },
    ],
  },
  {
    key: 'campsite',
    label: 'Campsite',
    icon: '⛺',
    iconName: 'Tent',
    tags: [
      { tagKey: 'tourism', tagValue: 'camp_site' },
      { tagKey: 'tourism', tagValue: 'caravan_site' },
    ],
  },
  {
    key: 'lodging',
    label: 'Hotels',
    icon: '🏨',
    iconName: 'Bed',
    tags: [
      { tagKey: 'tourism', tagValue: 'hotel' },
      { tagKey: 'tourism', tagValue: 'hostel' },
      { tagKey: 'tourism', tagValue: 'motel' },
      { tagKey: 'tourism', tagValue: 'guest_house' },
      { tagKey: 'tourism', tagValue: 'chalet' },
    ],
  },
  {
    key: 'viewpoint',
    label: 'Viewpoint',
    icon: '🔭',
    iconName: 'Binoculars',
    tags: [
      { tagKey: 'tourism', tagValue: 'viewpoint' },
    ],
  },
  {
    key: 'bench_picnic',
    label: 'Bench / Picnic',
    icon: '🌿',
    iconName: 'PicnicTable',
    tags: [
      { tagKey: 'amenity', tagValue: 'bench' },
      { tagKey: 'tourism', tagValue: 'picnic_site' },
    ],
  },
  {
    key: 'water',
    label: 'Water',
    icon: '💧',
    iconName: 'Drop',
    tags: [
      { tagKey: 'amenity', tagValue: 'drinking_water' },
    ],
  },
  {
    key: 'bike_repair',
    label: 'Bike Repair',
    icon: '🔧',
    iconName: 'Wrench',
    tags: [
      { tagKey: 'amenity', tagValue: 'bicycle_repair_station' },
    ],
  },
];

function buildQuery(categories, radiusM, coords) {
  const coordStr = coords.flat().join(',');
  const filters = categories.flatMap((cat) =>
    cat.tags.map(
      ({ tagKey, tagValue }) =>
        `  nwr["${tagKey}"="${tagValue}"](around:${radiusM},${coordStr});`
    )
  );
  return `[out:json][timeout:25];\n(\n${filters.join('\n')}\n);\nout center tags;`;
}

function findCategory(tags) {
  for (const cat of POI_CATEGORIES) {
    for (const { tagKey, tagValue } of cat.tags) {
      if (tags[tagKey] === tagValue) return cat;
    }
  }
  return null;
}

function parseResults(elements) {
  return elements.map((el) => {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) return null;

    const tags = el.tags || {};
    const category = findCategory(tags);

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

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[Overpass] HTTP', res.status, body);
    throw new Error(`Overpass API error: HTTP ${res.status}${body ? ' — ' + body.slice(0, 200) : ''}`);
  }

  const data = await res.json();
  return parseResults(data.elements ?? []);
}

