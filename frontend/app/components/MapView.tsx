"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocationItem } from "@/lib/api";

const CLASS_COLORS: Record<string, string> = {
  Good:      "#22c55e",
  Crack:     "#f97316",
  Pothole:   "#ef4444",
  Vandalism: "#8b5cf6",
};

const CLASS_EMOJI: Record<string, string> = {
  Good:      "✅",
  Crack:     "⚡",
  Pothole:   "🕳️",
  Vandalism: "🎨",
};

// ── Custom colored pin icon using DivIcon ─────────────────────────────────────
function getIcon(predictedClass: string, isSelected = false): L.DivIcon {
  const color = CLASS_COLORS[predictedClass] ?? "#6b7280";
  const size = isSelected ? 36 : 28;
  const borderColor = isSelected ? "#ffffff" : "rgba(255,255,255,0.6)";
  const shadow = isSelected
    ? `0 0 0 3px ${color}55, 0 4px 12px rgba(0,0,0,0.5)`
    : "0 2px 6px rgba(0,0,0,0.4)";

  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border: 2.5px solid ${borderColor};
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: ${shadow};
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    ">
      <span style="
        transform: rotate(45deg);
        font-size: ${isSelected ? 14 : 11}px;
        line-height: 1;
        display: block;
      ">${CLASS_EMOJI[predictedClass] ?? "📍"}</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: "",           // no default leaflet styles
    iconSize: [size, size],
    iconAnchor: [size / 2, size],   // tip of pin at coordinate
    popupAnchor: [0, -size],
  });
}

// ── Auto-fit bounds ───────────────────────────────────────────────────────────
function BoundsUpdater({ locations }: { locations: LocationItem[] }) {
  const map = useMap();
  useEffect(() => {
    if (locations.length === 0) return;
    if (locations.length === 1) {
      map.setView([locations[0].lat, locations[0].lng], 15);
      return;
    }
    const lats = locations.map(l => l.lat);
    const lngs = locations.map(l => l.lng);
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [50, 50], maxZoom: 16 }
    );
  }, [locations, map]);
  return null;
}

interface Props {
  locations: LocationItem[];
  onSelect: (loc: LocationItem | null) => void;
  selected: LocationItem | null;
}

const DEFAULT_CENTER: [number, number] = [13.0827, 80.2707]; // Chennai

export default function MapView({ locations, onSelect, selected }: Props) {
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={12}
      style={{ height: "100%", width: "100%", background: "#111827" }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <BoundsUpdater locations={locations} />

      {locations.map((loc) => (
        <Marker
          key={loc.id}
          position={[loc.lat, loc.lng]}
          icon={getIcon(loc.predicted_class, selected?.id === loc.id)}
          eventHandlers={{
            click: () => onSelect(selected?.id === loc.id ? null : loc),
          }}
        >
          <Popup>
            <div style={{ minWidth: 190, fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
              {/* Header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 8, paddingBottom: 6,
                borderBottom: `2px solid ${CLASS_COLORS[loc.predicted_class] ?? "#6b7280"}`,
              }}>
                <span style={{ fontSize: 18 }}>{CLASS_EMOJI[loc.predicted_class] ?? "📍"}</span>
                <strong style={{ color: CLASS_COLORS[loc.predicted_class], fontSize: 15 }}>
                  {loc.predicted_class}
                </strong>
              </div>

              {/* Details */}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {[
                    ["Confidence", `${(loc.confidence * 100).toFixed(1)}%`],
                    ["Severity",   loc.severity_score.toFixed(1)],
                    ["Urgency",    loc.repair_urgency ?? "Monitor"],
                    ["File",       loc.original_filename],
                    ["Date",       new Date(loc.created_at).toLocaleDateString()],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <td style={{ color: "#6b7280", paddingRight: 10, paddingBottom: 3, whiteSpace: "nowrap" }}>
                        {label}
                      </td>
                      <td style={{
                        fontWeight: label === "Confidence" ? 600 : 400,
                        maxWidth: 120,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

