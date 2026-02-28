import { useRef } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import useTrackStore from '../../store/trackStore';
import { snapToNearest } from '../../utils/geoUtils';

// Custom round handle icon
function makeHandleIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:16px;height:16px;border-radius:50%;
      background:${color};border:2.5px solid #D94854;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
      cursor:grab;
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const START_ICON = makeHandleIcon('#ffffff');
const END_ICON = makeHandleIcon('#D94854');

export default function SegmentEndpointEditor() {
  const segments = useTrackStore((s) => s.workingTrack.segments);
  const selectionMode = useTrackStore((s) => s.selectionMode);
  const updateSegmentEndpoints = useTrackStore((s) => s.updateSegmentEndpoints);
  const uploadedTracks = useTrackStore((s) => s.uploadedTracks);

  if (selectionMode) return null;

  const gpxSegments = segments.filter(
    (s) => s.type === 'gpx_slice' && s.startTrackId != null && s.points?.length >= 2
  );

  return gpxSegments.flatMap((seg) => {
    const firstPt = seg.points[0];
    const lastPt = seg.points[seg.points.length - 1];

    const handleDragEnd = (isStart) => (e) => {
      const { lat, lng } = e.target.getLatLng();
      const trackId = isStart ? seg.startTrackId : seg.endTrackId;
      const snapped = snapToNearest(
        { lat, lng },
        uploadedTracks.filter((t) => t.id === trackId)
      );
      if (!snapped) return;

      const newStartIdx = isStart ? snapped.idx : seg.startIdx;
      const newEndIdx = isStart ? seg.endIdx : snapped.idx;
      updateSegmentEndpoints(seg.id, seg.startTrackId, newStartIdx, seg.endTrackId, newEndIdx);
    };

    return [
      <Marker
        key={`${seg.id}-start`}
        position={[firstPt.lat, firstPt.lng]}
        icon={START_ICON}
        draggable
        eventHandlers={{ dragend: handleDragEnd(true) }}
      />,
      <Marker
        key={`${seg.id}-end`}
        position={[lastPt.lat, lastPt.lng]}
        icon={END_ICON}
        draggable
        eventHandlers={{ dragend: handleDragEnd(false) }}
      />,
    ];
  });
}
