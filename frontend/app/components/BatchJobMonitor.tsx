"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface BatchResult {
  file: string;
  predicted_class?: string;
  confidence?: number;
  severity_score?: number;
  error?: string;
}

interface JobState {
  job_id: string;
  status: string;
  progress: number;
  total: number;
  result?: { count: number; results: BatchResult[] };
}

const CLASS_COLORS: Record<string, string> = {
  Good:      "text-green-400",
  Crack:     "text-amber-400",
  Pothole:   "text-red-400",
  Vandalism: "text-purple-400",
};

const CLASS_BG: Record<string, string> = {
  Good:      "bg-green-900/30",
  Crack:     "bg-amber-900/30",
  Pothole:   "bg-red-900/30",
  Vandalism: "bg-purple-900/30",
};

interface Props { jobId: string | null; }

export default function BatchJobMonitor({ jobId }: Props) {
  const [job, setJob] = useState<JobState | null>(null);

  useEffect(() => {
    if (!jobId) return;

    // Initial fetch
    const fetchStatus = async () => {
      try {
        const { data } = await api.predict.batchStatus(jobId);
        setJob({ job_id: jobId, ...data.data } as JobState);
        return data.data.status;
      } catch { return null; }
    };

    fetchStatus();

    // Poll every 2s until done
    const poll = setInterval(async () => {
      const status = await fetchStatus();
      if (status === "done" || status === "failed") clearInterval(poll);
    }, 2000);

    return () => clearInterval(poll);
  }, [jobId]);

  if (!jobId || !job) return null;

  const pct = job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0;
  const results: BatchResult[] = job.result?.results ?? [];

  // Summary counts
  const counts: Record<string, number> = {};
  results.forEach((r) => {
    if (r.predicted_class) counts[r.predicted_class] = (counts[r.predicted_class] ?? 0) + 1;
  });

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Batch Processing</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          job.status === "done"    ? "bg-green-900 text-green-300" :
          job.status === "running" ? "bg-blue-900 text-blue-300 animate-pulse" :
          job.status === "failed"  ? "bg-red-900 text-red-300" :
          "bg-gray-800 text-gray-400"
        }`}>
          {job.status === "running" ? "⚙ Processing…" : job.status === "done" ? "✓ Complete" : job.status}
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm text-gray-400">
          <span>{job.progress} / {job.total} images</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              job.status === "done" ? "bg-green-500" : "bg-brand-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Summary when done */}
      {job.status === "done" && Object.keys(counts).length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Summary</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(counts).map(([cls, count]) => (
              <div key={cls} className={`rounded-lg px-3 py-2 flex items-center justify-between ${CLASS_BG[cls] ?? "bg-gray-800"}`}>
                <span className={`text-sm font-medium ${CLASS_COLORS[cls] ?? "text-white"}`}>{cls}</span>
                <span className="text-white font-bold text-sm">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results table */}
      {job.status === "done" && results.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Results ({results.length} images)
          </p>
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {results.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2 text-sm"
              >
                <span className="text-gray-400 truncate max-w-[140px]" title={r.file}>
                  {r.file}
                </span>
                {r.error ? (
                  <span className="text-red-400 text-xs">Error</span>
                ) : (
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`font-medium ${CLASS_COLORS[r.predicted_class!] ?? "text-white"}`}>
                      {r.predicted_class}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {((r.confidence ?? 0) * 100).toFixed(1)}%
                    </span>
                    <div className="w-12 bg-gray-700 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-brand-500"
                        style={{ width: `${(r.confidence ?? 0) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Running — show latest */}
      {job.status === "running" && results.length > 0 && (
        <div className="text-xs text-gray-400">
          Latest:{" "}
          <span className={CLASS_COLORS[results[results.length - 1]?.predicted_class ?? ""] ?? "text-white"}>
            {results[results.length - 1]?.predicted_class}
          </span>{" "}
          ({((results[results.length - 1]?.confidence ?? 0) * 100).toFixed(1)}%)
        </div>
      )}
    </div>
  );
}
