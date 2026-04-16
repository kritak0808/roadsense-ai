"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

// ── Constants ─────────────────────────────────────────────────────────────────

const DAMAGE_PARAMS: Record<string, {
  repairCostPerSqm: number;   // USD
  vehicleDamageCostPerDay: number;
  fuelLossPerVehiclePerKm: number; // USD
  accidentRiskMultiplier: number;
  degradationRatePerMonth: number; // severity increase %
}> = {
  Pothole: {
    repairCostPerSqm: 120,
    vehicleDamageCostPerDay: 4.2,
    fuelLossPerVehiclePerKm: 0.008,
    accidentRiskMultiplier: 3.1,
    degradationRatePerMonth: 18,
  },
  Crack: {
    repairCostPerSqm: 35,
    vehicleDamageCostPerDay: 1.1,
    fuelLossPerVehiclePerKm: 0.003,
    accidentRiskMultiplier: 1.4,
    degradationRatePerMonth: 8,
  },
  Vandalism: {
    repairCostPerSqm: 25,
    vehicleDamageCostPerDay: 0.3,
    fuelLossPerVehiclePerKm: 0.001,
    accidentRiskMultiplier: 1.1,
    degradationRatePerMonth: 3,
  },
  Good: {
    repairCostPerSqm: 8,
    vehicleDamageCostPerDay: 0,
    fuelLossPerVehiclePerKm: 0,
    accidentRiskMultiplier: 1.0,
    degradationRatePerMonth: 1,
  },
};

const URGENCY_COLOR: Record<string, string> = {
  Monitor:  "#22c55e",
  Schedule: "#f59e0b",
  Urgent:   "#f97316",
  Critical: "#ef4444",
};

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; fill: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-300 font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  predictedClass?: string;
  severityScore?: number;
  costEstimate?: { low: number; mid: number; high: number; urgency: string };
}

export default function ROICalculator({ predictedClass, severityScore, costEstimate }: Props) {
  const [damageClass, setDamageClass] = useState(predictedClass ?? "Pothole");
  const [areaSqm, setAreaSqm] = useState(12);
  const [trafficPerDay, setTrafficPerDay] = useState(2000);
  const [roadLengthKm, setRoadLengthKm] = useState(1.0);
  const [delayMonths, setDelayMonths] = useState(6);

  const params = DAMAGE_PARAMS[damageClass] ?? DAMAGE_PARAMS.Pothole;

  const calc = useMemo(() => {
    // Repair cost now
    const repairNow = areaSqm * params.repairCostPerSqm;

    // Cost of delay — damage degrades, repair cost compounds
    const degradedSeverity = Math.min(100, (severityScore ?? 50) * (1 + params.degradationRatePerMonth / 100) ** delayMonths);
    const degradationFactor = degradedSeverity / Math.max(1, severityScore ?? 50);
    const repairLater = repairNow * degradationFactor * 1.3; // 30% emergency premium

    // Vehicle damage costs over delay period
    const vehicleDamage = params.vehicleDamageCostPerDay * trafficPerDay * (delayMonths * 30);

    // Fuel efficiency loss
    const fuelLoss = params.fuelLossPerVehiclePerKm * trafficPerDay * roadLengthKm * (delayMonths * 30);

    // Accident risk cost (statistical)
    const baseAccidentCost = 8500; // avg minor accident cost
    const accidentCost = baseAccidentCost * (params.accidentRiskMultiplier - 1) * (delayMonths / 12);

    // Total cost of inaction
    const totalInaction = vehicleDamage + fuelLoss + accidentCost + repairLater;
    const savings = totalInaction - repairNow;
    const roi = repairNow > 0 ? ((savings / repairNow) * 100) : 0;

    // Monthly breakdown for chart
    const monthly = Array.from({ length: delayMonths }, (_, i) => {
      const m = i + 1;
      return {
        month: `M${m}`,
        "Vehicle Damage": Math.round(params.vehicleDamageCostPerDay * trafficPerDay * 30 * m),
        "Fuel Loss":      Math.round(params.fuelLossPerVehiclePerKm * trafficPerDay * roadLengthKm * 30 * m),
        "Repair Cost":    Math.round(repairNow * (1 + params.degradationRatePerMonth / 100) ** m * 1.1),
      };
    });

    return { repairNow, repairLater, vehicleDamage, fuelLoss, accidentCost, totalInaction, savings, roi, monthly, degradedSeverity };
  }, [damageClass, areaSqm, trafficPerDay, roadLengthKm, delayMonths, severityScore, params]);

  const urgency = costEstimate?.urgency ?? (
    calc.roi > 500 ? "Critical" : calc.roi > 200 ? "Urgent" : calc.roi > 50 ? "Schedule" : "Monitor"
  );

  return (
    <div className="card space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-white">Repair ROI Calculator</h3>
          <p className="text-xs text-gray-500">Economic impact of delaying road repair</p>
        </div>
        <span
          className="text-xs px-3 py-1 rounded-full font-medium"
          style={{ backgroundColor: `${URGENCY_COLOR[urgency]}22`, color: URGENCY_COLOR[urgency] }}
        >
          {urgency} — ROI {calc.roi.toFixed(0)}%
        </span>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Damage class */}
        <div className="col-span-2 md:col-span-1">
          <label className="text-xs text-gray-500 block mb-1">Damage Type</label>
          <div className="flex gap-1 flex-wrap">
            {["Pothole", "Crack", "Vandalism", "Good"].map((cls) => (
              <button
                key={cls}
                onClick={() => setDamageClass(cls)}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${
                  damageClass === cls ? "text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
                style={damageClass === cls ? { backgroundColor: "#3b82f6" } : {}}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>

        <Slider label="Damage Area (m²)" value={areaSqm} min={1} max={100} step={1}
          onChange={setAreaSqm} format={(v) => `${v} m²`} />
        <Slider label="Traffic (vehicles/day)" value={trafficPerDay} min={100} max={20000} step={100}
          onChange={setTrafficPerDay} format={(v) => v.toLocaleString()} />
        <Slider label="Road Length (km)" value={roadLengthKm} min={0.1} max={10} step={0.1}
          onChange={setRoadLengthKm} format={(v) => `${v.toFixed(1)} km`} />
        <Slider label="Delay Period (months)" value={delayMonths} min={1} max={24} step={1}
          onChange={setDelayMonths} format={(v) => `${v} mo`} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Repair Now" value={fmt(calc.repairNow)} sub="immediate cost" color="#22c55e" />
        <KPI label="Repair Later" value={fmt(calc.repairLater)} sub={`after ${delayMonths} months`} color="#f59e0b" />
        <KPI label="Cost of Inaction" value={fmt(calc.totalInaction)} sub="total economic loss" color="#ef4444" />
        <KPI label="Net Savings" value={fmt(calc.savings)} sub={`${calc.roi.toFixed(0)}% ROI`} color="#3b82f6" />
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-800 rounded-lg p-2">
          <p className="text-xs text-gray-500">Vehicle Damage</p>
          <p className="text-sm font-bold text-amber-400">{fmt(calc.vehicleDamage)}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <p className="text-xs text-gray-500">Fuel Loss</p>
          <p className="text-sm font-bold text-orange-400">{fmt(calc.fuelLoss)}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <p className="text-xs text-gray-500">Accident Risk</p>
          <p className="text-sm font-bold text-red-400">{fmt(calc.accidentCost)}</p>
        </div>
      </div>

      {/* Cumulative cost chart */}
      {delayMonths > 1 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Cumulative cost of delay over {delayMonths} months</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={calc.monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 10 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => fmt(v)} width={52} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, color: "#9ca3af" }} />
              <ReferenceLine y={calc.repairNow} stroke="#22c55e" strokeDasharray="4 4"
                label={{ value: "Repair Now", fill: "#22c55e", fontSize: 10, position: "right" }} />
              <Bar dataKey="Vehicle Damage" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Fuel Loss"      stackId="a" fill="#f97316" />
              <Bar dataKey="Repair Cost"    stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-600 text-center mt-1">
            Green line = repair now cost · Stacked bars = cumulative cost of waiting
          </p>
        </div>
      )}

      {/* Verdict */}
      <div
        className="rounded-lg p-3 text-sm border"
        style={{
          backgroundColor: `${URGENCY_COLOR[urgency]}11`,
          borderColor: `${URGENCY_COLOR[urgency]}44`,
        }}
      >
        <p style={{ color: URGENCY_COLOR[urgency] }} className="font-medium">
          Verdict: {urgency === "Critical" || urgency === "Urgent"
            ? `Repair immediately — every month of delay costs ${fmt(calc.totalInaction / delayMonths)} more`
            : urgency === "Schedule"
            ? `Schedule repair within 30 days — projected ${fmt(calc.savings)} in savings`
            : `Monitor — repair cost is low, schedule in next maintenance cycle`}
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Slider({ label, value, min, max, step, onChange, format }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-xs text-gray-500">{label}</label>
        <span className="text-xs text-white font-medium">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-brand-500"
      />
    </div>
  );
}

function KPI({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="font-bold text-base" style={{ color }}>{value}</p>
      <p className="text-xs text-gray-600">{sub}</p>
    </div>
  );
}
