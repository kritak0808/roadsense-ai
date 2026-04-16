"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { api, PredictionResult } from "@/lib/api";

export default function LiveVideoInference() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);
  const [fps, setFps] = useState(0);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [avgConf, setAvgConf] = useState(0);
  const [warmingUp, setWarmingUp] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const confHistory = useRef<number[]>([]);
  const frameCount = useRef(0);
  const lastFpsTime = useRef(Date.now());

  const CLASS_COLORS: Record<string, string> = {
    Good: "#22c55e", Crack: "#f59e0b", Pothole: "#ef4444", Vandalism: "#8b5cf6",
  };

  const drawOverlay = useCallback((r: PredictionResult) => {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const color = CLASS_COLORS[r.predicted_class] ?? "#fff";
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    ctx.fillStyle = color;
    ctx.font = "bold 20px Inter, sans-serif";
    ctx.fillText(`${r.predicted_class} ${(r.confidence * 100).toFixed(1)}%`, 20, 40);
  }, []);

  const pendingRef = useRef(false);

  const captureAndPredict = useCallback(async () => {
    if (pendingRef.current) return; // skip if previous request still in flight
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      pendingRef.current = true;
      const form = new FormData();
      form.append("file", blob, "frame.jpg");
      try {
        const { data } = await api.predict.videoFrame(form);
        setResult(data.data);
        setWarmingUp(false);
        drawOverlay(data.data);
        confHistory.current.push(data.data.confidence);
        if (confHistory.current.length > 20) confHistory.current.shift();
        setAvgConf(confHistory.current.reduce((a, b) => a + b, 0) / confHistory.current.length);
      } catch { /* ignore frame errors */ }
      finally { pendingRef.current = false; }
    }, "image/jpeg", 0.7);

    frameCount.current++;
    const now = Date.now();
    if (now - lastFpsTime.current >= 1000) {
      setFps(frameCount.current);
      frameCount.current = 0;
      lastFpsTime.current = now;
    }
  }, [drawOverlay]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setActive(true);
      setWarmingUp(true);
      intervalRef.current = setInterval(captureAndPredict, 500);
    } catch {
      alert("Camera access denied or unavailable");
    }
  };

  const stopCamera = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setResult(null);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Live Video Inference</h3>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span>{fps} FPS</span>
          <span>Avg conf: {(avgConf * 100).toFixed(1)}%</span>
        </div>
      </div>

      <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        <canvas ref={canvasRef} className="hidden" />
        {!active && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-500">Camera inactive</p>
          </div>
        )}
        {active && warmingUp && (
          <div className="absolute top-2 left-2 bg-black/70 text-yellow-400 text-xs px-2 py-1 rounded-full flex items-center gap-1.5">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            Loading AI model… first frame may take ~30s
          </div>
        )}
      </div>

      {result && (
        <div className="flex items-center gap-3 text-sm">
          <span className="font-bold" style={{ color: { Good: "#22c55e", Crack: "#f59e0b", Pothole: "#ef4444", Vandalism: "#8b5cf6" }[result.predicted_class] }}>
            {result.predicted_class}
          </span>
          <span className="text-gray-400">{(result.confidence * 100).toFixed(1)}% confidence</span>
          <span className="text-gray-500">{result.latency_ms}ms</span>
        </div>
      )}

      <button onClick={active ? stopCamera : startCamera} className={active ? "btn-secondary w-full" : "btn-primary w-full"}>
        {active ? "⏹ Stop Camera" : "▶ Start Live Inference"}
      </button>
    </div>
  );
}
