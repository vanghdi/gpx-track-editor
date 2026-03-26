import { useState, useRef } from 'react';
import useTrackStore from '../../store/trackStore';
import UploadedTrackItem from './UploadedTrackItem';
import WorkingTrackBuilder from './WorkingTrackBuilder';
import DownloadButton from './DownloadButton';
import ApiKeySettings from './ApiKeySettings';
import { useTheme } from '../../hooks/useTheme';
import { parseGPX } from '../../utils/gpxParser';

export default function Sidebar() {
  const uploadedTracks = useTrackStore((s) => s.uploadedTracks);
  const addUploadedTrack = useTrackStore((s) => s.addUploadedTrack);
  const clearAll = useTrackStore((s) => s.clearAll);
  const [tracksOpen, setTracksOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const { theme, toggle: toggleTheme } = useTheme();

  const processFiles = (files) => {
    Array.from(files).forEach((file) => {
      if (!file.name.toLowerCase().endsWith('.gpx')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const { name, points } = parseGPX(e.target.result);
          addUploadedTrack(name || file.name.replace('.gpx', ''), points);
        } catch {
          console.error('Failed to parse GPX:', file.name);
        }
      };
      reader.readAsText(file);
    });
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  };

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
          onClick={() => {
            if (confirm('Clear all uploaded tracks and segments?')) {
              clearAll();
            }
          }}
        >
          New
        </button>
      </div>

      <div className="sidebar__body">
        <ApiKeySettings />

        <div className="section section--upload">
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
              title={tracksOpen ? 'Collapse track list' : 'Expand track list'}
            >
              {tracksOpen ? '▲' : '▼'}
            </button>
          </div>

          {tracksOpen && uploadedTracks.length > 0 && (
            <div className="track-list">
              {uploadedTracks.map((track) => (
                <UploadedTrackItem key={track.id} track={track} />
              ))}
            </div>
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
