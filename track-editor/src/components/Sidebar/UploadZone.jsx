import useTrackStore from '../../store/trackStore';
import { parseGPX } from '../../utils/gpxParser';
import { useRef, useState } from 'react';

const ACCEPTED = '.gpx';

export default function UploadZone() {
  const addUploadedTrack = useTrackStore((s) => s.addUploadedTrack);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const processFiles = (files) => {
    Array.from(files).forEach((file) => {
      if (!file.name.toLowerCase().endsWith('.gpx')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const { name, points } = parseGPX(e.target.result);
          addUploadedTrack(name || file.name.replace('.gpx', ''), points);
        } catch {
          console.error('Failed to parse GPX:', file.name);
        }
      };
      reader.readAsText(file);
    });
  };

  return (
    <div
      className={`upload-zone ${dragging ? 'upload-zone--drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        processFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        style={{ display: 'none' }}
        onChange={(e) => processFiles(e.target.files)}
      />
      <span className="upload-zone__icon">📂</span>
      <span className="upload-zone__text">
        {dragging ? 'Drop GPX files here' : 'Upload GPX tracks'}
      </span>
      <span className="upload-zone__hint">Click or drag & drop</span>
    </div>
  );
}
