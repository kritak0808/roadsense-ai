"use client";

import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import RoadHealthTimeline from "../components/RoadHealthTimeline";
import WeatherCorrelation from "../components/WeatherCorrelation";
import { api, HistoryItem } from "@/lib/api";
import toast from "react-hot-toast";

const BADGE: Record<string, string> = {
  Good: "badge-good", Crack: "badge-crack", Pothole: "badge-pothole", Vandalism: "badge-vandalism",
};

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.history.list({ page: p, per_page: 20, class: filter || undefined });
      setItems(data.data.items);
      setTotal(data.data.total);
      setPages(data.data.pages);
      setPage(p);
    } catch { toast.error("Failed to load history"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, [filter]);

  const exportCSV = async () => {
    const { data } = await api.history.exportCsv();
    const url = URL.createObjectURL(data as Blob);
    const a = document.createElement("a"); a.href = url; a.download = "predictions.csv"; a.click();
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-white">Prediction History ({total})</h1>
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
            >
              <option value="">All classes</option>
              {["Good", "Crack", "Pothole", "Vandalism"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button onClick={exportCSV} className="btn-secondary text-sm">Export CSV</button>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left py-2 pr-4">File</th>
                <th className="text-left py-2 pr-4">Class</th>
                <th className="text-left py-2 pr-4">Confidence</th>
                <th className="text-left py-2 pr-4">Severity</th>
                <th className="text-left py-2 pr-4">Urgency</th>
                <th className="text-left py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-500">Loading…</td></tr>
              )}
              {!loading && items.map((item) => (
                <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 pr-4 text-gray-300 truncate max-w-xs">{item.original_filename}</td>
                  <td className="py-2 pr-4"><span className={BADGE[item.predicted_class]}>{item.predicted_class}</span></td>
                  <td className="py-2 pr-4 text-white">{(item.confidence * 100).toFixed(1)}%</td>
                  <td className="py-2 pr-4 text-gray-300">{item.severity_score}</td>
                  <td className="py-2 pr-4 text-amber-400 text-xs">{item.repair_urgency ?? "—"}</td>
                  <td className="py-2 text-gray-500 text-xs">{new Date(item.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => load(page - 1)} disabled={page === 1} className="btn-secondary text-sm py-1">←</button>
              <span className="text-gray-400 text-sm py-1">{page} / {pages}</span>
              <button onClick={() => load(page + 1)} disabled={page === pages} className="btn-secondary text-sm py-1">→</button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RoadHealthTimeline />
          <WeatherCorrelation />
        </div>
      </main>
    </div>
  );
}
