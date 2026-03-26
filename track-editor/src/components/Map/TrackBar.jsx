import { useState } from 'react';
import useTrackStore from '../../store/trackStore';
import { exportGPX } from '../../utils/gpxExporter';
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

/** Gap pill shown between two disconnected segments. */
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
        <button className="track-bar__gap-route" onClick={handleRoute} disabled={routing} title="Route this gap">
          {routing ? '…' : 'Route'}
        </button>
      )}
    </div>
  );
}

/**
 * A single segment pill.
 * In reorder mode: tapping selects it (highlighted ring). Remove button hidden.
 */
function SegmentPill({ segment, index, reorderMode, isSelected, onSelect }) {
  const removeSegment = useTrackStore((s) => s.removeSegment);
  const hoveredSegmentId = useTrackStore((s) => s.hoveredSegmentId);
  const setHoveredSegmentId = useTrackStore((s) => s.setHoveredSegmentId);

  const dist = formatDist(pathDistanceKm(segment.points || []));
  const isRouted = segment.type === 'routed';
  const isActive = !reorderMode && hoveredSegmentId === segment.id;

  const handleClick = (e) => {
    e.stopPropagation();
    if (reorderMode) {
      onSelect(index);
    }
  };

  return (
    <div
      className={[
        'track-bar__pill',
        isRouted ? 'track-bar__pill--routed' : '',
        isActive ? 'track-bar__pill--active' : '',
        reorderMode ? 'track-bar__pill--reorder' : '',
        isSelected ? 'track-bar__pill--selected' : '',
      ].filter(Boolean).join(' ')}
      onClick={handleClick}
      onMouseEnter={() => !reorderMode && setHoveredSegmentId(segment.id)}
      onMouseLeave={() => !reorderMode && setHoveredSegmentId(null)}
    >
      <span className="track-bar__pill-num">#{index + 1}</span>
      <span className="track-bar__pill-dist">{dist}</span>
      {!reorderMode && (
        <button
          className="track-bar__pill-remove"
          onClick={(e) => { e.stopPropagation(); removeSegment(segment.id); }}
          aria-label={`Remove segment ${index + 1}`}
          title="Remove segment"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** Phantom pill — appears at start or end of the bar. */
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

/** Horizontal track editor bar pinned to the bottom of the map. */
export default function TrackBar() {
  const segments = useTrackStore((s) => s.workingTrack.segments);
  const workingTrack = useTrackStore((s) => s.workingTrack);
  const selectionMode = useTrackStore((s) => s.selectionMode);
  const startSegmentPicking = useTrackStore((s) => s.startSegmentPicking);
  const startFreeStartPicking = useTrackStore((s) => s.startFreeStartPicking);
  const startFreeEndPicking = useTrackStore((s) => s.startFreeEndPicking);
  const cancelSelection = useTrackStore((s) => s.cancelSelection);
  const getGapIndices = useTrackStore((s) => s.getGapIndices);
  const isDownloadReady = useTrackStore((s) => s.isDownloadReady);
  const reorderSegments = useTrackStore((s) => s.reorderSegments);

  const [reorderMode, setReorderMode] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);

  const gapIndices = new Set(getGapIndices());
  const hasSegments = segments.length > 0;
  const downloadReady = isDownloadReady();
  const totalKm = segments.reduce((sum, s) => sum + pathDistanceKm(s.points || []), 0);

  const firstIsRouted = hasSegments && segments[0].type === 'routed';
  const lastIsRouted  = hasSegments && segments[segments.length - 1].type === 'routed';
  const showStartPhantom = hasSegments && !firstIsRouted && !reorderMode;
  const showEndPhantom   = hasSegments && !lastIsRouted  && !reorderMode;

  const handleDownload = () => {
    const xml = exportGPX(workingTrack.name, workingTrack.segments);
    const blob = new Blob([xml], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workingTrack.name.replace(/\s+/g, '_') || 'track'}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReorderToggle = () => {
    setReorderMode((v) => !v);
    setSelectedIndex(null);
  };

  const handleSelect = (index) => {
    setSelectedIndex((prev) => prev === index ? null : index);
  };

  const handleMove = (direction) => {
    if (selectedIndex === null) return;
    const newIndex = selectedIndex + direction;
    if (newIndex < 0 || newIndex >= segments.length) return;
    reorderSegments(selectedIndex, newIndex);
    setSelectedIndex(newIndex);
  };

  // ── Picking mode ──────────────────────────────────────────────
  if (selectionMode) {
    return (
      <div className="track-bar track-bar--picking">
        <span className="track-bar__picking-label">
          {SELECTION_LABELS[selectionMode] || '🎯 Click map'}
        </span>
        <button className="track-bar__cancel" onClick={cancelSelection}>
          Cancel
        </button>
      </div>
    );
  }

  // ── Normal bar ────────────────────────────────────────────────
  return (
    <div className={`track-bar${reorderMode ? ' track-bar--reorder' : ''}`}>

      {/* Reorder mode: ← button (left of scroll) */}
      {reorderMode && (
        <button
          className="track-bar__move-btn"
          onClick={() => handleMove(-1)}
          disabled={selectedIndex === null || selectedIndex === 0}
          title="Move selected segment left"
          aria-label="Move left"
        >
          ←
        </button>
      )}

      {/* Scrollable segment track */}
      {hasSegments ? (
        <div className="track-bar__scroll">
          <div className="track-bar__scroll-inner">
            {showStartPhantom && (
              <PhantomPill position="start" onClick={startFreeStartPicking} disabled={!!selectionMode} />
            )}
            {segments.map((seg, i) => (
              <div key={seg.id} style={{ display: 'contents' }}>
                <SegmentPill
                  segment={seg}
                  index={i}
                  reorderMode={reorderMode}
                  isSelected={selectedIndex === i}
                  onSelect={handleSelect}
                />
                {!reorderMode && gapIndices.has(i) && <GapPill segIndex={i} />}
              </div>
            ))}
            {showEndPhantom && (
              <PhantomPill position="end" onClick={startFreeEndPicking} disabled={!!selectionMode} />
            )}
          </div>
        </div>
      ) : (
        <span className="track-bar__hint">Add a segment to start building your track</span>
      )}

      {/* Reorder mode: → button (right of scroll) */}
      {reorderMode && (
        <button
          className="track-bar__move-btn"
          onClick={() => handleMove(1)}
          disabled={selectedIndex === null || selectedIndex === segments.length - 1}
          title="Move selected segment right"
          aria-label="Move right"
        >
          →
        </button>
      )}

      {/* Total distance */}
      {hasSegments && (
        <span className="track-bar__total" title="Total track length">
          {formatDist(totalKm)}
        </span>
      )}

      {/* Reorder toggle — only shown when 2+ segments */}
      {segments.length >= 2 && (
        <button
          className={`track-bar__reorder-toggle${reorderMode ? ' track-bar__reorder-toggle--active' : ''}`}
          onClick={handleReorderToggle}
          title={reorderMode ? 'Done reordering' : 'Reorder segments'}
          aria-label="Toggle reorder mode"
        >
          ⇄
        </button>
      )}

      {/* Add + Download — hidden in reorder mode */}
      {!reorderMode && (
        <>
          <button
            className="track-bar__add"
            onClick={startSegmentPicking}
            title="Add segment"
            aria-label="Add segment"
          >
            <span>+</span>
          </button>
          <button
            className={`track-bar__download${downloadReady ? ' track-bar__download--ready' : ''}`}
            onClick={handleDownload}
            disabled={!downloadReady}
            title={downloadReady ? 'Download GPX' : 'Connect all segments to enable download'}
            aria-label="Download GPX"
          >
            ⬇
          </button>
        </>
      )}
    </div>
  );
}
