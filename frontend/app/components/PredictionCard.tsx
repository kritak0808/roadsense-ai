"use client";

import { PredictionResult } from "@/lib/api";
import { clsx } from "clsx";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";

const CLASS_COLORS: Record<string, string> = {
  Good: "text-green-400",
  Crack: "text-amber-400",
  Pothole: "text-red-400",
  Vandalism: "text-purple-400",
};

const BADGE_CLASSES: Record<string, string> = {
  Good: "badge-good",
  Crack: "badge-crack",
  Pothole: "badge-pothole",
  Vandalism: "badge-vandalism",
};

interface Props {
  result: PredictionResult;
  imageUrl?: string;
  gradcamUrl?: string;
}

export default function PredictionCard({ result, imageUrl, gradcamUrl }: Props) {
  const radarData = Object.entries(result.probabilities).map(([cls, val]) => ({
    subject: cls,
    value: Math.round(val * 100),
  }));

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className={clsx("text-2xl font-bold", CLASS_COLORS[result.predicted_class])}>
            {result.predicted_class}
          </span>
          <span className={clsx("ml-2", BADGE_CLASSES[result.predicted_class])}>
            {(result.confidence * 100).toFixed(1)}%
          </span>
        </div>
        <div className="text-right text-sm text-gray-400">
          <div>Severity: <span className="text-white font-medium">{result.severity_score}</span></div>
          <div>{result.latency_ms}ms · {result.arch ?? "ensemble"}</div>
        </div>
      </div>

      {/* Images */}
      {(imageUrl || gradcamUrl) && (
        <div className="grid grid-cols-2 gap-3">
          {imageUrl && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Original</p>
              <img src={imageUrl} alt="Original" className="rounded-lg w-full object-cover h-40" />
            </div>
          )}
          {gradcamUrl && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Grad-CAM</p>
              <img src={gradcamUrl} alt="Grad-CAM" className="rounded-lg w-full object-cover h-40" />
            </div>
          )}
        </div>
      )}

      {/* Probability bars */}
      <div className="space-y-2">
        {Object.entries(result.probabilities).map(([cls, prob]) => (
          <div key={cls} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-20">{cls}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <div
                className={clsx("h-2 rounded-full transition-all", {
                  "bg-green-500": cls === "Good",
                  "bg-amber-500": cls === "Crack",
                  "bg-red-500": cls === "Pothole",
                  "bg-purple-500": cls === "Vandalism",
                })}
                style={{ width: `${prob * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-300 w-10 text-right">
              {(prob * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* Radar chart for ensemble */}
      {result.per_model && (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cost estimate */}
      {result.cost_estimate && (
        <div className="bg-gray-800 rounded-lg p-3 text-sm">
          <p className="text-gray-400 mb-1">Repair Cost Estimate</p>
          <div className="flex justify-between">
            <span className="text-green-400">${result.cost_estimate.low.toFixed(0)}</span>
            <span className="text-white font-bold">${result.cost_estimate.mid.toFixed(0)}</span>
            <span className="text-red-400">${result.cost_estimate.high.toFixed(0)}</span>
          </div>
          <p className="text-center text-xs text-gray-500 mt-1">
            Urgency: <span className="text-amber-400">{result.cost_estimate.urgency}</span>
          </p>
        </div>
      )}
    </div>
  );
}
