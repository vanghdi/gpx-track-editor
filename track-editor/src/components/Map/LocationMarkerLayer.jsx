import { Marker, Tooltip } from 'react-leaflet';
import { useMemo } from 'react';
import L from 'leaflet';
import useTrackStore from '../../store/trackStore';

// Custom pin icon using the theme coral/red colour (#D94854)
const PIN_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
  <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z"
        fill="#D94854" stroke="#fff" stroke-width="1.5"/>
  <circle cx="12" cy="12" r="5" fill="#fff"/>
</svg>`);

const locationIcon = L.icon({
  iconUrl: `data:image/svg+xml,${PIN_SVG}`,
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  tooltipAnchor: [0, -36],
});

export default function LocationMarkerLayer() {
  const locationMarkers = useTrackStore((s) => s.locationMarkers);

  return locationMarkers.map((marker) => (
    <Marker key={marker.id} position={[marker.lat, marker.lng]} icon={locationIcon}>
      <Tooltip permanent={false} direction="top">
        {marker.label}
      </Tooltip>
    </Marker>
  ));
}
