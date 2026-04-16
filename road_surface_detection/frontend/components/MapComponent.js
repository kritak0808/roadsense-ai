import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for missing default icon in Leaflet when using Webpack/Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const getStatusColor = (status) => {
  switch (status.toLowerCase()) {
    case 'pothole':
    case 'crack':
    case 'damaged road':
      return 'red';
    default:
      return 'green';
  }
};

const MapComponent = ({ lat, lng, status }) => {
  if (!lat || !lng) return <div className="p-4 text-center text-slate-500">No Location Data Provided</div>;

  return (
    <MapContainer 
      center={[lat, lng]} 
      zoom={15} 
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
      dragging={false}   // Disable dragging for a clean embedded look
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      <Marker position={[lat, lng]}>
        <Popup>
          <strong>Dectection:</strong> {status.toUpperCase()}
        </Popup>
      </Marker>
    </MapContainer>
  );
};

export default MapComponent;
