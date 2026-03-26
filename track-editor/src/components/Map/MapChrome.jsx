import { useState, useEffect } from 'react';
import useTrackStore from '../../store/trackStore';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { pathDistanceKm } from '../../utils/geoUtils';
import SettingsDrawer from './SettingsDrawer';

function formatDist(km) {
  if (km < 1) return { value: (km * 1000).toFixed(0), unit: 'm' };
  return { value: km.toFixed(2), unit: 'km' };
}

/**
 * Fixed top-left chrome overlay:
 * - Hamburger → settings drawer (closes on Escape)
 * - Undo / Redo buttons (top-right, 2 buttons only)
 * Download lives in TrackBar; search lives below undo/redo in MapSearchOverlay.
 */
export default function MapChrome({ activeLayer, onToggleLayer }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { canUndo, canRedo, undo, redo } = useUndoRedo();
  const mapView = useTrackStore((s) => s.mapView);
  const segments = useTrackStore((s) => s.workingTrack.segments);

  const totalKm = segments.reduce((sum, s) => sum + pathDistanceKm(s.points || []), 0);

  // Close drawer on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {/* Hamburger — top left */}
      <button
        className="map-chrome__hamburger"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open settings"
        title="Settings"
      >
        <span className="map-chrome__hamburger-lines" aria-hidden="true">
          <span /><span /><span />
        </span>
      </button>

      {/* Undo / Redo — top right */}
      <div className="map-chrome__actions">
        <button
          className="map-chrome__btn"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (⌘Z)"
          aria-label="Undo"
        >
          ↩
        </button>
        <button
          className="map-chrome__btn"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (⌘⇧Z)"
          aria-label="Redo"
        >
          ↪
        </button>
        {segments.length > 0 && (() => {
          const { value, unit } = formatDist(totalKm);
          return (
            <span className="map-chrome__total" title="Total track length">
              <span className="map-chrome__total-value">{value}</span>
              <span className="map-chrome__total-unit">{unit}</span>
            </span>
          );
        })()}
      </div>

      <SettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeLayer={activeLayer}
        onToggleLayer={onToggleLayer}
        mapView={mapView}
      />
    </>
  );
}
