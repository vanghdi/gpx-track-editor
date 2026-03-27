import { useState, useRef, useCallback } from 'react';
import { X, ArrowUp, CaretUp, CaretDown, FolderSimple } from '@phosphor-icons/react';
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
  const addTracksWithFolders = useTrackStore((s) => s.addTracksWithFolders);
  const clearAll = useTrackStore((s) => s.clearAll);
  const loadProject = useTrackStore((s) => s.loadProject);
  const workingTrack = useTrackStore((s) => s.workingTrack);
  const folders = useTrackStore((s) => s.folders);
  const routingProfile = useTrackStore((s) => s.routingProfile);
  const workingTrackName = useTrackStore((s) => s.workingTrack.name);
  const setWorkingTrackName = useTrackStore((s) => s.setWorkingTrackName);
  const setRoutingProfile = useTrackStore((s) => s.setRoutingProfile);
  const isDownloadReady = useTrackStore((s) => s.isDownloadReady);
  const { theme, toggle: toggleTheme } = useTheme();

  const [tracksOpen, setTracksOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState(null); // parsed flat files awaiting folder pick
  const inputRef = useRef(null);
  const folderInputRef = useRef(null);

  // ── Parse a single GPX file to {name, points} or null ────────────────────────
  const parseGPXFile = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const { name, points } = parseGPX(e.target.result);
          resolve({ name: name || file.name.replace(/\.gpx$/i, ''), points });
        } catch {
          console.error('Failed to parse GPX:', file.name);
          resolve(null);
        }
      };
      reader.readAsText(file);
    });

  // ── Handle .trackeditor file ──────────────────────────────────────────────────
  const handleTrackEditorFile = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (confirm('Load this project? Current work will be replaced.')) {
          loadProject(data);
          onClose();
        }
      } catch {
        alert('Could not read project file.');
      }
    };
    reader.readAsText(file);
  }, [loadProject, onClose]);

  // ── Flat file pick (GPX or .trackeditor, no folder structure) ─────────────────
  const processFiles = useCallback((files) => {
    const arr = Array.from(files);

    // .trackeditor takes priority — process the first one found
    const projectFile = arr.find((f) => f.name.toLowerCase().endsWith('.trackeditor'));
    if (projectFile) {
      const gpxFiles = arr.filter((f) => f.name.toLowerCase().endsWith('.gpx'));
      if (gpxFiles.length > 0) {
        if (!confirm('Loading a project replaces all current data. GPX files in this batch will be ignored.\n\nProceed?')) return;
      }
      handleTrackEditorFile(projectFile);
      return;
    }

    // Regular GPX files — go through FolderPicker (no path info)
    const gpxFiles = arr.filter((f) => f.name.toLowerCase().endsWith('.gpx'));
    if (gpxFiles.length === 0) return;

    let remaining = gpxFiles.length;
    const parsed = [];
    gpxFiles.forEach((file) => {
      parseGPXFile(file).then((result) => {
        if (result) parsed.push(result);
        remaining--;
        if (remaining === 0 && parsed.length > 0) {
          setPendingFiles(parsed);
          setTracksOpen(true);
        }
      });
    });
  }, [handleTrackEditorFile]);

  // ── Folder pick — reads webkitRelativePath for hierarchy ──────────────────────
  const processFolderFiles = useCallback(async (files) => {
    const arr = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.gpx'));
    if (arr.length === 0) return;

    const items = await Promise.all(
      arr.map(async (file) => {
        const result = await parseGPXFile(file);
        if (!result) return null;
        // webkitRelativePath: "FolderA/SubFolder/track.gpx"
        const relPath = file.webkitRelativePath || '';
        const parts = relPath.split('/').filter(Boolean);
        // Drop the filename (last part), keep folder segments
        const pathSegments = parts.length > 1 ? parts.slice(0, -1) : [];
        return { pathSegments, name: result.name, points: result.points };
      })
    );

    const valid = items.filter(Boolean);
    if (valid.length > 0) {
      addTracksWithFolders(valid);
      setTracksOpen(true);
    }
  }, [addTracksWithFolders]);

  // ── Recursive folder traversal for drag-drop (desktop) ───────────────────────
  const traverseEntry = (entry, pathSegments = []) => {
    return new Promise((resolve) => {
      if (entry.isFile) {
        if (!entry.name.toLowerCase().endsWith('.gpx')) return resolve([]);
        entry.file((file) => {
          parseGPXFile(file).then((result) => {
            if (!result) return resolve([]);
            resolve([{ pathSegments, name: result.name, points: result.points }]);
          });
        });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const allEntries = [];
        const readBatch = () => {
          reader.readEntries((batch) => {
            if (batch.length === 0) {
              Promise.all(
                allEntries.map((e) => traverseEntry(e, [...pathSegments, entry.name]))
              ).then((nested) => resolve(nested.flat()));
            } else {
              allEntries.push(...batch);
              readBatch();
            }
          });
        };
        readBatch();
      } else {
        resolve([]);
      }
    });
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  };
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragging(false);

    const items = e.dataTransfer.items ? Array.from(e.dataTransfer.items) : [];
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];

    // Check for .trackeditor in flat files first
    const projectFile = files.find((f) => f.name.toLowerCase().endsWith('.trackeditor'));
    if (projectFile) {
      const gpxFiles = files.filter((f) => f.name.toLowerCase().endsWith('.gpx'));
      if (gpxFiles.length > 0) {
        if (!confirm('Loading a project replaces all current data. GPX files in this batch will be ignored.\n\nProceed?')) return;
      }
      handleTrackEditorFile(projectFile);
      return;
    }

    // Try folder traversal via DataTransferItem.webkitGetAsEntry
    const hasEntryAPI = items.length > 0 && typeof items[0].webkitGetAsEntry === 'function';
    if (hasEntryAPI) {
      const entries = items.map((item) => item.webkitGetAsEntry()).filter(Boolean);
      const hasDir = entries.some((e) => e.isDirectory);

      if (hasDir) {
        const all = await Promise.all(entries.map((entry) => traverseEntry(entry)));
        const flat = all.flat();
        if (flat.length > 0) {
          addTracksWithFolders(flat);
          setTracksOpen(true);
        }
        return;
      }
    }

    // Fallback: flat file list
    processFiles(e.dataTransfer.files);
  }, [handleTrackEditorFile, processFiles, addTracksWithFolders]);

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

  const projectInputRef = useRef(null);

  const handleSaveProject = () => {
    const data = { folders, uploadedTracks, workingTrack, routingProfile };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(workingTrack.name || 'project').replace(/\s+/g, '_')}.trackeditor`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadProject = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (confirm('Load this project? Current work will be replaced.')) {
          loadProject(data);
          onClose();
        }
      } catch {
        alert('Could not read project file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
            <X size={16} weight="bold" />
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
              {theme === 'dark' ? 'Light' : 'Dark'}
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
              {activeLayer === 'osm' ? 'Satellite' : 'Map'}
            </button>
          </div>

          <div className="drawer-section drawer-section--row">
            <span className="drawer-label">Open in</span>
            <button
              className="btn btn--ghost btn--sm"
              onClick={openGoogleMaps}
              title="Open current view in Google Maps"
            >
              Google Maps
            </button>
          </div>

          {/* GPX Tracks */}
          <div className="drawer-section section--upload">
            {/* Flat file picker: GPX + .trackeditor */}
            <input
              ref={inputRef}
              type="file"
              accept=".gpx,.trackeditor"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => { processFiles(e.target.files); e.target.value = ''; }}
            />
            {/* Folder picker: GPX only, desktop only (webkitdirectory) */}
            <input
              ref={folderInputRef}
              type="file"
              // @ts-ignore — webkitdirectory is non-standard
              webkitdirectory=""
              multiple
              style={{ display: 'none' }}
              onChange={(e) => { processFolderFiles(e.target.files); e.target.value = ''; }}
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
                title="Upload GPX or .trackeditor files"
                aria-label="Upload files"
              >
                <ArrowUp size={16} weight="bold" />
              </button>
              <button
                className="upload-header__pick upload-header__pick--folder"
                onClick={() => folderInputRef.current?.click()}
                title="Upload a folder of GPX files (desktop only)"
                aria-label="Upload folder"
              >
                <FolderSimple size={16} weight="bold" />
              </button>
              <span className="upload-header__label">
                Tracks
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
                {tracksOpen ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
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

          {/* Download / Save project */}
          <div className="drawer-section">
            <button
              className={`btn btn--sm btn--full drawer-download${downloadReady ? ' drawer-download--ready' : ''}`}
              onClick={handleDownload}
              disabled={!downloadReady}
              title={downloadReady ? 'Download GPX track' : 'Connect all segments to enable download'}
            >
              Download GPX
            </button>
            <div className="drawer-project-row">
              <button
                className="btn btn--ghost btn--sm"
                style={{ flex: 1 }}
                onClick={handleSaveProject}
                title="Save project as .trackeditor file"
              >
                Save project
              </button>
              <button
                className="btn btn--ghost btn--sm"
                style={{ flex: 1 }}
                onClick={() => projectInputRef.current?.click()}
                title="Load a .trackeditor project file"
              >
                Load project
              </button>
              <input
                ref={projectInputRef}
                type="file"
                accept=".trackeditor,application/json"
                style={{ display: 'none' }}
                onChange={handleLoadProject}
              />
            </div>
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
              New track
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
