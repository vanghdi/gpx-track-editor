import { useState } from 'react';
import { FolderSimple, Check, X } from '@phosphor-icons/react';
import useTrackStore from '../../store/trackStore';

/**
 * Inline folder picker shown after GPX files are parsed.
 * Props:
 *   onConfirm(folderId: string|null) — called with the chosen folder id
 *   onCancel() — called if user dismisses
 */
export default function FolderPicker({ onConfirm, onCancel }) {
  const { folders, addFolder } = useTrackStore();
  const [selected, setSelected] = useState(null); // null = root
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = () => {
    if (!newName.trim()) return;
    addFolder(newName.trim(), null);
    // Select the newly created folder
    // We can't get the id synchronously here, so we just let the user pick it
    setNewName('');
    setCreating(false);
  };

  return (
    <div className="folder-picker">
      <p className="folder-picker-label">Add track to:</p>

      <div className="folder-picker-options">
        <button
          className={`folder-picker-option${selected === null ? ' active' : ''}`}
          onClick={() => setSelected(null)}
        >
          <FolderSimple size={13} weight="regular" /> Root
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            className={`folder-picker-option${selected === f.id ? ' active' : ''}`}
            onClick={() => setSelected(f.id)}
          >
            <FolderSimple size={13} weight="regular" /> {f.name}
          </button>
        ))}
      </div>

      {creating ? (
        <div className="folder-picker-new">
          <input
            className="folder-inline-input"
            placeholder="Folder name"
            value={newName}
            autoFocus
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
          />
          <button className="folder-icon-btn" onClick={handleCreate}><Check size={13} weight="bold" /></button>
          <button className="folder-icon-btn" onClick={() => setCreating(false)}><X size={12} weight="bold" /></button>
        </div>
      ) : (
        <button className="folder-picker-new-btn" onClick={() => setCreating(true)}>
          + New folder
        </button>
      )}

      <div className="folder-picker-footer">
        <button className="folder-picker-cancel" onClick={onCancel}>Cancel</button>
        <button className="folder-picker-confirm" onClick={() => onConfirm(selected)}>Add</button>
      </div>
    </div>
  );
}
