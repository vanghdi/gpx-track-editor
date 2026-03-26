import { useState, useEffect, useRef } from 'react';
import { Marker, Polyline, Tooltip } from 'react-leaflet';
import { Fragment } from 'react';
import L from 'leaflet';
import useTrackStore from '../../store/trackStore';
import { getRoute } from '../../utils/routingService';
import { haversineDistance } from '../../utils/geoUtils';

const ROUTED_COLOR = '#D98943';
const LOADING_COLOR = '#94a3b8';
const HALO_COLOR = '#ffffff';
const WEIGHT = 5;
const WEIGHT_HOVERED = 7;
const HALO_WEIGHT = 12;

function makeWaypointIcon(isEndpoint) {
  const bg = isEndpoint ? '#D98943' : '#ffffff';
  const border = '#D98943';
  const dot = isEndpoint ? 14 : 12;
  // 44×44 transparent hit area with dot centered — meets mobile touch target guidelines
  return L.divIcon({
    className: '',
    html: `<div style="
      width:44px;height:44px;
      display:flex;align-items:center;justify-content:center;
    "><div style="
      width:${dot}px;height:${dot}px;border-radius:50%;
      background:${bg};border:2.5px solid ${border};
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
      cursor:grab;
    "></div></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
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

function RoutedSegmentItem({ seg, segNumber }) {
  const updateRoutedSegmentWaypoints = useTrackStore((s) => s.updateRoutedSegmentWaypoints);
  const [loading, setLoading] = useState(false);
  const routingProfile = useTrackStore((s) => s.routingProfile);
  const apiKey = useTrackStore((s) => s.apiKey);
  const hoveredSegmentId = useTrackStore((s) => s.hoveredSegmentId);

  const waypoints = seg.waypoints || (seg.points?.length >= 2
    ? [seg.points[0], seg.points[seg.points.length - 1]]
    : []);

  const reRoute = async (newWaypoints) => {
    if (newWaypoints.length < 2) return;
    setLoading(true);
    try {
      const newPoints = await getRoute(newWaypoints, routingProfile, apiKey);
      updateRoutedSegmentWaypoints(seg.id, newWaypoints, newPoints);
    } catch {
      // Keep existing route on failure
    } finally {
      setLoading(false);
    }
  };

  // Auto-route on mount when segment was just converted from GPX slice
  const autoRouted = useRef(false);
  useEffect(() => {
    if (seg.converted && !autoRouted.current && waypoints.length >= 2) {
      autoRouted.current = true;
      reRoute(waypoints);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const isHovered = hoveredSegmentId === seg.id;
  const positions = seg.points.map((p) => [p.lat, p.lng]);

  return (
    <Fragment>
      {isHovered && (
        <Polyline
          positions={positions}
          pathOptions={{ color: HALO_COLOR, weight: HALO_WEIGHT, opacity: 0.55, interactive: false }}
        />
      )}
      <Polyline
        positions={positions}
        pathOptions={{
          color: loading ? LOADING_COLOR : ROUTED_COLOR,
          weight: isHovered ? WEIGHT_HOVERED : WEIGHT,
          opacity: loading ? 0.5 : isHovered ? 1.0 : 0.9,
          dashArray: loading ? '6 4' : null,
        }}
        eventHandlers={{ click: handlePolylineClick }}
      >
        <Tooltip sticky>#{segNumber} Routed link</Tooltip>
      </Polyline>
      {/* Invisible wide tap-target layer — makes it much easier to tap the line on mobile */}
      <Polyline
        positions={positions}
        pathOptions={{ color: 'transparent', weight: 28, opacity: 0 }}
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
    </Fragment>
  );
}

export default function RoutedSegmentEditor() {
  const segments = useTrackStore((s) => s.workingTrack.segments);
  const routedSegments = segments.filter((s) => s.type === 'routed' && s.points?.length >= 2);
  return routedSegments.map((seg) => {
    const segNumber = segments.findIndex((s) => s.id === seg.id) + 1;
    return <RoutedSegmentItem key={seg.id} seg={seg} segNumber={segNumber} />;
  });
}
