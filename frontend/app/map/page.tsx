"use client";

import { useEffect, useState, useCallback } from "react";
import React from "react";
import dynamic from "next/dynamic";
import Navbar from "../components/Navbar";
import { api, LocationItem } from "@/lib/api";
import toast from "react-hot-toast";

interface MapViewProps {
  locations: LocationItem[];
  onSelect: (loc: LocationItem | null) => void;
  selected: LocationItem | null;
}

// Leaflet must be client-side only — use dynamic with explicit loader
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const MapView = dynamic<MapViewProps>(
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  async () => (await import("../components/MapView")).default,
  {
    ssr: false,
    loading: () => (
      <div className="h-full bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
) as React.ComponentType<MapViewProps>;

const CLASS_COLORS: Record<string, string> = {
  Good:      "#22c55e",
  Crack:     "#f59e0b",
  Pothole:   "#ef4444",
  Vandalism: "#8b5cf6",
};

const URGENCY_ORDER = ["Critical", "Urgent", "Schedule", "Monitor"];

export default function MapPage() {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<LocationItem | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.locations();
      setLocations(data.data);
    } catch {
      toast.error("Failed to load locations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh every 30s
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = filter === "All"
    ? locations
    : locations.filter(l => l.predicted_class === filter);

  // Summary counts
  const counts: Record<string, number> = {};
  locations.forEach(l => { counts[l.predicted_class] = (counts[l.predicted_class] ?? 0) + 1; });

  const urgentCount = locations.filter(
    l => l.repair_urgency === "Critical" || l.repair_urgency === "Urgent"
  ).length;

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Road Damage Map</h1>
            <p className="text-sm text-gray-500">
              {locations.length} geo-tagged inspections
              {urgentCount > 0 && (
                <span className="ml-2 text-red-400">· {urgentCount} urgent</span>
              )}
            </p>
          </div>
          <button
            onClick={load}
            className="btn-secondary text-sm"
          >
            ↻ Refresh
          </button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["Pothole", "Crack", "Vandalism", "Good"].map(cls => (
            <div
              key={cls}
              className="bg-gray-900 border border-gray-800 rounded-xl p-3 cursor-pointer transition-colors hover:border-gray-600"
              style={filter === cls ? { borderColor: CLASS_COLORS[cls] } : {}}
              onClick={() => setFilter(filter === cls ? "All" : cls)}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{cls}</span>
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CLASS_COLORS[cls] }} />
              </div>
              <p className="text-2xl font-bold text-white mt-1">{counts[cls] ?? 0}</p>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-500">Filter:</span>
          {["All", "Pothole", "Crack", "Vandalism", "Good"].map(cls => (
            <button
              key={cls}
              onClick={() => setFilter(cls)}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                filter === cls ? "text-white font-medium" : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
              style={filter === cls ? {
                backgroundColor: cls === "All" ? "#3b82f6" : CLASS_COLORS[cls],
              } : {}}
            >
              {cls} {cls !== "All" && counts[cls] ? `(${counts[cls]})` : ""}
            </button>
          ))}
        </div>

        {/* Map */}
        <div className="rounded-xl overflow-hidden border border-gray-800" style={{ height: 500 }}>
          {loading ? (
            <div className="h-full bg-gray-900 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Loading map data…</p>
              </div>
            </div>
          ) : (
            <MapView
              locations={filtered}
              onSelect={setSelected}
              selected={selected}
            />
          )}
        </div>

        {/* No data hint */}
        {!loading && locations.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <p className="text-2xl mb-2">📍</p>
            <p className="text-gray-400 text-sm font-medium">No geo-tagged predictions yet</p>
            <p className="text-gray-600 text-xs mt-1">
              Allow browser location access when running predictions — each detection will appear here automatically
            </p>
          </div>
        )}

        {/* Selected detail card */}
        {selected && (
          <div
            className="bg-gray-900 border rounded-xl p-4 space-y-2"
            style={{ borderColor: CLASS_COLORS[selected.predicted_class] + "66" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLASS_COLORS[selected.predicted_class] }} />
                <span className="font-semibold text-white">{selected.predicted_class}</span>
                <span className="text-xs text-gray-500">{(selected.confidence * 100).toFixed(1)}% confidence</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">File</p>
                <p className="text-gray-300 truncate">{selected.original_filename}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Severity</p>
                <p className="text-gray-300">{selected.severity_score.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Urgency</p>
                <p className="text-gray-300">{selected.repair_urgency ?? "Monitor"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Coordinates</p>
                <p className="text-gray-300">{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</p>
              </div>
            </div>
            <p className="text-xs text-gray-600">
              {new Date(selected.created_at).toLocaleString()}
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-4 flex-wrap text-xs text-gray-500">
          {Object.entries(CLASS_COLORS).map(([cls, color]) => (
            <div key={cls} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full border-2 border-white/20" style={{ backgroundColor: color }} />
              {cls}
            </div>
          ))}
          <span className="text-gray-700">· Click a marker to see details · Map auto-refreshes every 30s</span>
        </div>
      </main>
    </div>
  );
}
