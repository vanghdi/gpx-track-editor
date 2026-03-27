import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import TrackLayer from './TrackLayer';
import WorkingTrackLayer from './WorkingTrackLayer';
import PointSelector from './PointSelector';
import LocationMarkerLayer from './LocationMarkerLayer';
import PoiMarkerLayer from './PoiMarkerLayer';
import MapSearchOverlay, { MapSearchCenterer } from './MapSearchOverlay';
import MapChrome from './MapChrome';
import useTrackStore from '../../store/trackStore';
import { getBBox } from '../../utils/geoUtils';

const FALLBACK_CENTER = [50.82, 5.6];
const FALLBACK_ZOOM = 13;

const LAYERS = {
  osm: {
    label: '🗺 Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    label: '🛰 Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, GeoEye, Earthstar Geographics',
  },
};

function MapViewTracker() {
  const setMapView = useTrackStore((s) => s.setMapView);
  useMapEvents({
    moveend(e) {
      const { lat, lng } = e.target.getCenter();
      const zoom = e.target.getZoom();
      setMapView(lat, lng, zoom);
    },
    zoomend(e) {
      const { lat, lng } = e.target.getCenter();
      const zoom = e.target.getZoom();
      setMapView(lat, lng, zoom);
    },
  });
  return null;
}

function MapFitter() {
  const map = useMap();
  const uploadedTracks = useTrackStore((s) => s.uploadedTracks);
  const prevCount = useRef(0);

  useEffect(() => {
    if (uploadedTracks.length === 0) return;
    if (uploadedTracks.length <= prevCount.current) return;
    prevCount.current = uploadedTracks.length;
    const bbox = getBBox(uploadedTracks);
    if (bbox) map.fitBounds(bbox, { padding: [40, 40] });
  }, [uploadedTracks, map]);

  return null;
}

function SelectionCursor() {
  const map = useMap();
  const selectionMode = useTrackStore((s) => s.selectionMode);

  useEffect(() => {
    const container = map.getContainer();
    container.classList.toggle('selecting', !!selectionMode);
  }, [selectionMode, map]);

  return null;
}

function GeolocationInit() {
  const map = useMap();
  const setMapView = useTrackStore((s) => s.setMapView);
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 13);
        setMapView(pos.coords.latitude, pos.coords.longitude, 13);
      },
      () => {}
    );
  }, [map, setMapView]);

  return null;
}

function MapCenterer() {
  const map = useMap();
  const centerMapOn = useTrackStore((s) => s.centerMapOn);
  const clearCenterMapOn = useTrackStore((s) => s.clearCenterMapOn);

  useEffect(() => {
    if (!centerMapOn) return;
    map.setView([centerMapOn.lat, centerMapOn.lng], map.getZoom(), { animate: true });
    clearCenterMapOn();
  }, [centerMapOn, map, clearCenterMapOn]);

  return null;
}

export default function MapView() {
  const [activeLayer, setActiveLayer] = useState('osm');
  const layer = LAYERS[activeLayer];
  const mapRef = useRef(null);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer
        center={FALLBACK_CENTER}
        zoom={FALLBACK_ZOOM}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer key={activeLayer} url={layer.url} attribution={layer.attribution} />
        <TrackLayer />
        <WorkingTrackLayer />
        <PointSelector />
        <LocationMarkerLayer />
        <PoiMarkerLayer />
        <MapFitter />
        <GeolocationInit />
        <SelectionCursor />
        <MapViewTracker />
        <MapSearchCenterer mapRef={mapRef} />
        <MapCenterer />
      </MapContainer>

      <MapSearchOverlay mapRef={mapRef} />

      <MapChrome
        activeLayer={activeLayer}
        onToggleLayer={() => setActiveLayer((l) => l === 'osm' ? 'satellite' : 'osm')}
      />
    </div>
  );
}
