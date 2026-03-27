import { useState } from 'react';
import { Eye, EyeSlash, X } from '@phosphor-icons/react';
import useTrackStore from '../../store/trackStore';
import { pathDistanceKm } from '../../utils/geoUtils';

const PALETTE = [
  '#469CA6', '#73B8BF', '#D98943', '#D94854',
  '#7B61FF', '#2ECC71', '#E91E63', '#FF9800',
  '#00BCD4', '#9C27B0',
];

export default function UploadedTrackItem({ track }) {
  const updateTrackName = useTrackStore((s) => s.updateTrackName);
  const updateTrackColor = useTrackStore((s) => s.updateTrackColor);
  const toggleTrackVisibility = useTrackStore((s) => s.toggleTrackVisibility);
  const removeUploadedTrack = useTrackStore((s) => s.removeUploadedTrack);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(track.name);

  const commitName = () => {
    updateTrackName(track.id, nameVal.trim() || track.name);
    setEditingName(false);
  };

  return (
    <div className="track-item">
      <div className="track-item__header">
        <span
          className="track-item__color-dot"
          style={{ background: track.color }}
          title="Track colour"
        />
        <div className="track-item__name">
          {editingName ? (
            <input
              className="track-item__name-input"
              value={nameVal}
              autoFocus
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
            />
          ) : (
            <span
              className="track-item__name-text"
              title="Click to rename"
              onClick={() => setEditingName(true)}
            >
              {track.name}
              {track.points?.length > 1 && (
                <span className="track-item__dist">
                  ({Math.round(pathDistanceKm(track.points))})
                </span>
              )}
            </span>
          )}
        </div>
        <div className="track-item__actions">
          <button
            className={`icon-btn ${track.visible ? '' : 'icon-btn--muted'}`}
            title={track.visible ? 'Hide' : 'Show'}
            onClick={() => toggleTrackVisibility(track.id)}
          >
            {track.visible ? <Eye size={14} weight="regular" /> : <EyeSlash size={14} weight="regular" />}
          </button>
          <button
            className="icon-btn icon-btn--danger"
            title="Remove track"
            onClick={() => removeUploadedTrack(track.id)}
          >
            <X size={12} weight="bold" />
          </button>
        </div>
      </div>

      <div className="track-item__palette">
        {PALETTE.map((c) => (
          <button
            key={c}
            className={`color-swatch ${track.color === c ? 'color-swatch--active' : ''}`}
            style={{ background: c }}
            onClick={() => updateTrackColor(track.id, c)}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}
