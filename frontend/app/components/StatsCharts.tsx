"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { StatsData } from "@/lib/api";

const CLASS_COLORS: Record<string, string> = {
  Good: "#22c55e", Crack: "#f59e0b", Pothole: "#ef4444", Vandalism: "#8b5cf6",
};

interface Props { stats: StatsData; }

export default function StatsCharts({ stats }: Props) {
  const pieData = Object.entries(stats.class_distribution).map(([name, value]) => ({ name, value }));
  const dailyData = [...stats.daily_counts].reverse();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* KPI cards */}
      <div className="card text-center">
        <div className="text-3xl font-bold text-white">{stats.total_predictions.toLocaleString()}</div>
        <div className="text-gray-400 text-sm mt-1">Total Predictions</div>
      </div>
      <div className="card text-center">
        <div className="text-3xl font-bold text-brand-400">{(stats.average_confidence * 100).toFixed(1)}%</div>
        <div className="text-gray-400 text-sm mt-1">Avg Confidence</div>
      </div>
      <div className="card text-center">
        <div className="text-3xl font-bold text-amber-400">{stats.average_severity.toFixed(1)}</div>
        <div className="text-gray-400 text-sm mt-1">Avg Severity Score</div>
      </div>

      {/* Class distribution pie */}
      <div className="card">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Class Distribution</h4>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={CLASS_COLORS[entry.name] ?? "#6b7280"} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Daily trend */}
      <div className="card md:col-span-2">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Daily Predictions (30d)</h4>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 9 }} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151" }} />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
