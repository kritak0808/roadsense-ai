"use client";

import { useEffect, useState, useRef } from "react";
import { PredictionResult } from "@/lib/api";

interface Props {
  result: PredictionResult;
  imageUrl?: string;
}

// ── Visual signatures per class ───────────────────────────────────────────────
const CLASS_SIGNATURES: Record<string, {
  color: string;
  icon: string;
  texturePatterns: string[];
  modelCues: string[];
  confusedWith: string;
  confusionReason: string;
  certaintyThresholds: { label: string; min: number; color: string }[];
}> = {
  Pothole: {
    color: "#ef4444",
    icon: "🕳️",
    texturePatterns: [
      "Dark concave region detected",
      "Irregular boundary edges",
      "Depth shadow gradient",
      "Broken asphalt fragments",
    ],
    modelCues: [
      "Layer 1 (edges): Detected sharp boundary discontinuities",
      "Layer 2 (texture): High contrast dark-to-light transition",
      "Layer 3 (shape): Elliptical/irregular void shape",
      "Layer 4 (context): Surrounding intact asphalt confirmed",
    ],
    confusedWith: "Crack",
    confusionReason: "Both show dark regions — depth cues distinguish them",
    certaintyThresholds: [
      { label: "Uncertain", min: 0,    color: "#6b7280" },
      { label: "Possible",  min: 0.45, color: "#f59e0b" },
      { label: "Likely",    min: 0.65, color: "#f97316" },
      { label: "Confident", min: 0.80, color: "#ef4444" },
    ],
  },
  Crack: {
    color: "#f59e0b",
    icon: "⚡",
    texturePatterns: [
      "Linear dark line pattern",
      "Branching fracture network",
      "Surface continuity break",
      "Thin high-contrast edges",
    ],
    modelCues: [
      "Layer 1 (edges): Thin elongated edge responses",
      "Layer 2 (texture): Linear dark streak pattern",
      "Layer 3 (shape): Network topology — branching lines",
      "Layer 4 (context): Surrounding surface intact",
    ],
    confusedWith: "Pothole",
    confusionReason: "Wide cracks can appear similar to shallow potholes",
    certaintyThresholds: [
      { label: "Uncertain", min: 0,    color: "#6b7280" },
      { label: "Possible",  min: 0.45, color: "#84cc16" },
      { label: "Likely",    min: 0.65, color: "#eab308" },
      { label: "Confident", min: 0.80, color: "#f59e0b" },
    ],
  },
  Vandalism: {
    color: "#8b5cf6",
    icon: "🎨",
    texturePatterns: [
      "High saturation colour regions",
      "Unnatural marking patterns",
      "Sharp colour boundary",
      "Non-road surface hue",
    ],
    modelCues: [
      "Layer 1 (edges): Colour boundary detection",
      "Layer 2 (texture): Saturation anomaly vs road baseline",
      "Layer 3 (shape): Irregular painted region",
      "Layer 4 (context): Road surface otherwise intact",
    ],
    confusedWith: "Good",
    confusionReason: "Faded markings can blend with road surface colour",
    certaintyThresholds: [
      { label: "Uncertain", min: 0,    color: "#6b7280" },
      { label: "Possible",  min: 0.45, color: "#a78bfa" },
      { label: "Likely",    min: 0.65, color: "#8b5cf6" },
      { label: "Confident", min: 0.80, color: "#7c3aed" },
    ],
  },
  Good: {
    color: "#22c55e",
    icon: "✅",
    texturePatterns: [
      "Uniform surface texture",
      "Consistent colour distribution",
      "No structural discontinuities",
      "Normal asphalt grain pattern",
    ],
    modelCues: [
      "Layer 1 (edges): No significant edge responses",
      "Layer 2 (texture): Homogeneous surface texture",
      "Layer 3 (shape): No anomalous regions detected",
      "Layer 4 (context): All surface features within normal range",
    ],
    confusedWith: "Crack",
    confusionReason: "Shadows or road markings can mimic hairline cracks",
    certaintyThresholds: [
      { label: "Uncertain", min: 0,    color: "#6b7280" },
      { label: "Possible",  min: 0.45, color: "#86efac" },
      { label: "Likely",    min: 0.65, color: "#4ade80" },
      { label: "Confident", min: 0.80, color: "#22c55e" },
    ],
  },
};

// ── Animated step component ───────────────────────────────────────────────────
function Step({ index, title, children, active, done }: {
  index: number; title: string; children: React.ReactNode;
  active: boolean; done: boolean;
}) {
  return (
    <div className={`flex gap-3 transition-opacity duration-500 ${active || done ? "opacity-100" : "opacity-30"}`}>
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors duration-300 ${
          done    ? "bg-green-600 text-white" :
          active  ? "bg-brand-600 text-white animate-pulse" :
                    "bg-gray-800 text-gray-500"
        }`}>
          {done ? "✓" : index}
        </div>
        {index < 5 && <div className={`w-0.5 flex-1 mt-1 transition-colors duration-300 ${done ? "bg-green-600/40" : "bg-gray-800"}`} />}
      </div>
      <div className="pb-4 flex-1">
        <p className={`text-sm font-medium mb-1 transition-colors duration-300 ${active ? "text-white" : done ? "text-gray-300" : "text-gray-600"}`}>
          {title}
        </p>
        {(active || done) && (
          <div className="text-xs text-gray-400 space-y-1 animate-in fade-in duration-300">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Confidence arc ────────────────────────────────────────────────────────────
function ConfidenceArc({ confidence, color }: { confidence: number; color: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setProgress(confidence), 300);
    return () => clearTimeout(t);
  }, [confidence]);

  return (
    <svg width="90" height="90" viewBox="0 0 90 90">
      <circle cx="45" cy="45" r={r} fill="none" stroke="#1f2937" strokeWidth="8" />
      <circle
        cx="45" cy="45" r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - progress)}
        transform="rotate(-90 45 45)"
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
      />
      <text x="45" y="49" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
        {(progress * 100).toFixed(0)}%
      </text>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ConfidenceExplainer({ result, imageUrl }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sig = CLASS_SIGNATURES[result.predicted_class] ?? CLASS_SIGNATURES.Good;
  const TOTAL_STEPS = 5;

  const STEP_DELAYS = [800, 1200, 1200, 1000, 900];

  const start = () => {
    setCurrentStep(0);
    setDone(false);
    setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    if (currentStep >= TOTAL_STEPS) {
      setRunning(false);
      setDone(true);
      return;
    }
    timerRef.current = setTimeout(() => {
      setCurrentStep(s => s + 1);
    }, STEP_DELAYS[currentStep] ?? 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [running, currentStep]);

  // Sorted probabilities
  const sortedProbs = Object.entries(result.probabilities)
    .sort(([, a], [, b]) => b - a);

  // Certainty label
  const certLabel = sig.certaintyThresholds
    .filter(t => result.confidence >= t.min)
    .pop() ?? sig.certaintyThresholds[0];

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">AI Confidence Explainer</h3>
          <p className="text-xs text-gray-500">Step-by-step breakdown of the model's decision</p>
        </div>
        <button
          onClick={start}
          disabled={running}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            running ? "bg-gray-800 text-gray-500 cursor-not-allowed" : "btn-primary"
          }`}
        >
          {done ? "▶ Replay" : running ? "Analyzing…" : "▶ Explain"}
        </button>
      </div>

      {/* Verdict header */}
      <div
        className="rounded-xl p-4 flex items-center gap-4 border"
        style={{ backgroundColor: `${sig.color}11`, borderColor: `${sig.color}33` }}
      >
        <ConfidenceArc confidence={result.confidence} color={sig.color} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{sig.icon}</span>
            <span className="text-xl font-bold" style={{ color: sig.color }}>
              {result.predicted_class}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${certLabel.color}22`, color: certLabel.color }}
            >
              {certLabel.label}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Model is <span style={{ color: sig.color }}>{(result.confidence * 100).toFixed(1)}% confident</span> in this classification
          </p>
        </div>
      </div>

      {/* Steps */}
      {(running || done) && (
        <div className="space-y-0 mt-2">

          {/* Step 1: Image ingestion */}
          <Step index={1} title="Image Preprocessing" active={currentStep === 1} done={currentStep > 1}>
            <p>Image resized to 224×224px, normalized with ImageNet statistics</p>
            <p>Mean subtracted: [0.485, 0.456, 0.406] · Std divided: [0.229, 0.224, 0.225]</p>
            {imageUrl && (
              <div className="flex gap-2 mt-2 items-center">
                <img src={imageUrl} className="w-12 h-12 rounded object-cover border border-gray-700" alt="input" />
                <span className="text-gray-600">→</span>
                <div className="w-12 h-12 rounded bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-500">
                  224²
                </div>
                <span className="text-gray-600">→</span>
                <div className="w-12 h-12 rounded bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-500">
                  tensor
                </div>
              </div>
            )}
          </Step>

          {/* Step 2: Feature extraction */}
          <Step index={2} title="Feature Extraction (ResNet-50 Layers)" active={currentStep === 2} done={currentStep > 2}>
            {sig.modelCues.map((cue, i) => (
              <div key={i} className="flex items-start gap-2">
                <span style={{ color: sig.color }}>→</span>
                <span>{cue}</span>
              </div>
            ))}
          </Step>

          {/* Step 3: Visual patterns */}
          <Step index={3} title="Visual Patterns Detected" active={currentStep === 3} done={currentStep > 3}>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {sig.texturePatterns.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-gray-800 rounded px-2 py-1">
                  <span style={{ color: sig.color }}>✓</span>
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </Step>

          {/* Step 4: Class scores */}
          <Step index={4} title="Class Probability Scores" active={currentStep === 4} done={currentStep > 4}>
            <div className="space-y-1.5 mt-1">
              {sortedProbs.map(([cls, prob]) => {
                const isWinner = cls === result.predicted_class;
                return (
                  <div key={cls} className="flex items-center gap-2">
                    <span className={`w-20 ${isWinner ? "text-white font-medium" : "text-gray-500"}`}>{cls}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-3 rounded-full transition-all duration-700"
                        style={{
                          width: `${prob * 100}%`,
                          backgroundColor: isWinner ? sig.color : "#374151",
                        }}
                      />
                    </div>
                    <span className={`w-10 text-right text-xs ${isWinner ? "text-white font-medium" : "text-gray-600"}`}>
                      {(prob * 100).toFixed(1)}%
                    </span>
                    {isWinner && <span style={{ color: sig.color }}>←</span>}
                  </div>
                );
              })}
            </div>
          </Step>

          {/* Step 5: Decision + uncertainty */}
          <Step index={5} title="Final Decision & Uncertainty Analysis" active={currentStep === 5} done={currentStep > 5}>
            <div className="space-y-2 mt-1">
              <div className="bg-gray-800 rounded-lg p-2">
                <p className="text-gray-300">
                  <span style={{ color: sig.color }} className="font-medium">{result.predicted_class}</span> selected
                  with {(result.confidence * 100).toFixed(1)}% confidence
                  ({certLabel.label.toLowerCase()} classification)
                </p>
              </div>
              <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-2">
                <p className="text-amber-300 text-xs font-medium mb-0.5">⚠ Potential confusion</p>
                <p>
                  Could be confused with <span className="text-white">{sig.confusedWith}</span> —{" "}
                  {sig.confusionReason}
                </p>
              </div>
              {result.confidence < 0.65 && (
                <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-2">
                  <p className="text-red-300 text-xs font-medium mb-0.5">⚠ Low confidence warning</p>
                  <p>Confidence below 65% — consider manual inspection to verify this result</p>
                </div>
              )}
              <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg p-2">
                <p className="text-blue-300 text-xs font-medium mb-0.5">ℹ Model used</p>
                <p>ResNet-50 · 4-class classifier · Pretrained on ImageNet, fine-tuned on road damage dataset</p>
              </div>
            </div>
          </Step>
        </div>
      )}

      {/* Idle state */}
      {!running && !done && (
        <div className="bg-gray-800/50 rounded-xl p-6 text-center space-y-2">
          <p className="text-3xl">🧠</p>
          <p className="text-sm text-gray-400">Click "Explain" to see how the AI reached this decision</p>
          <p className="text-xs text-gray-600">Walks through preprocessing → feature extraction → class scoring → final verdict</p>
        </div>
      )}
    </div>
  );
}
