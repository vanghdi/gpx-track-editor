import { useState, useRef, useCallback, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import useTrackStore from '../../store/trackStore';
import { searchLocations } from '../../utils/geocodingService';

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

  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [open,         setOpen]         = useState(false);
  const [showPinPanel, setShowPinPanel] = useState(false);

  const debounceRef = useRef(null);
  const abortRef    = useRef(null);
  const inputRef    = useRef(null);

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

  // Close dropdown/panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.map-search-overlay')) {
        setOpen(false);
        setShowPinPanel(false);
        setPreviewMarker(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setPreviewMarker]);

  // Abort on unmount
  useEffect(() => () => { if (abortRef.current) abortRef.current.abort(); }, []);

  const shortLabel = (label) => label.split(',').slice(0, 3).join(',').trim();

  return (
    <div className="map-search-overlay">
      {/* Search row */}
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
      </div>

      {/* Error */}
      {error && <p className="map-search-error">{error}</p>}

      {/* Results dropdown */}
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

      {/* Pins panel */}
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
    </div>
  );
}
