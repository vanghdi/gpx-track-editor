import { Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import useTrackStore from '../../store/trackStore';
import SegmentEndpointEditor from './SegmentEndpointEditor';
import RoutedSegmentEditor from './RoutedSegmentEditor';

const GPX_SLICE_COLOR = '#D94854';
const WEIGHT = 5;

export default function WorkingTrackLayer() {
  const segments = useTrackStore((s) => s.workingTrack.segments);
  const selectionStart = useTrackStore((s) => s.selectionStart);
  const selectionMode = useTrackStore((s) => s.selectionMode);
  const convertSegmentToRouted = useTrackStore((s) => s.convertSegmentToRouted);

  const handleGpxClick = (seg) => (e) => {
    // Don't interfere with segment picking modes
    if (selectionMode) return;
    L.DomEvent.stopPropagation(e);
    convertSegmentToRouted(seg.id, e.latlng.lat, e.latlng.lng);
  };

  return (
    <>
      {/* GPX slice segments — clickable to convert to routed */}
      {segments
        .filter((seg) => seg.type === 'gpx_slice')
        .map((seg) => (
          <Polyline
            key={seg.id}
            positions={seg.points.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: GPX_SLICE_COLOR, weight: WEIGHT, opacity: 0.9 }}
            eventHandlers={{ click: handleGpxClick(seg) }}
          >
            <Tooltip sticky>Click to make this segment editable</Tooltip>
          </Polyline>
        ))}

      {/* Routed segments — managed by RoutedSegmentEditor */}
      <RoutedSegmentEditor />

      {/* Draggable endpoint handles for GPX slices */}
      <SegmentEndpointEditor />

      {selectionStart && (
        <CircleMarker
          center={[selectionStart.lat, selectionStart.lng]}
          radius={8}
          pathOptions={{ color: '#fff', fillColor: GPX_SLICE_COLOR, fillOpacity: 1, weight: 2 }}
        >
          <Tooltip permanent>Start point</Tooltip>
        </CircleMarker>
      )}
    </>
  );
}
