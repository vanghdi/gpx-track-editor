import { useEffect } from 'react';
import useTrackStore from '../store/trackStore';

/**
 * Exposes undo/redo state and actions for the working track.
 * Also wires Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z keyboard shortcuts.
 * Only mount this hook once (e.g. in WorkingTrackBuilder).
 */
export function useUndoRedo() {
  const canUndo = useTrackStore((s) => s._wt_history.length > 0);
  const canRedo = useTrackStore((s) => s._wt_future.length > 0);
  const undo = useTrackStore((s) => s.undo);
  const redo = useTrackStore((s) => s.redo);

  useEffect(() => {
    const handleKey = (e) => {
      if (!e.metaKey && !e.ctrlKey) return;
      // Let native undo/redo work inside text inputs
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
          document.activeElement?.isContentEditable) return;
      const { _wt_history, _wt_future, undo: u, redo: r } =
        useTrackStore.getState();
      if (e.key === 'z' && !e.shiftKey) {
        if (_wt_history.length > 0) { e.preventDefault(); u(); }
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        if (_wt_future.length > 0) { e.preventDefault(); r(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return { canUndo, canRedo, undo, redo };
}
