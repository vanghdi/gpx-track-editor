import { useState, useRef, useCallback, useEffect } from 'react';
import useTrackStore from '../../store/trackStore';
import { searchLocations } from '../../utils/geocodingService';

const DEBOUNCE_MS = 350;

export default function LocationSearch() {
  const locationMarkers    = useTrackStore((s) => s.locationMarkers);
  const addLocationMarker  = useTrackStore((s) => s.addLocationMarker);
  const removeLocationMarker = useTrackStore((s) => s.removeLocationMarker);

  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [open,    setOpen]    = useState(false);

  const debounceRef  = useRef(null);
  const abortRef     = useRef(null);  // tracks in-flight request
  const inputRef     = useRef(null);

  const runSearch = useCallback(async (q) => {
    // Cancel any previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!q || q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const hits = await searchLocations(q, 5, controller.signal);
      // Only apply if this request was not superseded
      if (!controller.signal.aborted) {
        setResults(hits);
        setOpen(hits.length > 0);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError('Search failed — check your connection.');
        setResults([]);
        setOpen(false);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), DEBOUNCE_MS);
  };

  const handlePick = (result) => {
    addLocationMarker({
      // Always generate a fresh UUID so the same place can be pinned multiple times
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

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.location-search')) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Abort any pending request on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Truncate long Nominatim labels (they include full country chain)
  const shortLabel = (label) => {
    const parts = label.split(',');
    return parts.slice(0, 3).join(',').trim();
  };

  return (
    <div className="location-search">
      {/* Search input */}
      <div className="location-search__input-wrap">
        <input
          ref={inputRef}
          className="input location-search__input"
          type="text"
          placeholder="Search address or place…"
          value={query}
          onChange={handleChange}
          onFocus={() => { if (results.length) setOpen(true); }}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <span className="location-search__spinner" aria-hidden />}
      </div>

      {/* Error */}
      {error && <p className="location-search__error">{error}</p>}

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <ul className="location-search__results" role="listbox">
          {results.map((r) => (
            <li
              key={r.id}
              className="location-search__result"
              role="option"
              onMouseDown={() => handlePick(r)}
            >
              <span className="location-search__result-icon">📍</span>
              <span className="location-search__result-label">{shortLabel(r.label)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Pinned markers list */}
      {locationMarkers.length > 0 && (
        <ul className="location-pins">
          {locationMarkers.map((m) => (
            <li key={m.id} className="location-pin">
              <span className="location-pin__dot" aria-hidden>📍</span>
              <span className="location-pin__label" title={m.label}>
                {shortLabel(m.label)}
              </span>
              <button
                className="icon-btn icon-btn--danger"
                title="Remove marker"
                onClick={() => removeLocationMarker(m.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
