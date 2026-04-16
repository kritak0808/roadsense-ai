"use client";

interface Props {
  severityScore: number;   // 0–100
  predictedClass: string;
  confidence: number;
}

const CLASS_CONFIG: Record<string, { color: string; bg: string; ring: string }> = {
  Good:      { color: "#22c55e", bg: "bg-green-500",  ring: "ring-green-500/30" },
  Crack:     { color: "#f59e0b", bg: "bg-amber-500",  ring: "ring-amber-500/30" },
  Pothole:   { color: "#ef4444", bg: "bg-red-500",    ring: "ring-red-500/30"   },
  Vandalism: { color: "#8b5cf6", bg: "bg-purple-500", ring: "ring-purple-500/30"},
};

function healthLabel(score: number): { label: string; color: string } {
  const health = 100 - score;
  if (health >= 80) return { label: "Excellent", color: "#22c55e" };
  if (health >= 60) return { label: "Fair",      color: "#84cc16" };
  if (health >= 40) return { label: "Poor",      color: "#f59e0b" };
  if (health >= 20) return { label: "Critical",  color: "#ef4444" };
  return               { label: "Failing",    color: "#dc2626" };
}

export default function SeverityMeter({ severityScore, predictedClass, confidence }: Props) {
  const cfg = CLASS_CONFIG[predictedClass] ?? CLASS_CONFIG.Good;
  const health = Math.max(0, Math.min(100, 100 - severityScore));
  const { label, color } = healthLabel(severityScore);

  // Arc parameters
  const r = 70;
  const cx = 100;
  const cy = 95;
  const startAngle = -210;
  const totalArc = 240; // degrees
  const toRad = (d: number) => (d * Math.PI) / 180;

  const arcPath = (pct: number) => {
    const angle = startAngle + totalArc * pct;
    const x = cx + r * Math.cos(toRad(angle));
    const y = cy + r * Math.sin(toRad(angle));
    const large = totalArc * pct > 180 ? 1 : 0;
    const sx = cx + r * Math.cos(toRad(startAngle));
    const sy = cy + r * Math.sin(toRad(startAngle));
    return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${x} ${y}`;
  };

  const healthPct = health / 100;

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-white">Road Health Score</h3>

      <div className="flex flex-col items-center">
        <svg viewBox="0 0 200 120" className="w-48">
          {/* Track */}
          <path
            d={arcPath(1)}
            fill="none"
            stroke="#1f2937"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Fill */}
          <path
            d={arcPath(healthPct)}
            fill="none"
            stroke={cfg.color}
            strokeWidth="14"
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
          {/* Centre text */}
          <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize="26" fontWeight="bold">
            {health.toFixed(0)}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill="#9ca3af" fontSize="11">
            / 100
          </text>
          <text x={cx} y={cy + 26} textAnchor="middle" fill={color} fontSize="11" fontWeight="600">
            {label}
          </text>
        </svg>

        {/* Tick marks */}
        <div className="flex justify-between w-48 text-xs text-gray-600 -mt-2 px-2">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-800 rounded-lg p-2">
          <p className="text-xs text-gray-500">Severity</p>
          <p className="text-sm font-bold text-white">{severityScore.toFixed(1)}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <p className="text-xs text-gray-500">Confidence</p>
          <p className="text-sm font-bold text-white">{(confidence * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <p className="text-xs text-gray-500">Class</p>
          <p className={`text-sm font-bold`} style={{ color: cfg.color }}>{predictedClass}</p>
        </div>
      </div>
    </div>
  );
}
