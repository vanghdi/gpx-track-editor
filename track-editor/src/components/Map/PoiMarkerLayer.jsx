import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import useTrackStore from '../../store/trackStore';

const POI_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
  <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z"
        fill="#D98943" stroke="#fff" stroke-width="1.5"/>
  <circle cx="12" cy="12" r="5" fill="#fff"/>
</svg>`);

const poiIcon = L.icon({
  iconUrl: `data:image/svg+xml,${POI_SVG}`,
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -38],
});

export default function PoiMarkerLayer() {
  const poiMarkers        = useTrackStore((s) => s.poiMarkers);
  const addLocationMarker = useTrackStore((s) => s.addLocationMarker);

  if (!poiMarkers.length) return null;

  return (
    <>
      {poiMarkers.map((poi) => (
        <Marker key={poi.id} position={[poi.lat, poi.lng]} icon={poiIcon}>
          <Popup maxWidth={240} minWidth={180}>
            <div style={{ fontFamily: 'sans-serif', fontSize: 13, lineHeight: 1.4 }}>
              {/* Name + category */}
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                {poi.categoryIcon} {poi.name}
              </div>
              {poi.categoryLabel && (
                <div style={{ color: '#888', fontSize: 11, marginBottom: 6 }}>
                  {poi.categoryLabel}
                </div>
              )}

              {/* Address */}
              {(poi.tags.street || poi.tags.city) && (
                <div style={{ marginBottom: 4 }}>
                  📍 {[poi.tags.houseNumber, poi.tags.street, poi.tags.city].filter(Boolean).join(' ')}
                </div>
              )}

              {/* Opening hours */}
              {poi.tags.openingHours && (
                <div style={{ marginBottom: 4 }}>🕐 {poi.tags.openingHours}</div>
              )}

              {/* Phone */}
              {poi.tags.phone && (
                <div style={{ marginBottom: 4 }}>
                  📞 <a href={`tel:${poi.tags.phone}`} style={{ color: '#469CA6' }}>{poi.tags.phone}</a>
                </div>
              )}

              {/* Website */}
              {poi.tags.website && (
                <div style={{ marginBottom: 6 }}>
                  🌐{' '}
                  <a
                    href={poi.tags.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#469CA6' }}
                  >
                    {poi.tags.website.replace(/^https?:\/\//, '').split('/')[0]}
                  </a>
                </div>
              )}

              {/* External links */}
              <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
                <a
                  href={`https://www.google.com/maps?q=${poi.lat},${poi.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  Google Maps
                </a>
                <a
                  href={`https://www.openstreetmap.org/${poi.osmType}/${poi.osmId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  OSM
                </a>
              </div>

              {/* Save as waypoint */}
              <button
                onClick={() =>
                  addLocationMarker({
                    id: crypto.randomUUID(),
                    placeId: `osm-${poi.osmType}-${poi.osmId}`,
                    label: poi.name,
                    lat: poi.lat,
                    lng: poi.lng,
                  })
                }
                style={saveButtonStyle}
              >
                📍 Save as waypoint
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

const linkStyle = {
  fontSize: 11,
  color: '#469CA6',
  textDecoration: 'none',
  border: '1px solid rgba(69,156,165,0.5)',
  borderRadius: 3,
  padding: '2px 7px',
};

const saveButtonStyle = {
  width: '100%',
  background: '#D94854',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  padding: '5px 10px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
};
