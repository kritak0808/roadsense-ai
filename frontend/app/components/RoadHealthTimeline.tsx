"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, Area, AreaChart,
} from "recharts";
import toast from "react-hot-toast";

interface TimelinePoint {
  date: string;
  rhs: number;
  severity_score: number;
  predicted_class: string;
  weather_rainfall: number | null;
  confidence: number;
}

interface ChartPoint extends TimelinePoint {
  dateLabel: string;
  trend?: number;
}

const CLASS_COLORS: Record<string, string> = {
  Good: "#22c55e",
  Crack: "#f59e0b",
  Pothole: "#ef4444",
  Vandalism: "#8b5cf6",
};

function linearTrend(data: TimelinePoint[]): number[] {
  const n = data.length;
  if (n < 2) return data.map(d => d.rhs);
  const xs = data.map((_, i) => i);
  const ys = data.map(d => d.rhs);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const denom = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const slope = denom === 0 ? 0 :
    xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / denom;
  const intercept = my - slope * mx;
  return xs.map(x => Math.max(0, Math.min(100, Math.round(intercept + slope * x))));
}

export default function RoadHealthTimeline() {
  const [roadId, setRoadId] = useState("");
  const [data, setData] = useState<TimelinePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"segment" | "all">("all");
  const [availableIds, setAvailableIds] = useState<string[]>([]);

  // On mount, load general history and extract available road segment IDs
  useEffect(() => {
    loadAllHistory();
  }, []);

  const loadAllHistory = async () => {
    setLoading(true);
    try {
      const { data: resp } = await api.history.list({ per_page: 100, page: 1 });
      const items = resp.data.items as unknown as Record<string, unknown>[];
      // Sort ascending by date
      const sorted = [...items].sort(
        (a, b) => new Date(String(a.created_at ?? "")).getTime() -
                  new Date(String(b.created_at ?? "")).getTime()
      );
      const points: TimelinePoint[] = sorted.map((i) => {
        const sev = Number(i.severity_score ?? 0);
        return {
          date: String(i.created_at ?? ""),
          rhs: Math.max(0, 100 - sev),
          severity_score: sev,
          predicted_class: String(i.predicted_class ?? "Good"),
          weather_rainfall: i.weather_rainfall != null ? Number(i.weather_rainfall) : null,
          confidence: Number(i.confidence ?? 0),
        };
      });
      setData(points);

      // Extract unique road segment IDs
      const ids = [...new Set(
        sorted
          .map((i) => i.road_segment_id as string)
          .filter(Boolean)
      )];
      setAvailableIds(ids);
    } catch {
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const loadSegmentTimeline = async () => {
    if (!roadId.trim()) return;
    setLoading(true);
    try {
      const resp = await api.history.timeline(roadId.trim());
      const points = resp.data.data.points as TimelinePoint[];
      if (points.length === 0) {
        toast.error(`No data found for segment "${roadId}" — predictions need a road segment ID set`);
        return;
      }
      setData(points);
    } catch {
      toast.error("Failed to load timeline");
    } finally {
      setLoading(false);
    }
  };

  const trends = linearTrend(data);
  const chartData: ChartPoint[] = data.map((d, i) => ({
    ...d,
    dateLabel: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    trend: trends[i],
  }));

  const latestRhs = data.length > 0 ? data[data.length - 1].rhs : null;
  const trendSlope = trends.length > 1 ? trends[trends.length - 1] - trends[0] : 0;
  const avgSeverity = data.length > 0
    ? (data.reduce((s, d) => s + d.severity_score, 0) / data.length).toFixed(1)
    : null;

  const rhsColor = latestRhs == null ? "#6b7280"
    : latestRhs >= 70 ? "#22c55e"
    : latestRhs >= 40 ? "#f59e0b"
    : "#ef4444";

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-white">Road Health Timeline</h3>
        <div className="flex gap-1">
          <button
            onClick={() => { setMode("all"); loadAllHistory(); }}
            className={`text-xs px-3 py-1 rounded-md transition-colors ${
              mode === "all" ? "bg-brand-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            All Predictions
          </button>
          <button
            onClick={() => setMode("segment")}
            className={`text-xs px-3 py-1 rounded-md transition-colors ${
              mode === "segment" ? "bg-brand-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            By Segment
          </button>
        </div>
      </div>

      {/* Segment search */}
      {mode === "segment" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={roadId}
              onChange={(e) => setRoadId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadSegmentTimeline()}
              placeholder="Road segment ID (e.g. SEG-001)"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button onClick={loadSegmentTimeline} disabled={loading} className="btn-primary text-sm px-4">
              {loading ? "…" : "Load"}
            </button>
          </div>
          {availableIds.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              <span className="text-xs text-gray-500">Available:</span>
              {availableIds.map(id => (
                <button
                  key={id}
                  onClick={() => { setRoadId(id); }}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-brand-400 px-2 py-0.5 rounded"
                >
                  {id}
                </button>
              ))}
            </div>
          )}
          {availableIds.length === 0 && (
            <p className="text-xs text-gray-600">
              No road segment IDs found. Tag predictions with a segment ID when uploading to use this feature.
            </p>
          )}
        </div>
      )}

      {/* KPI row */}
      {data.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-800 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">Current RHS</p>
            <p className="text-lg font-bold" style={{ color: rhsColor }}>
              {latestRhs?.toFixed(0)}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">Trend</p>
            <p className={`text-lg font-bold ${trendSlope >= 0 ? "text-green-400" : "text-red-400"}`}>
              {trendSlope >= 0 ? "↑" : "↓"} {Math.abs(trendSlope).toFixed(0)} pts
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">Avg Severity</p>
            <p className="text-lg font-bold text-white">{avgSeverity}</p>
          </div>
        </div>
      )}

      {/* Alert */}
      {data.some(d => d.rhs < 40) && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-sm text-red-300">
          ⚠️ Road Health Score dropped below 40 — immediate inspection recommended
        </div>
      )}

      {/* Chart */}
      {loading && (
        <div className="h-48 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && data.length === 0 && (
        <div className="h-32 flex items-center justify-center text-gray-500 text-sm">
          No prediction data yet — run some inspections first
        </div>
      )}

      {!loading && data.length > 0 && (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="rhsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fill: "#6b7280", fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#6b7280", fontSize: 10 }}
              tickFormatter={(v) => `${v}`}
              width={28}
            />
            <Tooltip
              contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#f9fafb" }}
              formatter={(value: number, name: string) => [
                name === "RHS" ? `${value}/100` : value,
                name,
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
            <ReferenceLine
              y={40}
              stroke="#ef4444"
              strokeDasharray="4 4"
              label={{ value: "Alert threshold", fill: "#ef4444", fontSize: 10, position: "insideTopRight" }}
            />
            <ReferenceLine
              y={70}
              stroke="#22c55e"
              strokeDasharray="4 4"
              label={{ value: "Healthy", fill: "#22c55e", fontSize: 10, position: "insideTopRight" }}
            />
            <Area
              type="monotone"
              dataKey="rhs"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#rhsGrad)"
              dot={(props) => {
                const { cx, cy, payload } = props;
                const color = CLASS_COLORS[payload.predicted_class] ?? "#6b7280";
                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={color} stroke="#111827" strokeWidth={1.5} />;
              }}
              name="RHS"
            />
            <Line
              type="monotone"
              dataKey="trend"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              name="Trend"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {!loading && data.length > 0 && (
        <p className="text-xs text-gray-600 text-center">
          Dots colored by damage class · Dashed line = trend · RHS = Road Health Score (100 = perfect)
        </p>
      )}
    </div>
  );
}
