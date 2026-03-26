import { useState, useRef, useCallback } from 'react';
import useTrackStore from '../../store/trackStore';
import Sidebar from '../Sidebar/Sidebar';
import { pathDistanceKm } from '../../utils/geoUtils';

const SNAP_STATES = ['collapsed', 'peek', 'full'];

function formatKm(km) {
  if (km === 0) return null;
  return km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(2)} km`;
}

/**
 * Mobile bottom sheet that wraps the full Sidebar.
 * Three snap states: collapsed (72px) → peek (~45vh) → full (~90vh).
 * The handle uses a topographic contour motif (3 decreasing lines).
 */
export default function MobilePanel() {
  const [snap, setSnap] = useState('collapsed');
  const touchStartY = useRef(null);

  const workingTrack = useTrackStore((s) => s.workingTrack);
  const totalKm = workingTrack.segments.reduce(
    (sum, seg) => sum + pathDistanceKm(seg.points || []),
    0
  );
  const distLabel = formatKm(totalKm);

  const cycleUp = useCallback(() => {
    setSnap((s) => {
      const idx = SNAP_STATES.indexOf(s);
      return SNAP_STATES[Math.min(idx + 1, SNAP_STATES.length - 1)];
    });
  }, []);

  const cycleDown = useCallback(() => {
    setSnap((s) => {
      const idx = SNAP_STATES.indexOf(s);
      return SNAP_STATES[Math.max(idx - 1, 0)];
    });
  }, []);

  const handleTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchCancel = useCallback(() => {
    touchStartY.current = null;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartY.current === null) return;
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    touchStartY.current = null;

    if (Math.abs(delta) < 12) {
      // Tap on handle: cycle up (if collapsed/peek) or collapse (if full)
      if (snap === 'full') setSnap('peek');
      else cycleUp();
    } else if (delta > 40) {
      cycleUp();
    } else if (delta < -40) {
      cycleDown();
    }
  }, [snap, cycleUp, cycleDown]);

  const isExpanded = snap !== 'collapsed';

  return (
    <>
      {/* Dim backdrop when panel is expanded — tap to collapse */}
      {isExpanded && (
        <div
          className="mobile-panel-backdrop"
          onClick={() => setSnap('collapsed')}
          aria-hidden="true"
        />
      )}

      <div className={`mobile-panel mobile-panel--${snap}`} role="complementary" aria-label="Track editor panel">

        {/* ── Handle ── */}
        <div
          className="mobile-panel__handle"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          aria-label={isExpanded ? 'Drag or tap to collapse' : 'Drag or tap to expand'}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') isExpanded ? setSnap('collapsed') : cycleUp();
            if (e.key === 'ArrowUp') cycleUp();
            if (e.key === 'ArrowDown') cycleDown();
          }}
        >
          {/* Topographic contour lines — echoes the sidebar grid texture */}
          <div className="mobile-panel__notch" aria-hidden="true">
            <span className="mobile-panel__notch-line mobile-panel__notch-line--wide" />
            <span className="mobile-panel__notch-line mobile-panel__notch-line--mid" />
            <span className="mobile-panel__notch-line mobile-panel__notch-line--narrow" />
          </div>
        </div>

        {/* ── Collapsed info strip ── */}
        <div
          className="mobile-panel__strip"
          onClick={() => snap === 'collapsed' && cycleUp()}
          role={snap === 'collapsed' ? 'button' : undefined}
          tabIndex={snap === 'collapsed' ? 0 : undefined}
          aria-label={snap === 'collapsed' ? 'Expand track editor' : undefined}
          onKeyDown={snap === 'collapsed' ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleUp(); }
          } : undefined}
        >
          <span className="mobile-panel__track-name">{workingTrack.name}</span>
          {distLabel && (
            <span className="mobile-panel__track-dist">{distLabel}</span>
          )}
          {workingTrack.segments.length > 0 && (
            <span className="mobile-panel__seg-count">
              {workingTrack.segments.length} seg{workingTrack.segments.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            className="mobile-panel__toggle-btn"
            onClick={(e) => { e.stopPropagation(); isExpanded ? setSnap('collapsed') : cycleUp(); }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <span className={`mobile-panel__arrow mobile-panel__arrow--${isExpanded ? 'down' : 'up'}`} />
          </button>
        </div>

        {/* ── Full sidebar content ── */}
        <div className="mobile-panel__content">
          <Sidebar />
        </div>
      </div>
    </>
  );
}
