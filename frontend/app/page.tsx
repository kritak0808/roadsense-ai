"use client";

import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import UploadZone from "./components/UploadZone";
import PredictionCard from "./components/PredictionCard";
import SeverityMeter from "./components/SeverityMeter";
import RepairCard from "./components/RepairCard";
import RepairSimulator from "./components/RepairSimulator";
import ConfidenceExplainer from "./components/ConfidenceExplainer";
import DepthViewer from "./components/DepthViewer";
import LiveVideoInference from "./components/LiveVideoInference";
import ROICalculator from "./components/ROICalculator";import ChatBot from "./components/ChatBot";
import BatchJobMonitor from "./components/BatchJobMonitor";
import StatsCharts from "./components/StatsCharts";
import { api, PredictionResult, StatsData } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import toast from "react-hot-toast";

type Mode = "single" | "simulate" | "batch" | "live";

export default function HomePage() {
  const [mode, setMode] = useState<Mode>("single");
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const { fetchMe } = useAuth();

  useEffect(() => {
    fetchMe();
    api.history.stats().then(({ data }) => setStats(data.data)).catch(() => {});
    // Request geolocation on load
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // silently ignore if denied
      );
    }
  }, []);

  const handleFile = (files: File[]) => {
    const f = files[0];
    setFile(f);
    setImageUrl(URL.createObjectURL(f));
    setResult(null);
  };

  const handleBatchFiles = async (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    try {
      const { data } = await api.predict.batch(form);
      setBatchJobId(data.data.job_id);
      toast.success(`Batch job started: ${data.data.total} images`);
    } catch { toast.error("Batch submission failed"); }
  };

  const predict = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("model", "resnet50");
      if (coords) {
        form.append("lat", String(coords.lat));
        form.append("lng", String(coords.lng));
      }
      const { data } = await api.predict.single(form);
      setResult(data.data);
      toast.success(`${data.data.predicted_class} detected`);
    } catch {
      toast.error("Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  const BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://roadsense-ai-1.onrender.com";

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Mode selector */}
        <div className="flex gap-2 flex-wrap">
          {(["single", "simulate", "batch", "live"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                mode === m ? "bg-brand-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {m === "single"   && "🔍 "}
              {m === "simulate" && "🔧 "}
              {m === "batch"    && "📦 "}
              {m === "live"     && "📹 "}
              {m === "simulate" ? "Repair Sim" : m}
            </button>
          ))}
        </div>

        {/* Live mode */}
        {mode === "live" && <LiveVideoInference />}

        {/* Upload modes */}
        {mode !== "live" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <UploadZone
                onFiles={mode === "batch" ? handleBatchFiles : handleFile}
                multiple={mode === "batch"}
                label={
                  mode === "batch" ? "Drop multiple images for batch processing" :
                  mode === "simulate" ? "Drop road image — predict then simulate repair" :
                  "Drop road image here"
                }
              />

              {file && mode !== "batch" && (
                <div className="space-y-2">
                  <button onClick={predict} disabled={loading} className="btn-primary w-full">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Analyzing… (first run may take ~30s)
                      </span>
                    ) : "Run prediction"}
                  </button>
                  <p className="text-xs text-center text-gray-600">
                    {coords
                      ? `📍 ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                      : "📍 Location not available — allow browser location for map tracking"}
                  </p>
                </div>
              )}

              {imageUrl && (
                <img src={imageUrl} alt="Preview" className="rounded-xl w-full object-cover max-h-64" />
              )}

              {batchJobId && <BatchJobMonitor jobId={batchJobId} />}
            </div>

            <div className="space-y-4">
              {result && (
                <>
                  <PredictionCard
                    result={result}
                    imageUrl={imageUrl ?? undefined}
                    gradcamUrl={result.gradcam_path ? `${BASE}${result.gradcam_path}` : undefined}
                  />
                  <SeverityMeter
                    severityScore={result.severity_score}
                    predictedClass={result.predicted_class}
                    confidence={result.confidence}
                  />
                  <RepairCard
                    predictedClass={result.predicted_class}
                    severityScore={result.severity_score}
                    costEstimate={result.cost_estimate}
                  />
                  <ConfidenceExplainer
                    result={result}
                    imageUrl={imageUrl ?? undefined}
                  />
                  {mode === "simulate" && (
                    <RepairSimulator
                      file={file}
                      predictedClass={result.predicted_class}
                      autoRun
                    />
                  )}
                  {result.predicted_class === "Pothole" && result.depth && (
                    <DepthViewer
                      originalUrl={imageUrl!}
                      depthB64={(result.depth as Record<string, string>).depth_b64 ?? null}
                      depthClass={(result.depth as Record<string, string>).pothole_depth_class}
                      depthDelta={Number((result.depth as Record<string, number>).depth_delta)}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        {stats && <StatsCharts stats={stats} />}

        {/* ROI Calculator */}
        <ROICalculator
          predictedClass={result?.predicted_class}
          severityScore={result?.severity_score}
          costEstimate={result?.cost_estimate}
        />
      </main>

      <ChatBot context={result ?? undefined} />
    </div>
  );
}
