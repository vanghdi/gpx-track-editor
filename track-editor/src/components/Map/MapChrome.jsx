import { useState } from 'react';
import useTrackStore from '../../store/trackStore';
import { exportGPX } from '../../utils/gpxExporter';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import SettingsDrawer from './SettingsDrawer';

/**
 * Fixed top-left chrome overlay:
 * - Hamburger → settings drawer
 * - Undo / Redo / Download buttons (top-right)
 */
export default function MapChrome({ activeLayer, onToggleLayer }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { canUndo, canRedo, undo, redo } = useUndoRedo();
  const workingTrack = useTrackStore((s) => s.workingTrack);
  const isDownloadReady = useTrackStore((s) => s.isDownloadReady);
  const mapView = useTrackStore((s) => s.mapView);

  const ready = isDownloadReady();

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

      {/* Action buttons — top right */}
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
        <button
          className={`map-chrome__btn map-chrome__btn--download${ready ? ' map-chrome__btn--ready' : ''}`}
          onClick={handleDownload}
          disabled={!ready}
          title={ready ? 'Download GPX' : 'Connect all segments to enable download'}
          aria-label="Download GPX"
        >
          ⬇
        </button>
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
