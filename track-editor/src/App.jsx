import { useEffect } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import MapView from './components/Map/MapView';
import useTrackStore from './store/trackStore';

export default function App() {
  const startSegmentPicking = useTrackStore((s) => s.startSegmentPicking);
  const selectionMode = useTrackStore((s) => s.selectionMode);
  const cancelSelection = useTrackStore((s) => s.cancelSelection);

  useEffect(() => {
    const onKey = (e) => {
      // Ignore when typing in an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 's' || e.key === 'S') {
        if (selectionMode) cancelSelection();
        else startSegmentPicking();
      }
      if (e.key === 'Escape' && selectionMode) cancelSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectionMode, startSegmentPicking, cancelSelection]);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="map-container">
        <MapView />
      </main>
    </div>
  );
}
