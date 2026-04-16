"use client";

import { useEffect, useState, useMemo } from "react";
import { api, HistoryItem } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";

const CLASS_COLORS: Record<string, string> = {
  Good:      "#22c55e",
  Crack:     "#f59e0b",
  Pothole:   "#ef4444",
  Vandalism: "#8b5cf6",
};

const URGENCY_COLORS: Record<string, string> = {
  Monitor:  "#22c55e",
  Schedule: "#f59e0b",
  Urgent:   "#f97316",
  Critical: "#ef4444",
};

type View = "distribution" | "confidence" | "urgency" | "daily";

export default function DamageAnalytics() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [view, setView] = useState<View>("distribution");

  useEffect(() => {
    api.history.list({ per_page: 200 })
      .then(({ data }) => setItems(data.data.items))
      .catch(() => {});
  }, []);

  // ── Distribution data ──────────────────────────────────────────────────────
  const distributionData = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(i => { counts[i.predicted_class] = (counts[i.predicted_class] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [items]);

  // ── Confidence buckets ─────────────────────────────────────────────────────
  const confidenceData = useMemo(() => {
    const buckets = [
      { range: "50–60%", min: 0.50, max: 0.60, count: 0 },
      { range: "60–70%", min: 0.60, max: 0.70, count: 0 },
      { range: "70–80%", min: 0.70, max: 0.80, count: 0 },
      { range: "80–90%", min: 0.80, max: 0.90, count: 0 },
      { range: "90–100%", min: 0.90, max: 1.01, count: 0 },
    ];
    items.forEach(i => {
      const b = buckets.find(b => i.confidence >= b.min && i.confidence < b.max);
      if (b) b.count++;
    });
    return buckets.map(b => ({ range: b.range, count: b.count }));
  }, [items]);

  // ── Urgency breakdown ──────────────────────────────────────────────────────
  const urgencyData = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(i => {
      const u = i.repair_urgency ?? "Monitor";
      counts[u] = (counts[u] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        const order = ["Critical", "Urgent", "Schedule", "Monitor"];
        return order.indexOf(a.name) - order.indexOf(b.name);
      });
  }, [items]);

  // ── Daily counts (last 14 days) ────────────────────────────────────────────
  const dailyData = useMemo(() => {
    const counts: Record<string, Record<string, number>> = {};
    items.forEach(i => {
      const day = new Date(i.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!counts[day]) counts[day] = {};
      counts[day][i.predicted_class] = (counts[day][i.predicted_class] ?? 0) + 1;
    });
    return Object.entries(counts)
      .slice(-14)
      .map(([date, cls]) => ({ date, ...cls }));
  }, [items]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!items.length) return null;
    const avgConf = items.reduce((s, i) => s + i.confidence, 0) / items.length;
    const avgSev  = items.reduce((s, i) => s + i.severity_score, 0) / items.length;
    const critical = items.filter(i => i.repair_urgency === "Critical" || i.repair_urgency === "Urgent").length;
    const topClass = distributionData.sort((a, b) => b.value - a.value)[0]?.name ?? "—";
    return { avgConf, avgSev, critical, topClass };
  }, [items, distributionData]);

  const VIEWS: { key: View; label: string }[] = [
    { key: "distribution", label: "Class Split" },
    { key: "confidence",   label: "Confidence" },
    { key: "urgency",      label: "Urgency" },
    { key: "daily",        label: "Daily" },
  ];

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-white">Damage Analytics</h3>
        <div className="flex gap-1">
          {VIEWS.map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                view === v.key
                  ? "bg-brand-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      {stats && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-gray-800 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-sm font-bold text-white">{items.length}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">Avg Conf</p>
            <p className="text-sm font-bold text-white">{(stats.avgConf * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">Avg Severity</p>
            <p className="text-sm font-bold text-white">{stats.avgSev.toFixed(1)}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">Urgent+</p>
            <p className={`text-sm font-bold ${stats.critical > 0 ? "text-red-400" : "text-green-400"}`}>
              {stats.critical}
            </p>
          </div>
        </div>
      )}

      {/* Charts */}
      {items.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
          No prediction data yet
        </div>
      ) : (
        <>
          {/* Class distribution — donut */}
          {view === "distribution" && (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {distributionData.map((entry) => (
                    <Cell key={entry.name} fill={CLASS_COLORS[entry.name] ?? "#6b7280"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, name: string) => [`${v} predictions`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
              </PieChart>
            </ResponsiveContainer>
          )}

          {/* Confidence distribution */}
          {view === "confidence" && (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={confidenceData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="range" tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} width={24} />
                  <Tooltip
                    contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v} predictions`, "Count"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {confidenceData.map((_, i) => (
                      <Cell key={i} fill={`hsl(${210 + i * 15}, 70%, ${45 + i * 5}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-600 text-center">
                Model confidence distribution across all predictions
              </p>
            </>
          )}

          {/* Urgency breakdown */}
          {view === "urgency" && (
            <>
              <div className="space-y-2">
                {urgencyData.map(({ name, value }) => {
                  const pct = items.length > 0 ? (value / items.length) * 100 : 0;
                  return (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-xs w-16 text-gray-400">{name}</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-5 overflow-hidden">
                        <div
                          className="h-5 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                          style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: URGENCY_COLORS[name] ?? "#6b7280" }}
                        >
                          <span className="text-xs text-white font-medium">{value}</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-600 text-center mt-1">
                Repair urgency breakdown across all inspections
              </p>
            </>
          )}

          {/* Daily counts */}
          {view === "daily" && (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 9 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} width={24} />
                  <Tooltip
                    contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, color: "#9ca3af" }} />
                  {["Good", "Crack", "Pothole", "Vandalism"].map(cls => (
                    <Bar key={cls} dataKey={cls} stackId="a" fill={CLASS_COLORS[cls]}
                      radius={cls === "Vandalism" ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-600 text-center">
                Daily inspection counts by damage class (last 14 days)
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
