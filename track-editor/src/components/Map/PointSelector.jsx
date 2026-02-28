import { useMapEvents } from 'react-leaflet';
import useTrackStore from '../../store/trackStore';
import { snapToNearest } from '../../utils/geoUtils';

export default function PointSelector() {
  const selectionMode = useTrackStore((s) => s.selectionMode);
  const selectionStart = useTrackStore((s) => s.selectionStart);
  const uploadedTracks = useTrackStore((s) => s.uploadedTracks);
  const setSelectionStart = useTrackStore((s) => s.setSelectionStart);
  const addSegment = useTrackStore((s) => s.addSegment);
  const cancelSelection = useTrackStore((s) => s.cancelSelection);

  useMapEvents({
    click(e) {
      if (!selectionMode) return;

      const snapped = snapToNearest({ lat: e.latlng.lat, lng: e.latlng.lng }, uploadedTracks);
      if (!snapped) return;

      if (selectionMode === 'picking_start') {
        setSelectionStart(snapped);
      } else if (selectionMode === 'picking_end') {
        const start = selectionStart;
        const end = snapped;

        // Build segment — find source track and extract slice
        const sourceTrack = uploadedTracks.find((t) => t.id === start.trackId);
        if (!sourceTrack) { cancelSelection(); return; }

        let points;
        if (start.trackId === end.trackId) {
          // Same track — slice between the two indices
          const [from, to] = start.idx <= end.idx
            ? [start.idx, end.idx]
            : [end.idx, start.idx];
          points = sourceTrack.points.slice(from, to + 1);
        } else {
          // Different tracks — take from start to end of source, then beginning of dest to end point
          const destTrack = uploadedTracks.find((t) => t.id === end.trackId);
          const slice1 = sourceTrack.points.slice(start.idx);
          const slice2 = destTrack ? destTrack.points.slice(0, end.idx + 1) : [];
          points = [...slice1, ...slice2];
        }

        if (points.length < 2) { cancelSelection(); return; }

        addSegment({
          type: 'gpx_slice',
          sourceTrackId: start.trackId,
          startTrackId: start.trackId,
          startIdx: start.idx,
          endTrackId: end.trackId,
          endIdx: end.idx,
          points,
        });
        cancelSelection();
      }
    },

    keydown(e) {
      if (e.originalEvent.key === 'Escape') cancelSelection();
    },
  });

  return null;
}
