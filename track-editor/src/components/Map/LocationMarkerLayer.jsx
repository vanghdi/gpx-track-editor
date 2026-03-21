import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import useTrackStore from '../../store/trackStore';

// Permanent pin icon — coral (#D94854)
const PIN_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
  <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z"
        fill="#D94854" stroke="#fff" stroke-width="1.5"/>
  <circle cx="12" cy="12" r="5" fill="#fff"/>
</svg>`);

// Ghost/preview pin — teal, semi-transparent
const GHOST_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
  <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z"
        fill="#469CA6" stroke="#fff" stroke-width="1.5" opacity="0.6"/>
  <circle cx="12" cy="12" r="5" fill="#fff" opacity="0.6"/>
</svg>`);

const locationIcon = L.icon({
  iconUrl: `data:image/svg+xml,${PIN_SVG}`,
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -38],
});

const ghostIcon = L.icon({
  iconUrl: `data:image/svg+xml,${GHOST_SVG}`,
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -38],
});

export default function LocationMarkerLayer() {
  const locationMarkers    = useTrackStore((s) => s.locationMarkers);
  const removeLocationMarker = useTrackStore((s) => s.removeLocationMarker);
  const previewMarker      = useTrackStore((s) => s.previewMarker);

  return (
    <>
      {/* Ghost preview marker on hover */}
      {previewMarker && (
        <Marker
          key="preview"
          position={[previewMarker.lat, previewMarker.lng]}
          icon={ghostIcon}
          interactive={false}
        />
      )}

      {/* Permanent pinned markers */}
      {locationMarkers.map((marker) => (
        <Marker key={marker.id} position={[marker.lat, marker.lng]} icon={locationIcon}>
          <Popup>
            <div style={{ minWidth: 160, fontFamily: 'sans-serif', fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>
                {marker.label.split(',').slice(0, 3).join(',').trim()}
              </div>
              <button
                onClick={() => removeLocationMarker(marker.id)}
                style={{
                  background: '#D94854',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                Remove
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
