import useTrackStore from '../../store/trackStore';
import SegmentItem from './SegmentItem';
import { pathDistanceKm } from '../../utils/geoUtils';
import { ROUTING_PROFILES } from '../../utils/routingService';

function formatKm(km) {
  return km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(2)} km`;
}

const SELECTION_LABELS = {
  picking_start:      '🎯 Click map — set start point',
  picking_end:        '🎯 Click map — set end point',
  picking_free_start: '📍 Click anywhere — set free start',
  picking_free_end:   '📍 Click anywhere — set free end',
};

export default function WorkingTrackBuilder() {
  const segments = useTrackStore((s) => s.workingTrack.segments);
  const workingTrackName = useTrackStore((s) => s.workingTrack.name);
  const setWorkingTrackName = useTrackStore((s) => s.setWorkingTrackName);
  const selectionMode = useTrackStore((s) => s.selectionMode);
  const startSegmentPicking = useTrackStore((s) => s.startSegmentPicking);
  const startFreeStartPicking = useTrackStore((s) => s.startFreeStartPicking);
  const startFreeEndPicking = useTrackStore((s) => s.startFreeEndPicking);
  const cancelSelection = useTrackStore((s) => s.cancelSelection);
  const getGapIndices = useTrackStore((s) => s.getGapIndices);
  const routingProfile = useTrackStore((s) => s.routingProfile);
  const setRoutingProfile = useTrackStore((s) => s.setRoutingProfile);

  const gapIndices = new Set(getGapIndices());
  const totalKm = segments.reduce((sum, seg) => sum + pathDistanceKm(seg.points || []), 0);
  const hasSegments = segments.length > 0;

  return (
    <div className="section">
      <div className="section__header">
        <h3 className="section__title">Working Track</h3>
        {totalKm > 0 && (
          <span className="section__distance">{formatKm(totalKm)}</span>
        )}
      </div>

      <div className="working-track-name">
        <input
          className="input"
          value={workingTrackName}
          onChange={(e) => setWorkingTrackName(e.target.value)}
          placeholder="Track name"
        />
      </div>

      <div className="routing-profile">
        <label className="routing-profile__label">Routing</label>
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

      <div className="segments-list">
        {!hasSegments ? (
          <p className="empty-hint">No segments yet. Click 'Add Segment' to start.</p>
        ) : (
          segments.map((seg, i) => (
            <SegmentItem
              key={seg.id}
              segment={seg}
              index={i}
              isLast={i === segments.length - 1}
              hasGapAfter={gapIndices.has(i)}
            />
          ))
        )}
      </div>

      {selectionMode ? (
        <div className="selection-status">
          <span className="selection-status__text">
            {SELECTION_LABELS[selectionMode] || '🎯 Click map'}
          </span>
          <button className="btn btn--sm btn--ghost" onClick={cancelSelection}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="segment-actions">
          {hasSegments && (
            <button
              className="btn btn--ghost btn--sm"
              title="Route from a free start point to the beginning of this track"
              onClick={startFreeStartPicking}
            >
              ← Start
            </button>
          )}
          <button
            className="btn btn--primary btn--flex"
            onClick={startSegmentPicking}
          >
            + Add Segment
          </button>
          {hasSegments && (
            <button
              className="btn btn--ghost btn--sm"
              title="Route from the end of this track to a free end point"
              onClick={startFreeEndPicking}
            >
              End →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
