import { useState } from 'react';
import { Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import useTrackStore from '../../store/trackStore';
import { getRoute } from '../../utils/routingService';
import { haversineDistance } from '../../utils/geoUtils';

const ROUTED_COLOR = '#D98943';
const LOADING_COLOR = '#94a3b8';
const WEIGHT = 5;

function makeWaypointIcon(isEndpoint) {
  const bg = isEndpoint ? '#D98943' : '#ffffff';
  const border = '#D98943';
  const size = isEndpoint ? 14 : 12;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${bg};border:2.5px solid ${border};
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
      cursor:grab;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const ENDPOINT_ICON = makeWaypointIcon(true);
const MIDPOINT_ICON = makeWaypointIcon(false);

/** Find the best insertion index: insert new waypoint after waypoints[i] where i gives min distance */
function findInsertionIndex(clickLatLng, waypoints) {
  if (waypoints.length <= 1) return 0;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const mid = {
      lat: (waypoints[i].lat + waypoints[i + 1].lat) / 2,
      lng: (waypoints[i].lng + waypoints[i + 1].lng) / 2,
    };
    const d = haversineDistance(clickLatLng, mid);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return bestIdx + 1;
}

function RoutedSegmentItem({ seg }) {
  const updateRoutedSegmentWaypoints = useTrackStore((s) => s.updateRoutedSegmentWaypoints);
  const [loading, setLoading] = useState(false);

  const waypoints = seg.waypoints || (seg.points?.length >= 2
    ? [seg.points[0], seg.points[seg.points.length - 1]]
    : []);

  const routingProfile = useTrackStore((s) => s.routingProfile);

  const reRoute = async (newWaypoints) => {
    if (newWaypoints.length < 2) return;
    setLoading(true);
    try {
      const newPoints = await getRoute(newWaypoints, routingProfile);
      updateRoutedSegmentWaypoints(seg.id, newWaypoints, newPoints);
    } catch {
      // Keep existing route on failure
    } finally {
      setLoading(false);
    }
  };

  const handleWaypointDragEnd = (idx) => (e) => {
    const { lat, lng } = e.target.getLatLng();
    const updated = waypoints.map((wp, i) => (i === idx ? { lat, lng } : wp));
    reRoute(updated);
  };

  const handlePolylineClick = (e) => {
    if (loading) return;
    L.DomEvent.stopPropagation(e);
    const { lat, lng } = e.latlng;
    const insertIdx = findInsertionIndex({ lat, lng }, waypoints);
    const updated = [
      ...waypoints.slice(0, insertIdx),
      { lat, lng },
      ...waypoints.slice(insertIdx),
    ];
    reRoute(updated);
  };

  return (
    <>
      <Polyline
        positions={seg.points.map((p) => [p.lat, p.lng])}
        pathOptions={{
          color: loading ? LOADING_COLOR : ROUTED_COLOR,
          weight: WEIGHT,
          opacity: loading ? 0.5 : 0.9,
          dashArray: loading ? '6 4' : null,
        }}
        eventHandlers={{ click: handlePolylineClick }}
      />
      {waypoints.map((wp, idx) => (
        <Marker
          key={idx}
          position={[wp.lat, wp.lng]}
          icon={idx === 0 || idx === waypoints.length - 1 ? ENDPOINT_ICON : MIDPOINT_ICON}
          draggable
          eventHandlers={{ dragend: handleWaypointDragEnd(idx) }}
        />
      ))}
    </>
  );
}

export default function RoutedSegmentEditor() {
  const segments = useTrackStore((s) => s.workingTrack.segments);
  const routedSegments = segments.filter((s) => s.type === 'routed' && s.points?.length >= 2);
  return routedSegments.map((seg) => <RoutedSegmentItem key={seg.id} seg={seg} />);
}
