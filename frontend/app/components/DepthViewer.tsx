"use client";

import { useState } from "react";

interface Props {
  originalUrl: string;
  depthB64: string | null;
  depthClass?: string;
  depthDelta?: number;
}

export default function DepthViewer({ originalUrl, depthB64, depthClass, depthDelta }: Props) {
  const [sliderX, setSliderX] = useState(50);

  if (!depthB64) return null;

  const depthUrl = `data:image/png;base64,${depthB64}`;

  const DEPTH_COLORS: Record<string, string> = {
    Shallow: "text-green-400",
    Medium: "text-amber-400",
    Deep: "text-red-400",
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Pothole Depth Estimator</h3>
        {depthClass && (
          <span className={`font-bold ${DEPTH_COLORS[depthClass] ?? "text-white"}`}>
            {depthClass} {depthDelta !== undefined && `(Δ${(depthDelta * 100).toFixed(1)}%)`}
          </span>
        )}
      </div>

      {/* Split-view slider */}
      <div
        className="relative rounded-lg overflow-hidden select-none"
        style={{ height: 200 }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setSliderX(((e.clientX - rect.left) / rect.width) * 100);
        }}
      >
        <img src={originalUrl} alt="Original" className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderX}% 0 0)` }}
        >
          <img src={depthUrl} alt="Depth" className="absolute inset-0 w-full h-full object-cover" />
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white cursor-ew-resize"
          style={{ left: `${sliderX}%` }}
        />
        <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-1 rounded">Original</div>
        <div className="absolute bottom-2 right-2 text-xs text-white bg-black/50 px-1 rounded">Depth</div>
      </div>

      <p className="text-xs text-gray-500">Drag to compare original vs MiDaS depth map</p>
    </div>
  );
}
