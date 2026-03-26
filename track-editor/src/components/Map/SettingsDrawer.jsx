import { useState, useRef, useCallback } from 'react';
import useTrackStore from '../../store/trackStore';
import { useTheme } from '../../hooks/useTheme';
import { parseGPX } from '../../utils/gpxParser';
import { exportGPX } from '../../utils/gpxExporter';
import ApiKeySettings from '../Sidebar/ApiKeySettings';
import FolderTree from '../Sidebar/FolderTree';
import FolderPicker from '../Sidebar/FolderPicker';
import { ROUTING_PROFILES } from '../../utils/routingService';

/**
 * Slide-in settings drawer, triggered by the hamburger button in MapChrome.
 * Contains: app name, theme, track name, routing, GPX tracks, map controls, API key.
 */
export default function SettingsDrawer({ open, onClose, activeLayer, onToggleLayer, mapView }) {
  const uploadedTracks = useTrackStore((s) => s.uploadedTracks);
  const addUploadedTrack = useTrackStore((s) => s.addUploadedTrack);
  const clearAll = useTrackStore((s) => s.clearAll);
  const workingTrack = useTrackStore((s) => s.workingTrack);
  const workingTrackName = useTrackStore((s) => s.workingTrack.name);
  const setWorkingTrackName = useTrackStore((s) => s.setWorkingTrackName);
  const routingProfile = useTrackStore((s) => s.routingProfile);
  const setRoutingProfile = useTrackStore((s) => s.setRoutingProfile);
  const isDownloadReady = useTrackStore((s) => s.isDownloadReady);
  const { theme, toggle: toggleTheme } = useTheme();

  const [tracksOpen, setTracksOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState(null); // parsed files awaiting folder pick
  const inputRef = useRef(null);

  const processFiles = useCallback((files) => {
    const parsed = [];
    let remaining = 0;
    Array.from(files).forEach((file) => {
      if (!file.name.toLowerCase().endsWith('.gpx')) return;
      remaining++;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const { name, points } = parseGPX(e.target.result);
          parsed.push({ name: name || file.name.replace('.gpx', ''), points });
        } catch {
          console.error('Failed to parse GPX:', file.name);
        }
        remaining--;
        if (remaining === 0 && parsed.length > 0) {
          setPendingFiles(parsed);
          setTracksOpen(true);
        }
      };
      reader.readAsText(file);
    });
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const openGoogleMaps = () => {
    if (!mapView) return;
    const { lat, lng, zoom } = mapView;
    window.open(`https://www.google.com/maps/@${lat},${lng},${zoom}z`, '_blank', 'noopener');
  };

  const downloadReady = isDownloadReady();
  const handleDownload = () => {
    const xml = exportGPX(workingTrack.name, workingTrack.segments);
    const blob = new Blob([xml], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(workingTrack.name || 'track').replace(/\s+/g, '_')}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="drawer-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`settings-drawer${open ? ' settings-drawer--open' : ''}`}
        aria-label="Settings"
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="settings-drawer__header">
          <h1 className="settings-drawer__title">Track Editor</h1>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close settings"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="settings-drawer__body">

          {/* Track name */}
          <div className="drawer-section">
            <label className="drawer-label">Track name</label>
            <input
              className="input"
              value={workingTrackName}
              onChange={(e) => setWorkingTrackName(e.target.value)}
              placeholder="Track name"
            />
          </div>

          {/* Routing profile */}
          <div className="drawer-section">
            <label className="drawer-label">Routing profile</label>
            <select
              className="select"
              value={routingProfile}
              onChange={(e) => setRoutingProfile(e.target.value)}
            >
              {ROUTING_PROFILES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Appearance */}
          <div className="drawer-section drawer-section--row">
            <span className="drawer-label">Appearance</span>
            <button
              className="btn btn--ghost btn--sm"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '☀ Light' : '◑ Dark'}
            </button>
          </div>

          {/* Map controls */}
          <div className="drawer-section drawer-section--row">
            <span className="drawer-label">Map layer</span>
            <button
              className="btn btn--ghost btn--sm"
              onClick={onToggleLayer}
              title={`Switch to ${activeLayer === 'osm' ? 'Satellite' : 'OSM Map'}`}
            >
              {activeLayer === 'osm' ? '🛰 Satellite' : '🗺 Map'}
            </button>
          </div>

          <div className="drawer-section drawer-section--row">
            <span className="drawer-label">Open in</span>
            <button
              className="btn btn--ghost btn--sm"
              onClick={openGoogleMaps}
              title="Open current view in Google Maps"
            >
              🌐 Google Maps
            </button>
          </div>

          {/* GPX Tracks */}
          <div className="drawer-section section--upload">
            <input
              ref={inputRef}
              type="file"
              accept=".gpx"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => processFiles(e.target.files)}
            />
            <div
              className={`upload-header${dragging ? ' upload-header--drag' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <button
                className="upload-header__pick"
                onClick={() => inputRef.current?.click()}
                title="Upload GPX files"
                aria-label="Upload GPX files"
              >
                📂
              </button>
              <span className="upload-header__label">
                GPX Tracks
                {uploadedTracks.length > 0 && (
                  <span className="upload-header__count">({uploadedTracks.length})</span>
                )}
              </span>
              <button
                className="upload-header__collapse"
                onClick={() => setTracksOpen((o) => !o)}
                aria-expanded={tracksOpen}
                aria-label="Toggle track list"
              >
                {tracksOpen ? '▲' : '▼'}
              </button>
            </div>

            {tracksOpen && pendingFiles && (
              <FolderPicker
                onConfirm={(folderId) => {
                  pendingFiles.forEach(({ name, points }) => addUploadedTrack(name, points, folderId));
                  setPendingFiles(null);
                }}
                onCancel={() => setPendingFiles(null)}
              />
            )}

            {tracksOpen && !pendingFiles && (
              <FolderTree />
            )}
          </div>

          {/* API Key */}
          <ApiKeySettings />

          {/* Download */}
          <div className="drawer-section">
            <button
              className={`btn btn--sm btn--full drawer-download${downloadReady ? ' drawer-download--ready' : ''}`}
              onClick={handleDownload}
              disabled={!downloadReady}
              title={downloadReady ? 'Download GPX track' : 'Connect all segments to enable download'}
            >
              ⬇ Download GPX
            </button>
          </div>

          {/* Danger zone */}
          <div className="drawer-section">
            <button
              className="btn btn--ghost btn--sm btn--full"
              style={{ color: 'var(--coral)', borderColor: 'var(--coral-dim)' }}
              onClick={() => {
                if (confirm('Clear all uploaded tracks and segments?')) {
                  clearAll();
                  onClose();
                }
              }}
            >
              🗑 New track (clear all)
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
