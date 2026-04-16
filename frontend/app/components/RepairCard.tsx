"use client";

import { CostEstimate } from "@/lib/api";

interface Props {
  predictedClass: string;
  severityScore: number;
  costEstimate?: CostEstimate;
}

const REPAIR_DATA: Record<string, {
  icon: string;
  methods: string[];
  materials: string;
  timeline: string;
  prevention: string;
}> = {
  Good: {
    icon: "✅",
    methods: ["Routine inspection", "Preventive sealcoating every 3–5 years"],
    materials: "Sealcoat emulsion",
    timeline: "Schedule in next maintenance cycle",
    prevention: "Maintain drainage, inspect bi-annually",
  },
  Crack: {
    icon: "🔧",
    methods: [
      "Hairline cracks (<3mm): crack sealant injection",
      "Wide cracks (3–10mm): rout and seal",
      "Alligator cracking: mill and overlay",
    ],
    materials: "Hot-pour rubberized crack sealant / cold-mix asphalt",
    timeline: "Within 30 days to prevent water ingress",
    prevention: "Seal cracks promptly, ensure proper drainage",
  },
  Pothole: {
    icon: "🚧",
    methods: [
      "Shallow (<2cm): throw-and-roll patch",
      "Medium (2–5cm): semi-permanent patch with tack coat",
      "Deep (>5cm): full-depth repair with base layer",
    ],
    materials: "Hot-mix asphalt (HMA) or cold-mix for emergency",
    timeline: "Immediate — safety hazard for vehicles",
    prevention: "Seal cracks before they become potholes, improve drainage",
  },
  Vandalism: {
    icon: "🧹",
    methods: [
      "Unauthorized markings: solvent cleaning or pressure wash",
      "Surface damage: patch and repaint road markings",
      "Report to local authorities",
    ],
    materials: "Solvent cleaner, road marking paint",
    timeline: "Within 1 week — cosmetic issue",
    prevention: "Improved lighting and surveillance in affected areas",
  },
};

const URGENCY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  Monitor:  { color: "text-green-400",  bg: "bg-green-900/40",  label: "Monitor" },
  Schedule: { color: "text-amber-400",  bg: "bg-amber-900/40",  label: "Schedule Repair" },
  Urgent:   { color: "text-orange-400", bg: "bg-orange-900/40", label: "Urgent Repair" },
  Critical: { color: "text-red-400",    bg: "bg-red-900/40",    label: "Critical — Act Now" },
};

export default function RepairCard({ predictedClass, severityScore, costEstimate }: Props) {
  const data = REPAIR_DATA[predictedClass] ?? REPAIR_DATA.Good;
  const urgency = costEstimate?.urgency ?? "Monitor";
  const urg = URGENCY_CONFIG[urgency] ?? URGENCY_CONFIG.Monitor;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Repair Recommendation</h3>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${urg.bg} ${urg.color}`}>
          {data.icon} {urg.label}
        </span>
      </div>

      {/* Repair methods */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Repair Methods</p>
        <ul className="space-y-1.5">
          {data.methods.map((m, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
              <span className="text-brand-400 mt-0.5 shrink-0">→</span>
              {m}
            </li>
          ))}
        </ul>
      </div>

      {/* Materials + Timeline */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Materials</p>
          <p className="text-xs text-gray-200">{data.materials}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Timeline</p>
          <p className="text-xs text-gray-200">{data.timeline}</p>
        </div>
      </div>

      {/* Cost estimate */}
      {costEstimate && (
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-2">Estimated Repair Cost</p>
          <div className="flex items-end justify-between">
            <div className="text-center">
              <p className="text-xs text-gray-500">Low</p>
              <p className="text-green-400 font-bold">${costEstimate.low.toFixed(0)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Mid</p>
              <p className="text-white font-bold text-lg">${costEstimate.mid.toFixed(0)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">High</p>
              <p className="text-red-400 font-bold">${costEstimate.high.toFixed(0)}</p>
            </div>
          </div>
          {costEstimate.breakdown && (
            <div className="mt-2 pt-2 border-t border-gray-700 flex justify-between text-xs text-gray-500">
              <span>Labor: ${costEstimate.breakdown.labor.toFixed(0)}</span>
              <span>Materials: ${costEstimate.breakdown.materials.toFixed(0)}</span>
              <span>Equipment: ${costEstimate.breakdown.equipment.toFixed(0)}</span>
            </div>
          )}
        </div>
      )}

      {/* Prevention tip */}
      <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-800/50 rounded-lg p-3">
        <span className="text-blue-400 shrink-0">💡</span>
        <span><span className="text-gray-400">Prevention: </span>{data.prevention}</span>
      </div>
    </div>
  );
}
