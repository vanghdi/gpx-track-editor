import useTrackStore from '../../store/trackStore';
import { exportGPX } from '../../utils/gpxExporter';

export default function DownloadButton() {
  const workingTrack = useTrackStore((s) => s.workingTrack);
  const isDownloadReady = useTrackStore((s) => s.isDownloadReady);

  const ready = isDownloadReady();

  const handleDownload = () => {
    const xml = exportGPX(workingTrack.name, workingTrack.segments);
    const blob = new Blob([xml], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workingTrack.name.replace(/\s+/g, '_') || 'track'}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      className={`btn btn--download btn--full ${ready ? 'btn--ready' : ''}`}
      disabled={!ready}
      onClick={handleDownload}
      title={ready ? 'Download GPX' : 'Add connected segments to enable download'}
    >
      ⬇ Download GPX
    </button>
  );
}
