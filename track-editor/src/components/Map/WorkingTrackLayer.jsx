import { Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import { Fragment } from 'react';
import L from 'leaflet';
import useTrackStore from '../../store/trackStore';
import SegmentEndpointEditor from './SegmentEndpointEditor';
import RoutedSegmentEditor from './RoutedSegmentEditor';

const GPX_SLICE_COLOR = '#D94854';
const HALO_COLOR = '#ffffff';
const WEIGHT = 5;
const WEIGHT_HOVERED = 7;
const HALO_WEIGHT = 12;

export default function WorkingTrackLayer() {
  const segments = useTrackStore((s) => s.workingTrack.segments);
  const selectionStart = useTrackStore((s) => s.selectionStart);
  const selectionMode = useTrackStore((s) => s.selectionMode);
  const convertSegmentToRouted = useTrackStore((s) => s.convertSegmentToRouted);
  const hoveredSegmentId = useTrackStore((s) => s.hoveredSegmentId);

  const handleGpxClick = (seg) => (e) => {
    // Don't interfere with segment picking modes
    if (selectionMode) return;
    L.DomEvent.stopPropagation(e);
    convertSegmentToRouted(seg.id, e.latlng.lat, e.latlng.lng);
  };

  const gpxSegments = segments.filter((seg) => seg.type === 'gpx_slice');

  return (
    <>
      {/* GPX slice segments — clickable to convert to routed */}
      {gpxSegments.map((seg) => {
        const segNumber = segments.findIndex((s) => s.id === seg.id) + 1;
        const isHovered = hoveredSegmentId === seg.id;
        const positions = seg.points.map((p) => [p.lat, p.lng]);
        return (
          <Fragment key={seg.id}>
            {isHovered && (
              <Polyline
                positions={positions}
                pathOptions={{ color: HALO_COLOR, weight: HALO_WEIGHT, opacity: 0.55, interactive: false }}
              />
            )}
            <Polyline
              positions={positions}
              pathOptions={{
                color: GPX_SLICE_COLOR,
                weight: isHovered ? WEIGHT_HOVERED : WEIGHT,
                opacity: isHovered ? 1.0 : 0.9,
              }}
              eventHandlers={{ click: handleGpxClick(seg) }}
            >
              <Tooltip sticky>#{segNumber} GPX segment · Click to edit</Tooltip>
            </Polyline>
          </Fragment>
        );
      })}

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
