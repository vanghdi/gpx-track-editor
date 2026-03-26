import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import useTrackStore from '../../store/trackStore';
import SegmentItem from './SegmentItem';
import { pathDistanceKm } from '../../utils/geoUtils';
import { ROUTING_PROFILES } from '../../utils/routingService';
import { useUndoRedo } from '../../hooks/useUndoRedo';

function formatKm(km) {
  return km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(2)} km`;
}

const SELECTION_LABELS = {
  picking_start:      'Click map — set start point',
  picking_end:        'Click map — set end point',
  picking_free_start: 'Click anywhere — set free start',
  picking_free_end:   'Click anywhere — set free end',
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
  const reorderSegments = useTrackStore((s) => s.reorderSegments);
  const routingProfile = useTrackStore((s) => s.routingProfile);
  const setRoutingProfile = useTrackStore((s) => s.setRoutingProfile);

  const gapIndices = new Set(getGapIndices());
  const totalKm = segments.reduce((sum, seg) => sum + pathDistanceKm(seg.points || []), 0);
  const hasSegments = segments.length > 0;
  const { canUndo, canRedo, undo, redo } = useUndoRedo();

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  }));

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const fromIdx = segments.findIndex((s) => s.id === active.id);
    const toIdx = segments.findIndex((s) => s.id === over.id);
    if (fromIdx !== -1 && toIdx !== -1) reorderSegments(fromIdx, toIdx);
  };

  const firstIsRouted = segments.length > 0 && segments[0].type === 'routed';
  const lastIsRouted  = segments.length > 0 && segments[segments.length - 1].type === 'routed';
  const showStartPhantom = hasSegments && !firstIsRouted;
  const showEndPhantom   = hasSegments && !lastIsRouted;

  return (
    <div className="section">
      <div className="section__header">
        <h3 className="section__title">Working Track</h3>
        <div className="section__header-actions">
          {totalKm > 0 && (
            <span className="section__distance">{formatKm(totalKm)}</span>
          )}
          <button
            className="undo-btn"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (⌘Z)"
            aria-label="Undo"
          >↩</button>
          <button
            className="undo-btn"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (⌘⇧Z)"
            aria-label="Redo"
          >↪</button>
        </div>
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
        {showStartPhantom && (
          <button
            className="phantom-segment phantom-segment--start"
            onClick={startFreeStartPicking}
            disabled={!!selectionMode}
            title="Route from a free start point to the beginning of this track"
          >
            <span className="phantom-segment__icon">↑</span>
            <span>Navigate to route start</span>
          </button>
        )}

        {hasSegments ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={segments.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {segments.map((seg, i) => (
                <SegmentItem
                  key={seg.id}
                  segment={seg}
                  index={i}
                  isLast={i === segments.length - 1}
                  hasGapAfter={gapIndices.has(i)}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          !showStartPhantom && <p className="empty-hint">No segments yet. Click 'Add Segment' to start.</p>
        )}

        {showEndPhantom && (
          <button
            className="phantom-segment phantom-segment--end"
            onClick={startFreeEndPicking}
            disabled={!!selectionMode}
            title="Route from the end of this track to a free end point"
          >
            <span className="phantom-segment__icon">↓</span>
            <span>Navigate from route end</span>
          </button>
        )}
      </div>

      {selectionMode ? (
        <div className="selection-status">
          <span className="selection-status__text">
            {SELECTION_LABELS[selectionMode] || 'Click map'}
          </span>
          <button className="btn btn--sm btn--ghost" onClick={cancelSelection}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="segment-actions">
          <button
            className="btn btn--primary btn--flex"
            onClick={startSegmentPicking}
          >
            + Add Segment
          </button>
        </div>
      )}
    </div>
  );
}
