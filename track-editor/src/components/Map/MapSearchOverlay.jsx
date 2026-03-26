import { useState, useRef, useCallback, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import useTrackStore from '../../store/trackStore';
import { searchLocations } from '../../utils/geocodingService';
import { searchPoiNearTrack, POI_CATEGORIES } from '../../utils/overpassService';
import { sampleTrackInView } from '../../utils/trackSampler';

const DEBOUNCE_MS = 350;

/** Rendered INSIDE MapContainer — populates the shared mapRef so the overlay can pan the map */
export function MapSearchCenterer({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

/** Rendered OUTSIDE MapContainer (absolute overlay) — the actual search UI */
export default function MapSearchOverlay({ mapRef }) {
  const locationMarkers      = useTrackStore((s) => s.locationMarkers);
  const addLocationMarker    = useTrackStore((s) => s.addLocationMarker);
  const removeLocationMarker = useTrackStore((s) => s.removeLocationMarker);
  const setPreviewMarker     = useTrackStore((s) => s.setPreviewMarker);
  const uploadedTracks       = useTrackStore((s) => s.uploadedTracks);
  const workingTrack         = useTrackStore((s) => s.workingTrack);
  const poiMarkers           = useTrackStore((s) => s.poiMarkers);
  const addPoiMarkers        = useTrackStore((s) => s.addPoiMarkers);
  const clearPoiMarkers      = useTrackStore((s) => s.clearPoiMarkers);

  // ── Compact/expand state — removed; search is always visible ─────────────────

  // ── Location search state ──────────────────────────────────────────────────────
  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [open,         setOpen]         = useState(false);
  const [showPinPanel, setShowPinPanel] = useState(false);

  // ── POI search state ───────────────────────────────────────────────────────────
  const [panelExpanded,       setPanelExpanded]       = useState(false);
  const [selectedCategories,  setSelectedCategories]  = useState([]);
  const [radiusKm,            setRadiusKm]            = useState(1);
  const [poiLoading,          setPoiLoading]          = useState(false);
  const [poiError,            setPoiError]            = useState(null);

  const debounceRef = useRef(null);
  const abortRef    = useRef(null);
  const poiAbortRef = useRef(null);
  const inputRef    = useRef(null);
  const overlayRef  = useRef(null);

  // ── Location search handlers ───────────────────────────────────────────────────
  const runSearch = useCallback(async (q) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!q || q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      setPreviewMarker(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const hits = await searchLocations(q, 5, controller.signal);
      if (!controller.signal.aborted) {
        setResults(hits);
        setOpen(hits.length > 0);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError('Search failed');
        setResults([]);
        setOpen(false);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [setPreviewMarker]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), DEBOUNCE_MS);
  };

  const handleResultHover = (result) => {
    setPreviewMarker({ lat: result.lat, lng: result.lng, label: result.label });
  };

  const handleResultLeave = () => {
    setPreviewMarker(null);
  };

  const handlePick = (result) => {
    setPreviewMarker(null);
    addLocationMarker({
      id:      crypto.randomUUID(),
      placeId: result.id,
      label:   result.label,
      lat:     result.lat,
      lng:     result.lng,
    });
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handlePinClick = (marker) => {
    const map = mapRef?.current;
    if (map) map.setView([marker.lat, marker.lng], Math.max(map.getZoom(), 14));
    setShowPinPanel(false);
  };

  // ── POI search handlers ────────────────────────────────────────────────────────
  const toggleCategory = (key) => {
    setSelectedCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handlePoiSearch = async () => {
    const map = mapRef?.current;
    if (!map) return;
    if (selectedCategories.length === 0) {
      setPoiError('Select at least one category.');
      return;
    }

    const bounds = map.getBounds();
    const points = sampleTrackInView(uploadedTracks, workingTrack, bounds);

    if (points.length < 1) {
      setPoiError('No track visible in this view. Pan the map to show a track segment.');
      return;
    }

    if (poiAbortRef.current) poiAbortRef.current.abort();
    const controller = new AbortController();
    poiAbortRef.current = controller;

    setPoiLoading(true);
    setPoiError(null);

    try {
      const categories = POI_CATEGORIES.filter((c) => selectedCategories.includes(c.key));
      const results = await searchPoiNearTrack({
        categories,
        radiusM: Math.round(radiusKm * 1000),
        points,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        addPoiMarkers(results);
        if (results.length === 0) setPoiError('No results found in this area.');
      }
    } catch (e) {
      if (!controller.signal.aborted) setPoiError('Search failed. Try again.');
    } finally {
      if (!controller.signal.aborted) setPoiLoading(false);
    }
  };

  // ── Outside click: close dropdowns only (no collapse) ────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (!overlayRef.current?.contains(e.target)) {
        setOpen(false);
        setShowPinPanel(false);
        setPreviewMarker(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setPreviewMarker]);

  // ── Abort on unmount ───────────────────────────────────────────────────────────
  useEffect(() => () => {
    if (abortRef.current)    abortRef.current.abort();
    if (poiAbortRef.current) poiAbortRef.current.abort();
  }, []);

  const shortLabel = (label) => label.split(',').slice(0, 3).join(',').trim();

  // ── Always expanded ────────────────────────────────────────────────────────────
  return (
    <div
      ref={overlayRef}
      className="map-search-overlay"
      role="search"
    >
      {/* ── Search row ── */}
      <div className="map-search-row">
        <div className="map-search-input-wrap">
          <span className="map-search-icon" aria-hidden>🔍</span>
          <input
            ref={inputRef}
            className="map-search-input"
            type="text"
            placeholder="Search location…"
            value={query}
            onChange={handleChange}
            onFocus={() => { if (results.length) setOpen(true); }}
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <span className="map-search-spinner" aria-hidden />}
        </div>

        {/* Pins panel toggle */}
        <button
          className={`map-search-pins-btn${showPinPanel ? ' active' : ''}`}
          title="Pinned locations"
          onClick={() => setShowPinPanel((v) => !v)}
        >
          📍{locationMarkers.length > 0 && (
            <span className="map-search-badge">{locationMarkers.length}</span>
          )}
        </button>

        {/* POI panel expand/collapse */}
        <button
          className={`map-search-pins-btn${panelExpanded ? ' active' : ''}`}
          title={panelExpanded ? 'Hide POI search' : 'Find POIs near track'}
          onClick={() => { setPanelExpanded((v) => !v); setPoiError(null); }}
        >
          {panelExpanded ? '⌃' : '⌄'}
        </button>
      </div>

      {/* ── Location search error ── */}
      {error && <p className="map-search-error">{error}</p>}

      {/* ── Results dropdown ── */}
      {open && results.length > 0 && (
        <ul
          className="map-search-results"
          role="listbox"
          onMouseLeave={handleResultLeave}
        >
          {results.map((r) => (
            <li
              key={r.id}
              className="map-search-result"
              role="option"
              onMouseEnter={() => handleResultHover(r)}
              onMouseDown={() => handlePick(r)}
            >
              {shortLabel(r.label)}
            </li>
          ))}
        </ul>
      )}

      {/* ── Pins panel ── */}
      {showPinPanel && (
        <ul className="map-search-pins-panel" role="list">
          {locationMarkers.length === 0 ? (
            <li className="map-search-pins-empty">No pins yet</li>
          ) : (
            locationMarkers.map((m) => (
              <li key={m.id} className="map-search-pin-item">
                <button
                  className="map-search-pin-label"
                  onClick={() => handlePinClick(m)}
                  title={m.label}
                >
                  {shortLabel(m.label)}
                </button>
                <button
                  className="map-search-pin-remove"
                  title="Remove"
                  onClick={() => removeLocationMarker(m.id)}
                >
                  ×
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {/* ── POI search panel ── */}
      {panelExpanded && (
        <div className="poi-panel">
          <div className="poi-panel-label">Find near track</div>

          {/* Category grid */}
          <div className="poi-categories">
            {POI_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                className={`poi-category-btn${selectedCategories.includes(cat.key) ? ' selected' : ''}`}
                title={cat.label}
                onClick={() => toggleCategory(cat.key)}
              >
                <span className="poi-cat-icon">{cat.icon}</span>
                <span className="poi-cat-label">{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Radius + search */}
          <div className="poi-controls">
            <div className="poi-radius-wrap">
              <input
                className="poi-radius-input"
                type="number"
                min="0.1"
                max="50"
                step="0.5"
                value={radiusKm}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isNaN(n)) setRadiusKm(Math.max(0.1, n));
                }}
              />
              <span className="poi-radius-unit">km</span>
            </div>
            <button
              className="poi-search-btn"
              onClick={handlePoiSearch}
              disabled={poiLoading || selectedCategories.length === 0}
            >
              {poiLoading ? <span className="map-search-spinner" aria-hidden /> : 'Search'}
            </button>
          </div>

          {/* Error */}
          {poiError && <p className="map-search-error">{poiError}</p>}

          {/* Results row — always show Clear if markers exist */}
          {poiMarkers.length > 0 && (
            <div className="poi-results-row">
              <span className="poi-results-count">{poiMarkers.length} result{poiMarkers.length !== 1 ? 's' : ''}</span>
              <button className="poi-clear-btn" onClick={() => { clearPoiMarkers(); setPoiError(null); }}>
                ✕ Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
