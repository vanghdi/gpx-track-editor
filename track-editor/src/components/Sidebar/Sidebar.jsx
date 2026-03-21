import { useState } from 'react';
import useTrackStore from '../../store/trackStore';
import UploadZone from './UploadZone';
import UploadedTrackItem from './UploadedTrackItem';
import WorkingTrackBuilder from './WorkingTrackBuilder';
import DownloadButton from './DownloadButton';
import ApiKeySettings from './ApiKeySettings';
import { useTheme } from '../../hooks/useTheme';

export default function Sidebar() {
  const uploadedTracks = useTrackStore((s) => s.uploadedTracks);
  const clearAll = useTrackStore((s) => s.clearAll);
  const [tracksOpen, setTracksOpen] = useState(true);
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <h1 className="sidebar__title">
          <span className="sidebar__title-icon">🗺</span>
          Track Editor
        </h1>
        <button
          className="btn btn--ghost btn--sm"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀' : '◑'}
        </button>
        <button
          className="btn btn--ghost btn--sm"
          title="New working track (clear all)"
          onClick={() => { if (confirm('Clear all uploaded tracks and segments?')) clearAll(); }}
        >
          🗑 New
        </button>
      </div>

      <div className="sidebar__body">
        <ApiKeySettings />

        <div className="section">
          <button
            className="settings-toggle"
            onClick={() => setTracksOpen((o) => !o)}
            aria-expanded={tracksOpen}
          >
            <span>
              Upload Tracks
              {uploadedTracks.length > 0 && (
                <span style={{ marginLeft: 6, color: 'var(--text-dim)', fontSize: 10 }}>
                  ({uploadedTracks.length})
                </span>
              )}
            </span>
            <span className="settings-toggle__chevron">{tracksOpen ? '▲' : '▼'}</span>
          </button>

          {tracksOpen && (
            <>
              <div style={{ padding: '6px 12px 4px' }}>
                <UploadZone />
              </div>
              {uploadedTracks.length > 0 && (
                <div className="track-list">
                  {uploadedTracks.map((track) => (
                    <UploadedTrackItem key={track.id} track={track} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <WorkingTrackBuilder />
      </div>

      <div className="sidebar__footer">
        <DownloadButton />
      </div>
    </aside>
  );
}
