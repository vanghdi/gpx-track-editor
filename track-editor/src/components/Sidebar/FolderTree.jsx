import { useState } from 'react';
import useTrackStore from '../../store/trackStore';

/** Single uploaded track row inside the folder tree */
function TrackRow({ track }) {
  const { removeUploadedTrack, updateTrackName, updateTrackColor, toggleTrackVisibility, folders, moveTrackToFolder } = useTrackStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(track.name);
  const [showMove, setShowMove] = useState(false);

  const commitRename = () => {
    if (draft.trim()) updateTrackName(track.id, draft.trim());
    else setDraft(track.name);
    setEditing(false);
  };

  return (
    <div className="folder-track-row">
      <span className="folder-track-dot" style={{ background: track.color }} />

      {editing ? (
        <input
          className="folder-inline-input"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setDraft(track.name); setEditing(false); } }}
        />
      ) : (
        <span className="folder-track-name" title={track.name} onDoubleClick={() => setEditing(true)}>
          {track.name}
        </span>
      )}

      <div className="folder-track-actions">
        <input
          type="color"
          className="folder-color-swatch"
          value={track.color}
          title="Change colour"
          onChange={(e) => updateTrackColor(track.id, e.target.value)}
        />
        <button
          className="folder-icon-btn"
          title={track.visible ? 'Hide' : 'Show'}
          onClick={() => toggleTrackVisibility(track.id)}
        >
          {track.visible ? '👁' : '🙈'}
        </button>
        <button
          className="folder-icon-btn"
          title="Move to folder"
          onClick={() => setShowMove((v) => !v)}
        >
          📂
        </button>
        <button
          className="folder-icon-btn folder-icon-btn--danger"
          title="Remove track"
          onClick={() => removeUploadedTrack(track.id)}
        >
          ✕
        </button>
      </div>

      {showMove && (
        <div className="folder-move-popup">
          <button
            className={`folder-move-option${track.folderId === null ? ' active' : ''}`}
            onClick={() => { moveTrackToFolder(track.id, null); setShowMove(false); }}
          >
            Root
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              className={`folder-move-option${track.folderId === f.id ? ' active' : ''}`}
              onClick={() => { moveTrackToFolder(track.id, f.id); setShowMove(false); }}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Recursive folder node */
function FolderNode({ folder, depth = 0, allFolders, allTracks }) {
  const { renameFolder, deleteFolder, addFolder, toggleFolderCollapsed } = useTrackStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(folder.name);

  const children = allFolders.filter((f) => f.parentId === folder.id);
  const tracks = allTracks.filter((t) => t.folderId === folder.id);

  const commitRename = () => {
    if (draft.trim()) renameFolder(folder.id, draft.trim());
    else setDraft(folder.name);
    setEditing(false);
  };

  return (
    <div className="folder-node" style={{ '--depth': depth }}>
      <div className="folder-node-header">
        <button
          className="folder-toggle"
          onClick={() => toggleFolderCollapsed(folder.id)}
          aria-label={folder.collapsed ? 'Expand' : 'Collapse'}
        >
          {folder.collapsed ? '▶' : '▼'}
        </button>

        {editing ? (
          <input
            className="folder-inline-input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setDraft(folder.name); setEditing(false); } }}
          />
        ) : (
          <span className="folder-node-name" onDoubleClick={() => setEditing(true)}>
            📁 {folder.name}
          </span>
        )}

        <div className="folder-node-actions">
          <button className="folder-icon-btn" title="Add subfolder" onClick={() => addFolder('New folder', folder.id)}>
            +📁
          </button>
          <button className="folder-icon-btn folder-icon-btn--danger" title="Delete folder" onClick={() => deleteFolder(folder.id)}>
            ✕
          </button>
        </div>
      </div>

      {!folder.collapsed && (
        <div className="folder-node-children">
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              allFolders={allFolders}
              allTracks={allTracks}
            />
          ))}
          {tracks.map((t) => <TrackRow key={t.id} track={t} />)}
        </div>
      )}
    </div>
  );
}

/** Top-level folder tree rendered in the settings drawer */
export default function FolderTree() {
  const { folders, uploadedTracks, addFolder } = useTrackStore();

  const rootFolders = folders.filter((f) => f.parentId === null);
  const rootTracks = uploadedTracks.filter((t) => t.folderId === null);

  return (
    <div className="folder-tree">
      {rootFolders.map((f) => (
        <FolderNode
          key={f.id}
          folder={f}
          depth={0}
          allFolders={folders}
          allTracks={uploadedTracks}
        />
      ))}

      {rootTracks.map((t) => <TrackRow key={t.id} track={t} />)}

      {uploadedTracks.length === 0 && (
        <p className="folder-empty-hint">No GPX tracks loaded yet.</p>
      )}

      <button className="folder-add-root-btn" onClick={() => addFolder('New folder', null)}>
        + New folder
      </button>
    </div>
  );
}
