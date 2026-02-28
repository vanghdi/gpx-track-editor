import { useMapEvents } from 'react-leaflet';
import useTrackStore from '../../store/trackStore';
import { snapToNearest } from '../../utils/geoUtils';
import { getRoute } from '../../utils/routingService';

export default function PointSelector() {
  const selectionMode = useTrackStore((s) => s.selectionMode);
  const selectionStart = useTrackStore((s) => s.selectionStart);
  const uploadedTracks = useTrackStore((s) => s.uploadedTracks);
  const setSelectionStart = useTrackStore((s) => s.setSelectionStart);
  const addSegment = useTrackStore((s) => s.addSegment);
  const prependSegment = useTrackStore((s) => s.prependSegment);
  const cancelSelection = useTrackStore((s) => s.cancelSelection);
  const routingProfile = useTrackStore((s) => s.routingProfile);
  const apiKey = useTrackStore((s) => s.apiKey);

  useMapEvents({
    async click(e) {
      if (!selectionMode) return;

      const latlng = { lat: e.latlng.lat, lng: e.latlng.lng };

      // ── Free start segment: user picks free point → route to first segment ──
      if (selectionMode === 'picking_free_start') {
        cancelSelection();
        const segments = useTrackStore.getState().workingTrack.segments;
        if (!segments.length) return;
        const firstPt = segments[0].points[0];
        try {
          const points = await getRoute([latlng, firstPt], routingProfile, apiKey);
          prependSegment({ type: 'routed', points, waypoints: [latlng, firstPt] });
        } catch (err) {
          console.error('Free start routing failed:', err.message);
        }
        return;
      }

      // ── Free end segment: route from last segment → user-picked free point ──
      if (selectionMode === 'picking_free_end') {
        cancelSelection();
        const segments = useTrackStore.getState().workingTrack.segments;
        if (!segments.length) return;
        const lastSeg = segments[segments.length - 1];
        const lastPt = lastSeg.points[lastSeg.points.length - 1];
        try {
          const points = await getRoute([lastPt, latlng], routingProfile, apiKey);
          addSegment({ type: 'routed', points, waypoints: [lastPt, latlng] });
        } catch (err) {
          console.error('Free end routing failed:', err.message);
        }
        return;
      }

      // ── Normal GPX segment picking ───────────────────────────────────────────
      const snapped = snapToNearest(latlng, uploadedTracks);
      if (!snapped) return;

      if (selectionMode === 'picking_start') {
        setSelectionStart(snapped);
      } else if (selectionMode === 'picking_end') {
        const start = selectionStart;
        const end = snapped;

        const sourceTrack = uploadedTracks.find((t) => t.id === start.trackId);
        if (!sourceTrack) { cancelSelection(); return; }

        let points;
        if (start.trackId === end.trackId) {
          const [from, to] = start.idx <= end.idx
            ? [start.idx, end.idx]
            : [end.idx, start.idx];
          points = sourceTrack.points.slice(from, to + 1);
        } else {
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
