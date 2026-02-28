import { useState } from 'react';
import useTrackStore from '../../store/trackStore';

export default function ApiKeySettings() {
  const apiKey = useTrackStore((s) => s.apiKey);
  const setApiKey = useTrackStore((s) => s.setApiKey);
  const [draft, setDraft] = useState(apiKey);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(!apiKey);

  const handleSave = () => {
    setApiKey(draft.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="section section--settings">
      <button className="settings-toggle" onClick={() => setOpen((o) => !o)}>
        <span>
          {!apiKey && <span style={{ color: 'var(--coral)', marginRight: 6 }}>⚠</span>}
          API Key
        </span>
        <span className="settings-toggle__chevron">{open ? '▲' : '▼'}</span>
      </button>

      {!apiKey && (
        <div style={{ padding: '0 16px 10px', fontSize: 11, color: 'var(--coral)', lineHeight: 1.5 }}>
          Routing requires an OpenRouteService API key. Upload tracks and select segments work without one, but you won't be able to route gaps or add routed segments.
        </div>
      )}

      {open && (
        <div className="settings-body" style={{ padding: '0 16px 12px' }}>
          <div className="settings-label">
            <span>OpenRouteService API key</span>
            <a
              className="settings-link"
              href="https://openrouteservice.org/dev/#/signup"
              target="_blank"
              rel="noreferrer"
            >
              Get a free key ↗
            </a>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="input input--mono"
              type="password"
              placeholder="Paste your key here…"
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setSaved(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button
              className="btn btn--ghost btn--sm"
              style={{ flexShrink: 0 }}
              onClick={handleSave}
              disabled={draft.trim() === apiKey}
            >
              Save
            </button>
          </div>
          {saved && <span className="settings-saved">✓ Saved</span>}
        </div>
      )}
    </div>
  );
}
