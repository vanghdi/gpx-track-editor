import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { areConnected } from '../utils/geoUtils';

// Distinct colours for uploaded tracks — high-contrast on OSM light basemap
const TRACK_COLORS = [
  '#E63946', // vivid red
  '#2563EB', // electric blue
  '#16A34A', // strong green
  '#9333EA', // violet
  '#EA580C', // deep orange
  '#0891B2', // cyan
  '#CA8A04', // gold
  '#DB2777', // pink
  '#059669', // emerald
  '#7C3AED', // indigo
];

let colorIdx = 0;
const nextColor = () => TRACK_COLORS[colorIdx++ % TRACK_COLORS.length];

/** Ensure routed segments always have a waypoints array */
function normaliseSegment(seg) {
  if (seg.type === 'routed' && !seg.waypoints) {
    const pts = seg.points || [];
    return { ...seg, waypoints: pts.length >= 2 ? [pts[0], pts[pts.length - 1]] : [] };
  }
  return seg;
}

/** IndexedDB storage adapter for Zustand persist */
const idbStorage = createJSONStorage(() => ({
  getItem: (name) => idbGet(name).then((v) => v ?? null),
  setItem: (name, value) => idbSet(name, value),
  removeItem: (name) => idbDel(name),
}));

const useTrackStore = create(
  persist(
    (set, get) => ({
  // ── Folders ───────────────────────────────────────────────────────────────────
  folders: [],

  addFolder: (name, parentId = null) =>
    set((state) => ({
      folders: [
        ...state.folders,
        { id: crypto.randomUUID(), name, parentId, collapsed: false },
      ],
    })),

  renameFolder: (id, name) =>
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    })),

  deleteFolder: (id) =>
    set((state) => {
      // Collect all descendant folder ids
      const allIds = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        state.folders.forEach((f) => {
          if (f.parentId && allIds.has(f.parentId) && !allIds.has(f.id)) {
            allIds.add(f.id);
            changed = true;
          }
        });
      }
      return {
        folders: state.folders.filter((f) => !allIds.has(f.id)),
        // Move tracks from deleted folders to root
        uploadedTracks: state.uploadedTracks.map((t) =>
          allIds.has(t.folderId) ? { ...t, folderId: null } : t
        ),
      };
    }),

  toggleFolderCollapsed: (id) =>
    set((state) => ({
      folders: state.folders.map((f) =>
        f.id === id ? { ...f, collapsed: !f.collapsed } : f
      ),
    })),

  moveTrackToFolder: (trackId, folderId) =>
    set((state) => ({
      uploadedTracks: state.uploadedTracks.map((t) =>
        t.id === trackId ? { ...t, folderId: folderId ?? null } : t
      ),
    })),

  // ── Uploaded tracks ──────────────────────────────────────────────────────────
  uploadedTracks: [],

  addUploadedTrack: (name, points, folderId = null) =>
    set((state) => ({
      uploadedTracks: [
        ...state.uploadedTracks,
        {
          id: crypto.randomUUID(),
          name,
          color: nextColor(),
          points,
          visible: false,
          folderId: folderId ?? null,
        },
      ],
    })),

  removeUploadedTrack: (id) =>
    set((state) => ({
      uploadedTracks: state.uploadedTracks.filter((t) => t.id !== id),
    })),

  /**
   * Bulk-import tracks with optional folder paths.
   * items: [{ pathSegments: string[], name: string, points: [] }]
   * pathSegments is the folder hierarchy (empty = root).
   * Folders are find-or-created by name+parentId.
   */
  addTracksWithFolders: (items) =>
    set((state) => {
      const folders = [...state.folders];
      const uploadedTracks = [...state.uploadedTracks];

      // Find or create a folder by name under parentId
      const findOrCreate = (name, parentId) => {
        const existing = folders.find(
          (f) => f.name === name && (f.parentId ?? null) === (parentId ?? null)
        );
        if (existing) return existing.id;
        const id = crypto.randomUUID();
        folders.push({ id, name, parentId: parentId ?? null, collapsed: false });
        return id;
      };

      items.forEach(({ pathSegments, name, points }) => {
        let folderId = null;
        for (const seg of (pathSegments || [])) {
          folderId = findOrCreate(seg, folderId);
        }
        uploadedTracks.push({
          id: crypto.randomUUID(),
          name,
          color: nextColor(),
          points,
          visible: false,
          folderId,
        });
      });

      return { folders, uploadedTracks };
    }),

  updateTrackName: (id, name) =>
    set((state) => ({
      uploadedTracks: state.uploadedTracks.map((t) =>
        t.id === id ? { ...t, name } : t
      ),
    })),

  updateTrackColor: (id, color) =>
    set((state) => ({
      uploadedTracks: state.uploadedTracks.map((t) =>
        t.id === id ? { ...t, color } : t
      ),
    })),

  toggleTrackVisibility: (id) =>
    set((state) => ({
      uploadedTracks: state.uploadedTracks.map((t) =>
        t.id === id ? { ...t, visible: !t.visible } : t
      ),
    })),

  toggleFolderVisibility: (folderId) =>
    set((state) => {
      // Collect folder id + all descendant folder ids
      const ids = new Set([folderId]);
      let changed = true;
      while (changed) {
        changed = false;
        state.folders.forEach((f) => {
          if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
            ids.add(f.id);
            changed = true;
          }
        });
      }
      const affected = state.uploadedTracks.filter((t) => ids.has(t.folderId));
      const allVisible = affected.length > 0 && affected.every((t) => t.visible);
      const nextVisible = !allVisible;
      return {
        uploadedTracks: state.uploadedTracks.map((t) =>
          ids.has(t.folderId) ? { ...t, visible: nextVisible } : t
        ),
      };
    }),

  // ── Working track ─────────────────────────────────────────────────────────────
  workingTrack: { name: 'My Track', segments: [] },
  // Undo/redo history — NOT persisted (transient)
  _wt_history: [],
  _wt_future: [],

  setWorkingTrackName: (name) =>
    set((state) => ({
      _wt_history: [...state._wt_history.slice(-29), state.workingTrack],
      _wt_future: [],
      workingTrack: { ...state.workingTrack, name },
    })),

  addSegment: (segment) =>
    set((state) => ({
      _wt_history: [...state._wt_history.slice(-29), state.workingTrack],
      _wt_future: [],
      workingTrack: {
        ...state.workingTrack,
        segments: [...state.workingTrack.segments, normaliseSegment({ ...segment, id: crypto.randomUUID() })],
      },
    })),

  removeSegment: (id) =>
    set((state) => ({
      _wt_history: [...state._wt_history.slice(-29), state.workingTrack],
      _wt_future: [],
      workingTrack: {
        ...state.workingTrack,
        segments: state.workingTrack.segments.filter((s) => s.id !== id),
      },
    })),

  reorderSegments: (fromIndex, toIndex) =>
    set((state) => {
      const segs = [...state.workingTrack.segments];
      const [moved] = segs.splice(fromIndex, 1);
      segs.splice(toIndex, 0, moved);
      return {
        _wt_history: [...state._wt_history.slice(-29), state.workingTrack],
        _wt_future: [],
        workingTrack: { ...state.workingTrack, segments: segs },
      };
    }),

  insertSegmentAt: (index, segment) =>
    set((state) => {
      const segs = state.workingTrack.segments;
      return {
        _wt_history: [...state._wt_history.slice(-29), state.workingTrack],
        _wt_future: [],
        workingTrack: {
          ...state.workingTrack,
          segments: [
            ...segs.slice(0, index + 1),
            normaliseSegment({ ...segment, id: crypto.randomUUID() }),
            ...segs.slice(index + 1),
          ],
        },
      };
    }),

  updateSegmentEndpoints: (id, startTrackId, startIdx, endTrackId, endIdx) =>
    set((state) => {
      const uploadedTracks = state.uploadedTracks;
      const startTrack = uploadedTracks.find((t) => t.id === startTrackId);
      const endTrack = uploadedTracks.find((t) => t.id === endTrackId);
      if (!startTrack) return state;

      let points;
      if (startTrackId === endTrackId) {
        const [from, to] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        points = startTrack.points.slice(from, to + 1);
      } else {
        points = [
          ...startTrack.points.slice(startIdx),
          ...(endTrack ? endTrack.points.slice(0, endIdx + 1) : []),
        ];
      }
      if (points.length < 2) return state;

      return {
        _wt_history: [...state._wt_history.slice(-29), state.workingTrack],
        _wt_future: [],
        workingTrack: {
          ...state.workingTrack,
          segments: state.workingTrack.segments.map((s) =>
            s.id === id
              ? { ...s, startTrackId, startIdx, endTrackId, endIdx, points }
              : s
          ),
        },
      };
    }),

  updateRoutedSegmentWaypoints: (id, newWaypoints, newPoints) =>
    set((state) => ({
      _wt_history: [...state._wt_history.slice(-29), state.workingTrack],
      _wt_future: [],
      workingTrack: {
        ...state.workingTrack,
        segments: state.workingTrack.segments.map((s) =>
          s.id === id ? { ...s, waypoints: newWaypoints, points: newPoints } : s
        ),
      },
    })),

  replaceSegment: (id, newSegment) =>
    set((state) => ({
      _wt_history: [...state._wt_history.slice(-29), state.workingTrack],
      _wt_future: [],
      workingTrack: {
        ...state.workingTrack,
        segments: state.workingTrack.segments.map((s) =>
          s.id === id ? { ...newSegment, id } : s
        ),
      },
    })),

  // ── Map view (transient — not persisted) ─────────────────────────────────────
  mapView: { lat: 50.82, lng: 5.6, zoom: 13 },
  setMapView: (lat, lng, zoom) => set({ mapView: { lat, lng, zoom } }),

  // ── Location markers (pinned search results) ──────────────────────────────────
  locationMarkers: [],

  addLocationMarker: (marker) =>
    set((state) => ({
      locationMarkers: [
        ...state.locationMarkers,
        { ...marker, id: marker.id ?? crypto.randomUUID() },
      ],
    })),

  removeLocationMarker: (id) =>
    set((state) => ({
      locationMarkers: state.locationMarkers.filter((m) => m.id !== id),
    })),

  clearLocationMarkers: () => set({ locationMarkers: [] }),

  // ── POI markers (Overpass API results — amber pins) ───────────────────────────
  poiMarkers: [],
  addPoiMarkers: (markers) => set({ poiMarkers: markers }),
  clearPoiMarkers: () => set({ poiMarkers: [] }),

  // ── Preview marker (hover over search result — transient) ─────────────────────
  previewMarker: null,
  setPreviewMarker: (marker) => set({ previewMarker: marker }),

  // ── Hovered segment (transient — not persisted) ───────────────────────────────
  hoveredSegmentId: null,
  setHoveredSegmentId: (id) => set({ hoveredSegmentId: id }),

  // ── Center map request (transient — triggers MapCenterer, then cleared) ───────
  centerMapOn: null, // { lat, lng } or null
  setCenterMapOn: (lat, lng) => set({ centerMapOn: { lat, lng } }),
  clearCenterMapOn: () => set({ centerMapOn: null }),

  // ── API key ───────────────────────────────────────────────────────────────────
  apiKey: '',
  setApiKey: (key) => set({ apiKey: key }),

  // ── Routing settings ─────────────────────────────────────────────────────────
  routingProfile: 'cycling-mountain',
  setRoutingProfile: (profile) => set({ routingProfile: profile }),

  // ── Selection mode for picking segment endpoints (transient) ─────────────────
  selectionMode: null,
  selectionStart: null,

  startSegmentPicking: () =>
    set({ selectionMode: 'picking_start', selectionStart: null }),

  startFreeStartPicking: () =>
    set({ selectionMode: 'picking_free_start', selectionStart: null }),

  startFreeEndPicking: () =>
    set({ selectionMode: 'picking_free_end', selectionStart: null }),

  setSelectionStart: (point) =>
    set({ selectionMode: 'picking_end', selectionStart: point }),

  cancelSelection: () =>
    set({ selectionMode: null, selectionStart: null }),

  // ── Prepend a segment at the start of the working track ──────────────────────
  prependSegment: (segment) =>
    set((state) => ({
      _wt_history: [...state._wt_history.slice(-29), state.workingTrack],
      _wt_future: [],
      workingTrack: {
        ...state.workingTrack,
        segments: [normaliseSegment({ ...segment, id: crypto.randomUUID() }), ...state.workingTrack.segments],
      },
    })),

  // ── Convert a GPX slice segment to a routed segment in-place ─────────────────
  convertSegmentToRouted: (id, clickLat, clickLng) =>
    set((state) => ({
      _wt_history: [...state._wt_history.slice(-29), state.workingTrack],
      _wt_future: [],
      workingTrack: {
        ...state.workingTrack,
        segments: state.workingTrack.segments.map((s) => {
          if (s.id !== id || s.type !== 'gpx_slice') return s;
          const first = s.points[0];
          const last = s.points[s.points.length - 1];
          const click = { lat: clickLat, lng: clickLng };
          return {
            ...s,
            type: 'routed',
            converted: true,
            waypoints: [first, click, last],
            points: s.points,
          };
        }),
      },
    })),

  // ── Computed helpers ──────────────────────────────────────────────────────────
  getGapIndices: () => {
    const { segments } = get().workingTrack;
    const gaps = [];
    for (let i = 0; i < segments.length - 1; i++) {
      const a = segments[i].points;
      const b = segments[i + 1].points;
      if (!a.length || !b.length) continue;
      if (!areConnected(a[a.length - 1], b[0])) {
        gaps.push(i);
      }
    }
    return gaps;
  },

  isDownloadReady: () => {
    const { segments } = get().workingTrack;
    if (segments.length === 0) return false;
    return get().getGapIndices().length === 0;
  },

  // ── Undo / Redo ───────────────────────────────────────────────────────────────
  undo: () =>
    set((state) => {
      if (state._wt_history.length === 0) return state;
      const prev = state._wt_history[state._wt_history.length - 1];
      return {
        _wt_history: state._wt_history.slice(0, -1),
        _wt_future: [state.workingTrack, ...state._wt_future.slice(0, 29)],
        workingTrack: prev,
      };
    }),

  redo: () =>
    set((state) => {
      if (state._wt_future.length === 0) return state;
      const next = state._wt_future[0];
      return {
        _wt_history: [...state._wt_history.slice(-29), state.workingTrack],
        _wt_future: state._wt_future.slice(1),
        workingTrack: next,
      };
    }),

  // ── Clear all ─────────────────────────────────────────────────────────────────
  clearAll: () => {
    colorIdx = 0;
    set({
      folders: [],
      uploadedTracks: [],
      workingTrack: { name: 'My Track', segments: [] },
      _wt_history: [],
      _wt_future: [],
      selectionMode: null,
      selectionStart: null,
      locationMarkers: [],
      previewMarker: null,
      poiMarkers: [],
    });
  },

  // ── Load project (import a saved .trackeditor JSON) ───────────────────────────
  loadProject: (data) => {
    colorIdx = (data.uploadedTracks?.length ?? 0) % TRACK_COLORS.length;
    set({
      folders: data.folders ?? [],
      uploadedTracks: data.uploadedTracks ?? [],
      workingTrack: data.workingTrack ?? { name: 'My Track', segments: [] },
      routingProfile: data.routingProfile ?? 'cycling-mountain',
      _wt_history: [],
      _wt_future: [],
      selectionMode: null,
      selectionStart: null,
      locationMarkers: [],
      previewMarker: null,
      poiMarkers: [],
    });
  },
    }),
    {
      name: 'track-editor-store',
      storage: idbStorage,
      // Exclude transient UI state from persistence
      partialize: (state) => {
        const {
          _wt_history,
          _wt_future,
          selectionMode,
          selectionStart,
          previewMarker,
          hoveredSegmentId,
          centerMapOn,
          mapView,
          ...persisted
        } = state;
        return persisted;
      },
    }
  )
);

export default useTrackStore;
