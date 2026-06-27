import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X } from '@phosphor-icons/react';
import useTrackStore from '../../store/trackStore';
import { getRoute } from '../../utils/routingService';
import { isLoopTrack, pathDistanceKm } from '../../utils/geoUtils';

function formatKm(km) {
  return km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(2)} km`;
}

export default function SegmentItem({ segment, index, isLast, hasGapAfter }) {
  const removeSegment = useTrackStore((s) => s.removeSegment);
  const insertSegmentAt = useTrackStore((s) => s.insertSegmentAt);
  const updateGpxSliceMode = useTrackStore((s) => s.updateGpxSliceMode);
  const segments = useTrackStore((s) => s.workingTrack.segments);
  const uploadedTracks = useTrackStore((s) => s.uploadedTracks);
  const routingProfile = useTrackStore((s) => s.routingProfile);
  const apiKey = useTrackStore((s) => s.apiKey);
  const hoveredSegmentId = useTrackStore((s) => s.hoveredSegmentId);
  const setHoveredSegmentId = useTrackStore((s) => s.setHoveredSegmentId);
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: segment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  const typeLabel = segment.type === 'routed' ? 'Routed link' : `GPX segment${segment.converted ? ' ~' : ''}`;
  const sourceTrack = segment.startTrackId != null
    ? uploadedTracks.find((track) => track.id === segment.startTrackId)
    : null;
  const canToggleWrap = (
    segment.type === 'gpx_slice' &&
    segment.startTrackId != null &&
    segment.startTrackId === segment.endTrackId &&
    !!sourceTrack &&
    isLoopTrack(sourceTrack)
  );
  const usesWrappedPath = canToggleWrap && segment.sameTrackMode === 'wrap';

  const handleRouteGap = async () => {
    setRouting(true);
    setError(null);
    try {
      const fromSeg = segments[index];
      const toSeg = segments[index + 1];
      const from = fromSeg.points[fromSeg.points.length - 1];
      const to = toSeg.points[0];
      const points = await getRoute([from, to], routingProfile, apiKey);
      insertSegmentAt(index, { type: 'routed', points, waypoints: [from, to] });
    } catch (e) {
      setError(e.message || 'Routing failed.');
    } finally {
      setRouting(false);
    }
  };

  const isActive = hoveredSegmentId === segment.id;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`segment-item${segment.type === 'routed' ? ' segment-item--routed' : ''}${isDragging ? ' segment-item--dragging' : ''}${isActive ? ' segment-item--active' : ''}`}
        onMouseEnter={() => setHoveredSegmentId(segment.id)}
        onMouseLeave={() => setHoveredSegmentId(null)}
      >
        <button className="drag-handle" {...attributes} {...listeners} title="Drag to reorder">
          ⠿
        </button>
        <span className="segment-item__badge">#{index + 1}</span>
        <span className="segment-item__label">{typeLabel}</span>
        <span className="segment-item__count">{formatKm(pathDistanceKm(segment.points))}</span>
        <button
          className="icon-btn icon-btn--danger"
          title="Remove segment"
          onClick={() => removeSegment(segment.id)}
        >
          <X size={12} weight="bold" />
        </button>
      </div>

      {canToggleWrap && (
        <div className="segment-item__subactions">
          <button
            className={`btn btn--ghost btn--sm${usesWrappedPath ? ' segment-item__loop-toggle--active' : ''}`}
            onClick={() => updateGpxSliceMode(segment.id, usesWrappedPath ? 'direct' : 'wrap')}
            title={usesWrappedPath ? 'Switch to the direct path between these loop points' : 'Wrap across the loop closure instead of taking the direct path'}
          >
            {usesWrappedPath ? 'Using wrapped loop path' : 'Use wrapped loop path'}
          </button>
        </div>
      )}

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
    </div>
  );
}
