"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

interface Props {
  file: File | null;
  predictedClass: string;
  autoRun?: boolean;
}

export default function RepairSimulator({ file, predictedClass, autoRun }: Props) {
  const [originalB64, setOriginalB64] = useState<string | null>(null);
  const [repairedB64, setRepairedB64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sliderX, setSliderX] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const runSimulation = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setOriginalB64(null);
    setRepairedB64(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("predicted_class", predictedClass);
      const { data } = await api.simulate(form);
      setOriginalB64(data.data.original_b64);
      setRepairedB64(data.data.repaired_b64);
      setSliderX(50);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Simulation failed";
      setError(msg);
      toast.error("Simulation failed");
    } finally {
      setLoading(false);
    }
  }, [file, predictedClass]);

  // Auto-run when component mounts with a file
  useEffect(() => {
    if (autoRun && file && !repairedB64 && !loading) {
      runSimulation();
    }
  }, [autoRun, file]);

  const updateSlider = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
    setSliderX(x);
  };

  const REPAIR_LABELS: Record<string, string> = {
    Pothole:   "Pothole filled with hot-mix asphalt patch",
    Crack:     "Cracks sealed with rubberized sealant",
    Vandalism: "Markings removed via inpainting",
    Good:      "Surface enhanced — no repair needed",
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Before / After Repair Simulator</h3>
        <div className="flex gap-2">
          {repairedB64 && (
            <button
              onClick={runSimulation}
              disabled={loading}
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              Re-run
            </button>
          )}
          {!repairedB64 && !loading && (
            <button
              onClick={runSimulation}
              disabled={!file}
              className="btn-primary text-xs py-1.5 px-3"
            >
              Simulate Repair
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-gray-800 rounded-xl h-48 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Generating repaired image…</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-center">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={runSimulation} className="mt-2 text-xs text-gray-400 hover:text-white">
            Try again
          </button>
        </div>
      )}

      {/* Idle state */}
      {!loading && !error && !repairedB64 && (
        <div className="bg-gray-800 rounded-xl h-48 flex flex-col items-center justify-center gap-2 text-gray-500">
          <span className="text-4xl">🔧</span>
          <p className="text-sm">Click "Simulate Repair" to generate before/after view</p>
          <p className="text-xs text-gray-600">Uses computer vision to simulate road repair</p>
        </div>
      )}

      {/* Slider comparison */}
      {!loading && !error && repairedB64 && originalB64 && (
        <>
          <div
            ref={containerRef}
            className="relative rounded-xl overflow-hidden select-none"
            style={{ height: 280, cursor: "col-resize" }}
            onMouseMove={(e) => { if (dragging) updateSlider(e.clientX); }}
            onMouseDown={(e) => { setDragging(true); updateSlider(e.clientX); }}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
            onTouchMove={(e) => updateSlider(e.touches[0].clientX)}
          >
            {/* After (repaired) — full background */}
            <img
              src={`data:image/jpeg;base64,${repairedB64}`}
              alt="After repair"
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />

            {/* Before (original) — clipped left portion */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${sliderX}%` }}
            >
              <img
                src={`data:image/jpeg;base64,${originalB64}`}
                alt="Before repair"
                className="absolute inset-0 h-full object-cover"
                style={{ width: containerRef.current?.offsetWidth ?? 500 }}
                draggable={false}
              />
            </div>

            {/* Divider line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              style={{ left: `${sliderX}%`, pointerEvents: "none" }}
            >
              {/* Drag handle */}
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 bg-white rounded-full shadow-xl flex items-center justify-center border-2 border-gray-200">
                <span className="text-gray-600 text-sm font-bold">⇔</span>
              </div>
            </div>

            {/* Corner labels */}
            <span className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">
              Before
            </span>
            <span className="absolute top-2 right-2 bg-green-800/90 text-green-200 text-xs px-2 py-0.5 rounded-full pointer-events-none">
              After
            </span>
          </div>

          <p className="text-xs text-gray-500 text-center">
            🔧 {REPAIR_LABELS[predictedClass] ?? "Repair simulated"} — drag slider to compare
          </p>
        </>
      )}
    </div>
  );
}
