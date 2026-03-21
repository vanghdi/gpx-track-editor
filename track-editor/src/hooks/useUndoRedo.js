import { useEffect, useSyncExternalStore } from 'react';
import useTrackStore from '../store/trackStore';

/**
 * Exposes undo/redo state and actions for the working track.
 * Also wires Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z keyboard shortcuts.
 * Only mount this hook once (e.g. in WorkingTrackBuilder).
 */
export function useUndoRedo() {
  const { pastStates, futureStates, undo, redo } = useSyncExternalStore(
    useTrackStore.temporal.subscribe,
    useTrackStore.temporal.getState
  );

  const canUndo = pastStates.length > 0;
  const canRedo = futureStates.length > 0;

  useEffect(() => {
    const handleKey = (e) => {
      if (!e.metaKey && !e.ctrlKey) return;
      // Let native undo/redo work inside text inputs
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
          document.activeElement?.isContentEditable) return;
      const { pastStates: ps, futureStates: fs, undo: u, redo: r } =
        useTrackStore.temporal.getState();
      if (e.key === 'z' && !e.shiftKey) {
        if (ps.length > 0) { e.preventDefault(); u(); }
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        if (fs.length > 0) { e.preventDefault(); r(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []); // stable: reads live state from temporal.getState() inside handler

  return { canUndo, canRedo, undo, redo };
}
