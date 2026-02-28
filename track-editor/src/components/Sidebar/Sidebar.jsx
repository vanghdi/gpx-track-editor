import useTrackStore from '../../store/trackStore';
import UploadZone from './UploadZone';
import UploadedTrackItem from './UploadedTrackItem';
import WorkingTrackBuilder from './WorkingTrackBuilder';
import DownloadButton from './DownloadButton';

export default function Sidebar() {
  const uploadedTracks = useTrackStore((s) => s.uploadedTracks);
  const clearAll = useTrackStore((s) => s.clearAll);

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <h1 className="sidebar__title">
          <span className="sidebar__title-icon">🗺</span>
          Track Editor
        </h1>
        <button
          className="btn btn--ghost btn--sm"
          title="New working track (clear all)"
          onClick={() => { if (confirm('Clear all uploaded tracks and segments?')) clearAll(); }}
        >
          🗑 New
        </button>
      </div>

      <div className="sidebar__body">
        <div className="section">
          <div className="section__header">
            <h3 className="section__title">Upload Tracks</h3>
          </div>
          <UploadZone />
          {uploadedTracks.length > 0 && (
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
