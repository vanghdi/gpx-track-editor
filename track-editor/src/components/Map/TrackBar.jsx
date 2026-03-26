import { useState } from 'react';
import useTrackStore from '../../store/trackStore';
import { getRoute } from '../../utils/routingService';
import { pathDistanceKm } from '../../utils/geoUtils';

function formatDist(km) {
  return km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(2)} km`;
}

const SELECTION_LABELS = {
  picking_start:      '🎯 Click map — set start point',
  picking_end:        '🎯 Click map — set end point',
  picking_free_start: '📍 Click anywhere — set free start',
  picking_free_end:   '📍 Click anywhere — set free end',
};

/**
 * Gap pill shown between two disconnected segments.
 * Tapping "Route" fills the gap via ORS.
 */
function GapPill({ segIndex }) {
  const segments = useTrackStore((s) => s.workingTrack.segments);
  const insertSegmentAt = useTrackStore((s) => s.insertSegmentAt);
  const routingProfile = useTrackStore((s) => s.routingProfile);
  const apiKey = useTrackStore((s) => s.apiKey);
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState(null);

  const handleRoute = async () => {
    setRouting(true);
    setError(null);
    try {
      const from = segments[segIndex];
      const to = segments[segIndex + 1];
      const fromPt = from.points[from.points.length - 1];
      const toPt = to.points[0];
      const points = await getRoute([fromPt, toPt], routingProfile, apiKey);
      insertSegmentAt(segIndex, { type: 'routed', points, waypoints: [fromPt, toPt] });
    } catch (e) {
      setError(e.message || 'Routing failed');
      setTimeout(() => setError(null), 3000);
    } finally {
      setRouting(false);
    }
  };

  return (
    <div className="track-bar__gap-pill" title={error || undefined}>
      {error ? (
        <span className="track-bar__gap-error">!</span>
      ) : (
        <button
          className="track-bar__gap-route"
          onClick={handleRoute}
          disabled={routing}
          title="Route this gap"
        >
          {routing ? '…' : 'Route'}
        </button>
      )}
    </div>
  );
}

/**
 * A single segment pill in the horizontal track bar.
 */
function SegmentPill({ segment, index }) {
  const removeSegment = useTrackStore((s) => s.removeSegment);
  const hoveredSegmentId = useTrackStore((s) => s.hoveredSegmentId);
  const setHoveredSegmentId = useTrackStore((s) => s.setHoveredSegmentId);

  const dist = formatDist(pathDistanceKm(segment.points || []));
  const isRouted = segment.type === 'routed';
  const isActive = hoveredSegmentId === segment.id;

  return (
    <div
      className={`track-bar__pill${isRouted ? ' track-bar__pill--routed' : ''}${isActive ? ' track-bar__pill--active' : ''}`}
      onMouseEnter={() => setHoveredSegmentId(segment.id)}
      onMouseLeave={() => setHoveredSegmentId(null)}
      onTouchStart={() => setHoveredSegmentId(segment.id)}
      onTouchEnd={() => setHoveredSegmentId(null)}
    >
      <span className="track-bar__pill-num">#{index + 1}</span>
      <span className="track-bar__pill-dist">{dist}</span>
      <button
        className="track-bar__pill-remove"
        onClick={(e) => { e.stopPropagation(); removeSegment(segment.id); }}
        aria-label={`Remove segment ${index + 1}`}
        title="Remove segment"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Phantom pill — appears at start or end of the bar when a free
 * routed connection to the track start/end is possible.
 */
function PhantomPill({ position, onClick, disabled }) {
  return (
    <button
      className={`track-bar__phantom track-bar__phantom--${position}`}
      onClick={onClick}
      disabled={disabled}
      title={position === 'start' ? 'Navigate to route start' : 'Navigate from route end'}
    >
      {position === 'start' ? 'start' : 'end'}
    </button>
  );
}

/**
 * Horizontal track editor bar pinned to the bottom of the map.
 * States:
 *   - normal: scrollable segment pills + + button
 *   - picking: status message + cancel (full width)
 *   - empty: just the + button
 */
export default function TrackBar() {
  const segments = useTrackStore((s) => s.workingTrack.segments);
  const selectionMode = useTrackStore((s) => s.selectionMode);
  const startSegmentPicking = useTrackStore((s) => s.startSegmentPicking);
  const startFreeStartPicking = useTrackStore((s) => s.startFreeStartPicking);
  const startFreeEndPicking = useTrackStore((s) => s.startFreeEndPicking);
  const cancelSelection = useTrackStore((s) => s.cancelSelection);
  const getGapIndices = useTrackStore((s) => s.getGapIndices);

  const gapIndices = new Set(getGapIndices());
  const hasSegments = segments.length > 0;

  const firstIsRouted = hasSegments && segments[0].type === 'routed';
  const lastIsRouted  = hasSegments && segments[segments.length - 1].type === 'routed';
  const showStartPhantom = hasSegments && !firstIsRouted;
  const showEndPhantom   = hasSegments && !lastIsRouted;

  // ── Picking mode — bar shows status + cancel ──────────────────
  if (selectionMode) {
    return (
      <div className="track-bar track-bar--picking">
        <span className="track-bar__picking-label">
          {SELECTION_LABELS[selectionMode] || '🎯 Click map'}
        </span>
        <button
          className="track-bar__cancel"
          onClick={cancelSelection}
        >
          Cancel
        </button>
      </div>
    );
  }

  // ── Normal bar ────────────────────────────────────────────────
  return (
    <div className="track-bar">
      {/* Add segment button */}
      <button
        className="track-bar__add"
        onClick={startSegmentPicking}
        title="Add segment"
        aria-label="Add segment"
      >
        <span>+</span>
      </button>

      {/* Scrollable segment track */}
      {hasSegments ? (
        <div className="track-bar__scroll">
          <div className="track-bar__scroll-inner">
            {showStartPhantom && (
              <PhantomPill
                position="start"
                onClick={startFreeStartPicking}
                disabled={!!selectionMode}
              />
            )}

            {segments.map((seg, i) => (
              <div key={seg.id} className="track-bar__seg-group">
                <SegmentPill segment={seg} index={i} />
                {gapIndices.has(i) && <GapPill segIndex={i} />}
              </div>
            ))}

            {showEndPhantom && (
              <PhantomPill
                position="end"
                onClick={startFreeEndPicking}
                disabled={!!selectionMode}
              />
            )}
          </div>
        </div>
      ) : (
        <span className="track-bar__hint">Add a segment to start building your track</span>
      )}
    </div>
  );
}
