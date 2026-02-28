import { useState } from 'react';
import useTrackStore from '../../store/trackStore';
import { getRoute } from '../../utils/routingService';
import { pathDistanceKm } from '../../utils/geoUtils';

function formatKm(km) {
  return km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(2)} km`;
}

export default function SegmentItem({ segment, index, isLast, hasGapAfter }) {
  const removeSegment = useTrackStore((s) => s.removeSegment);
  const insertSegmentAt = useTrackStore((s) => s.insertSegmentAt);
  const segments = useTrackStore((s) => s.workingTrack.segments);
  const routingProfile = useTrackStore((s) => s.routingProfile);
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState(null);

  const label = segment.type === 'routed' ? `🔗 Routed link` : `📍 GPX segment ${index + 1}`;

  const handleRouteGap = async () => {
    setRouting(true);
    setError(null);
    try {
      const fromSeg = segments[index];
      const toSeg = segments[index + 1];
      const from = fromSeg.points[fromSeg.points.length - 1];
      const to = toSeg.points[0];
      const points = await getRoute([from, to], routingProfile);
      insertSegmentAt(index, { type: 'routed', points, waypoints: [from, to] });
    } catch (e) {
      setError(e.message || 'Routing failed.');
    } finally {
      setRouting(false);
    }
  };

  return (
    <>
      <div className={`segment-item ${segment.type === 'routed' ? 'segment-item--routed' : ''}`}>
        <span className="segment-item__label">{label}</span>
        <span className="segment-item__count">{formatKm(pathDistanceKm(segment.points))}</span>
        <button
          className="icon-btn icon-btn--danger"
          title="Remove segment"
          onClick={() => removeSegment(segment.id)}
        >
          ✕
        </button>
      </div>

      {hasGapAfter && (
        <div className="gap-indicator">
          <span className="gap-indicator__label">⚠ Gap</span>
          {error && <span className="gap-indicator__error">{error}</span>}
          <button
            className="btn btn--sm btn--accent"
            disabled={routing}
            onClick={handleRouteGap}
          >
            {routing ? 'Routing…' : 'Route gap'}
          </button>
        </div>
      )}
    </>
  );
}
