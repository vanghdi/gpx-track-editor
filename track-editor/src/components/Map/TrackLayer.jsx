import { Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import useTrackStore from '../../store/trackStore';

export default function TrackLayer() {
  const uploadedTracks = useTrackStore((s) => s.uploadedTracks);

  return uploadedTracks
    .filter((t) => t.visible)
    .map((track) => (
      <Polyline
        key={track.id}
        positions={track.points.map((p) => [p.lat, p.lng])}
        pathOptions={{ color: track.color, weight: 3, opacity: 0.85 }}
      >
        <Tooltip sticky>{track.name}</Tooltip>
      </Polyline>
    ));
}
