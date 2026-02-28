import { create } from 'zustand';
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

const useTrackStore = create((set, get) => ({
  // ── Uploaded tracks ──────────────────────────────────────────────────────────
  uploadedTracks: [],

  addUploadedTrack: (name, points) =>
    set((state) => ({
      uploadedTracks: [
        ...state.uploadedTracks,
        {
          id: crypto.randomUUID(),
          name,
          color: nextColor(),
          points,
          visible: true,
        },
      ],
    })),

  removeUploadedTrack: (id) =>
    set((state) => ({
      uploadedTracks: state.uploadedTracks.filter((t) => t.id !== id),
    })),

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

  // ── Working track ─────────────────────────────────────────────────────────────
  workingTrack: { name: 'My Track', segments: [] },

  setWorkingTrackName: (name) =>
    set((state) => ({ workingTrack: { ...state.workingTrack, name } })),

  addSegment: (segment) =>
    set((state) => ({
      workingTrack: {
        ...state.workingTrack,
        segments: [...state.workingTrack.segments, normaliseSegment({ ...segment, id: crypto.randomUUID() })],
      },
    })),

  removeSegment: (id) =>
    set((state) => ({
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
      return { workingTrack: { ...state.workingTrack, segments: segs } };
    }),

  insertSegmentAt: (index, segment) =>
    set((state) => {
      const segs = state.workingTrack.segments;
      return {
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
      workingTrack: {
        ...state.workingTrack,
        segments: state.workingTrack.segments.map((s) =>
          s.id === id ? { ...s, waypoints: newWaypoints, points: newPoints } : s
        ),
      },
    })),

  replaceSegment: (id, newSegment) =>
    set((state) => ({
      workingTrack: {
        ...state.workingTrack,
        segments: state.workingTrack.segments.map((s) =>
          s.id === id ? { ...newSegment, id } : s
        ),
      },
    })),

  // ── Map view (for Google Maps link) ──────────────────────────────────────────
  mapView: { lat: 50.82, lng: 5.6, zoom: 13 },
  setMapView: (lat, lng, zoom) => set({ mapView: { lat, lng, zoom } }),

  // ── Routing settings ─────────────────────────────────────────────────────────
  routingProfile: 'cycling-mountain', // cycling-mountain | cycling-regular | foot-hiking
  setRoutingProfile: (profile) => set({ routingProfile: profile }),

  // ── Selection mode for picking segment endpoints ──────────────────────────────
  // null | 'picking_start' | 'picking_end' | 'picking_free_start' | 'picking_free_end'
  selectionMode: null,
  selectionStart: null, // {lat, lng, trackId, idx}

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
      workingTrack: {
        ...state.workingTrack,
        segments: [normaliseSegment({ ...segment, id: crypto.randomUUID() }), ...state.workingTrack.segments],
      },
    })),

  // ── Convert a GPX slice segment to a routed segment in-place ─────────────────
  convertSegmentToRouted: (id, clickLat, clickLng) =>
    set((state) => ({
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
            // Keep existing points as display geometry until ORS re-routes
            points: s.points,
          };
        }),
      },
    })),

  // ── Computed helpers ──────────────────────────────────────────────────────────
  /** Returns array of gap indices: index i means gap between segment[i] and segment[i+1] */
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

  // ── Clear all ─────────────────────────────────────────────────────────────────
  clearAll: () => {
    colorIdx = 0;
    set({
      uploadedTracks: [],
      workingTrack: { name: 'My Track', segments: [] },
      selectionMode: null,
      selectionStart: null,
    });
  },
}));

export default useTrackStore;
