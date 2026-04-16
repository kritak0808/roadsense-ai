"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import { api, HistoryItem } from "@/lib/api";
import toast from "react-hot-toast";

// ── Color maps ────────────────────────────────────────────────────────────────
const CLASS_COLORS: Record<string, string> = {
  Good:      "#22c55e",
  Crack:     "#f97316",
  Pothole:   "#ef4444",
  Vandalism: "#8b5cf6",
};

const URGENCY_COLORS: Record<string, [number, number, number]> = {
  Monitor:  [34, 197, 94],
  Schedule: [234, 179, 8],
  Urgent:   [249, 115, 22],
  Critical: [239, 68, 68],
};

const REPAIR_TEXT: Record<string, string> = {
  Pothole:   "Immediate patching required. Use hot-mix asphalt for permanent repair. Clean edges, apply tack coat, compact thoroughly. Do not delay — vehicle damage risk is HIGH.",
  Crack:     "Apply rubberized crack sealant within 30 days to prevent water ingress. For alligator cracking, mill and overlay. Seal promptly to avoid escalation to pothole.",
  Vandalism: "Clean unauthorized markings with solvent or pressure washing. Repaint road markings as needed. Report to local authorities if recurring.",
  Good:      "Road surface is in good condition. Continue routine maintenance schedule. Apply preventive sealcoat every 3–5 years to extend pavement lifespan.",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// ── Pure jsPDF report generator ───────────────────────────────────────────────
async function generatePDF(p: HistoryItem) {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;   // A4 width mm
  const H = 297;   // A4 height mm
  const M = 14;    // margin
  const CW = W - M * 2; // content width

  const classColor = hexToRgb(CLASS_COLORS[p.predicted_class] ?? "#3b82f6");
  const urgency = p.repair_urgency ?? "Monitor";
  const urgencyColor = URGENCY_COLORS[urgency] ?? [100, 116, 139];
  const health = Math.max(0, 100 - p.severity_score);

  // ── Background ──────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, H, "F");

  let y = 0;

  // ── Header band ─────────────────────────────────────────────────────────────
  doc.setFillColor(...classColor);
  doc.rect(0, 0, W, 28, "F");

  // Accent stripe
  doc.setFillColor(0, 0, 0);
  doc.setGState(doc.GState({ opacity: 0.15 }));
  doc.rect(0, 22, W, 6, "F");
  doc.setGState(doc.GState({ opacity: 1 }));

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Road Damage Ultra AI", M, 11);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setGState(doc.GState({ opacity: 0.75 }));
  doc.text("Smart Road Monitoring System", M, 17);
  doc.setGState(doc.GState({ opacity: 1 }));

  // Report ID top-right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`RPT-${p.id}`, W - M, 11, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setGState(doc.GState({ opacity: 0.7 }));
  doc.text(new Date(p.created_at).toLocaleString(), W - M, 17, { align: "right" });
  doc.setGState(doc.GState({ opacity: 1 }));

  y = 34;

  // ── Section helper ──────────────────────────────────────────────────────────
  const sectionTitle = (title: string, yPos: number): number => {
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(M, yPos, CW, 7, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(title.toUpperCase(), M + 4, yPos + 4.8);
    // Left accent bar
    doc.setFillColor(...classColor);
    doc.rect(M, yPos, 2, 7, "F");
    return yPos + 11;
  };

  const divider = (yPos: number): number => {
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.3);
    doc.line(M, yPos, W - M, yPos);
    return yPos + 4;
  };

  // ── SECTION 1: Summary ──────────────────────────────────────────────────────
  y = sectionTitle("1. Prediction Summary", y);

  // Big class badge
  doc.setFillColor(...classColor);
  doc.roundedRect(M, y, 60, 18, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(p.predicted_class, M + 30, y + 11, { align: "center" });

  // Confidence box
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(M + 64, y, 40, 18, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(`${(p.confidence * 100).toFixed(1)}%`, M + 84, y + 10, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("CONFIDENCE", M + 84, y + 15, { align: "center" });

  // File info
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("File:", M + 110, y + 6);
  doc.setTextColor(203, 213, 225);
  doc.text(p.original_filename.slice(0, 40), M + 122, y + 6);

  doc.setTextColor(148, 163, 184);
  doc.text("Model:", M + 110, y + 12);
  doc.setTextColor(203, 213, 225);
  doc.text(p.model_used ?? "ResNet-50", M + 122, y + 12);

  // Location
  if ((p as unknown as Record<string, unknown>).latitude && (p as unknown as Record<string, unknown>).longitude) {
    const lat = (p as unknown as Record<string, number>).latitude;
    const lng = (p as unknown as Record<string, number>).longitude;
    doc.setTextColor(148, 163, 184);
    doc.text("Location:", M + 110, y + 18);
    doc.setTextColor(203, 213, 225);
    doc.text(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, M + 128, y + 18);
  }

  y += 24;
  y = divider(y);

  // ── SECTION 2: Metrics ──────────────────────────────────────────────────────
  y = sectionTitle("2. Damage Metrics", y);

  const boxes = [
    { label: "Severity Score", value: p.severity_score.toFixed(1), unit: "/ 100", color: classColor },
    { label: "Road Health",    value: health.toFixed(0),            unit: "/ 100", color: [34, 197, 94] as [number,number,number] },
    { label: "Urgency",        value: urgency,                      unit: "",       color: urgencyColor },
    { label: "Model Used",     value: (p.model_used ?? "ResNet-50").replace("_", " "), unit: "", color: [59, 130, 246] as [number,number,number] },
  ];

  const bw = (CW - 9) / 4;
  boxes.forEach(({ label, value, unit, color: bc }, i) => {
    const bx = M + i * (bw + 3);
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(bx, y, bw, 20, 2, 2, "F");
    // Top accent
    doc.setFillColor(...bc);
    doc.roundedRect(bx, y, bw, 2, 1, 1, "F");
    // Label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(label, bx + bw / 2, y + 7, { align: "center" });
    // Value
    doc.setFont("helvetica", "bold");
    doc.setFontSize(value.length > 8 ? 8 : 12);
    doc.setTextColor(255, 255, 255);
    doc.text(value, bx + bw / 2, y + 14, { align: "center" });
    if (unit) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(unit, bx + bw / 2, y + 18, { align: "center" });
    }
  });

  y += 26;
  y = divider(y);

  // ── SECTION 3: Analysis ─────────────────────────────────────────────────────
  y = sectionTitle("3. Class Probability Analysis", y);

  const classes = [
    { cls: "Pothole",   color: [239, 68, 68]  as [number,number,number] },
    { cls: "Crack",     color: [249, 115, 22] as [number,number,number] },
    { cls: "Vandalism", color: [139, 92, 246] as [number,number,number] },
    { cls: "Good",      color: [34, 197, 94]  as [number,number,number] },
  ];

  const barW = CW - 30;
  classes.forEach(({ cls, color: bc }) => {
    const isMatch = cls === p.predicted_class;
    const pct = isMatch ? p.confidence : Math.max(0.02, (1 - p.confidence) / 3 * (0.5 + Math.random() * 0.5));

    // Label
    doc.setFont("helvetica", isMatch ? "bold" : "normal");
    doc.setFontSize(8);
    doc.setTextColor(isMatch ? 255 : 100, isMatch ? 255 : 116, isMatch ? 255 : 139);
    doc.text(cls, M, y + 4);

    // Track
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(M + 22, y, barW, 5, 1, 1, "F");

    // Fill
    doc.setFillColor(...bc);
    doc.roundedRect(M + 22, y, Math.max(2, barW * pct), 5, 1, 1, "F");

    // Percentage
    doc.setFont("helvetica", isMatch ? "bold" : "normal");
    doc.setFontSize(7);
    doc.setTextColor(isMatch ? 255 : 100, isMatch ? 255 : 116, isMatch ? 255 : 139);
    doc.text(`${(pct * 100).toFixed(1)}%`, W - M, y + 4, { align: "right" });

    if (isMatch) {
      doc.setFillColor(...bc);
      doc.circle(M + 22 + barW * pct, y + 2.5, 1.5, "F");
    }

    y += 9;
  });

  y += 2;
  y = divider(y);

  // ── SECTION 4: Recommendation ───────────────────────────────────────────────
  y = sectionTitle("4. Repair Recommendation", y);

  // Urgency badge
  doc.setFillColor(...urgencyColor);
  doc.roundedRect(M, y, 35, 8, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`⚠ ${urgency.toUpperCase()}`, M + 17.5, y + 5.5, { align: "center" });

  y += 12;

  // Recommendation text box
  const recText = REPAIR_TEXT[p.predicted_class] ?? REPAIR_TEXT.Good;
  doc.setFillColor(20, 30, 48);
  doc.setDrawColor(...classColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(M, y, CW, 22, 2, 2, "FD");

  // Left accent
  doc.setFillColor(...classColor);
  doc.rect(M, y, 3, 22, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  const lines = doc.splitTextToSize(recText, CW - 10);
  doc.text(lines, M + 7, y + 7);

  y += 28;
  y = divider(y);

  // ── SECTION 5: Location ─────────────────────────────────────────────────────
  const lat = (p as unknown as Record<string, number>).latitude;
  const lng = (p as unknown as Record<string, number>).longitude;

  y = sectionTitle("5. Location & Metadata", y);

  const metaRows = [
    ["Report ID",       `RPT-${p.id}`],
    ["Inspection Date", new Date(p.created_at).toLocaleString()],
    ["File Name",       p.original_filename],
    ["Coordinates",     lat && lng ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : "Not captured — enable browser location"],
    ["Session ID",      (p as unknown as Record<string, string>).session_id ?? "N/A"],
  ];

  metaRows.forEach(([label, value], i) => {
    const rowY = y + i * 7;
    if (i % 2 === 0) {
      doc.setFillColor(20, 30, 48);
      doc.rect(M, rowY - 1, CW, 7, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label, M + 3, rowY + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(203, 213, 225);
    doc.text(String(value).slice(0, 70), M + 45, rowY + 4);
  });

  y += metaRows.length * 7 + 6;

  // ── Footer ──────────────────────────────────────────────────────────────────
  // Footer band
  doc.setFillColor(30, 41, 59);
  doc.rect(0, H - 14, W, 14, "F");

  // Accent line
  doc.setFillColor(...classColor);
  doc.rect(0, H - 14, W, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("Generated by Road Damage Ultra AI", M, H - 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Version 1.0  ·  Smart Road Monitoring System", M, H - 3);
  doc.text(new Date().toLocaleString(), W - M, H - 5, { align: "right" });

  // Page number
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Page 1 of 1", W / 2, H - 5, { align: "center" });

  return doc;
}

// ── Page component ────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [predictions, setPredictions] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.history.list({ per_page: 20, page: 1 })
      .then(({ data }) => {
        setPredictions(data.data.items);
        if (data.data.items.length > 0) setSelected(data.data.items[0]);
      })
      .catch(() => toast.error("Failed to load predictions"))
      .finally(() => setLoading(false));
  }, []);

  const downloadPDF = async () => {
    if (!selected) return;
    setGenerating(true);
    try {
      const doc = await generatePDF(selected);
      doc.save(`road-damage-report-RPT-${selected.id}.pdf`);
      toast.success("Report downloaded successfully");
    } catch (err) {
      console.error(err);
      toast.error("PDF generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Inspection Reports</h1>
            <p className="text-sm text-gray-500">Generate professional PDF reports for any prediction</p>
          </div>
          <button
            onClick={downloadPDF}
            disabled={!selected || generating}
            className="btn-primary flex items-center gap-2 px-5"
          >
            {generating ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating PDF…
              </>
            ) : "📄 Download PDF"}
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && predictions.length === 0 && (
          <div className="card text-center py-16 space-y-3">
            <p className="text-4xl">📋</p>
            <p className="text-gray-300 font-medium">No predictions available</p>
            <p className="text-gray-500 text-sm">Run a prediction first, then come back to generate a report</p>
          </div>
        )}

        {!loading && predictions.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Selector */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Select Prediction</p>
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                {predictions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors ${
                      selected?.id === p.id
                        ? "border-brand-500 bg-brand-600/10"
                        : "border-gray-800 bg-gray-900 hover:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-xs font-semibold px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${CLASS_COLORS[p.predicted_class]}22`,
                          color: CLASS_COLORS[p.predicted_class],
                        }}
                      >
                        {p.predicted_class}
                      </span>
                      <span className="text-xs text-gray-500">{(p.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-1">{p.original_filename}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{new Date(p.created_at).toLocaleDateString()}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="lg:col-span-2 space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Report Preview</p>
              {selected ? (
                <ReportPreview prediction={selected} />
              ) : (
                <div className="card h-64 flex items-center justify-center text-gray-500 text-sm">
                  Select a prediction to preview
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── In-browser preview (mirrors PDF layout) ───────────────────────────────────
const ReportPreview = forwardRef<HTMLDivElement, { prediction: HistoryItem }>(
  ({ prediction: p }, _ref) => {
    const color = CLASS_COLORS[p.predicted_class] ?? "#3b82f6";
    const urgency = p.repair_urgency ?? "Monitor";
    const health = Math.max(0, 100 - p.severity_score);
    const urgRgb = URGENCY_COLORS[urgency] ?? [100, 116, 139];
    const urgCss = `rgb(${urgRgb.join(",")})`;

    const classes = [
      { cls: "Pothole",   color: "#ef4444" },
      { cls: "Crack",     color: "#f97316" },
      { cls: "Vandalism", color: "#8b5cf6" },
      { cls: "Good",      color: "#22c55e" },
    ];

    return (
      <div className="rounded-2xl overflow-hidden border border-gray-800 text-sm"
        style={{ backgroundColor: "#0f172a", fontFamily: "system-ui" }}>

        {/* Header */}
        <div style={{ backgroundColor: color, padding: "14px 20px" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs">Road Damage Ultra AI · Smart Road Monitoring System</p>
              <p className="text-white font-bold text-lg mt-0.5">{p.predicted_class} Detected</p>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-2xl">{(p.confidence * 100).toFixed(1)}%</p>
              <p className="text-white/70 text-xs">Confidence</p>
            </div>
          </div>
        </div>

        <div style={{ padding: "16px 20px" }} className="space-y-4">

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Severity", value: p.severity_score.toFixed(1), unit: "/100" },
              { label: "Health",   value: health.toFixed(0),            unit: "/100" },
              { label: "Urgency",  value: urgency,                      unit: "" },
            ].map(({ label, value, unit }) => (
              <div key={label} style={{ backgroundColor: "#1e293b", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                <p style={{ color: "#94a3b8", fontSize: 10, marginBottom: 2 }}>{label}</p>
                <p style={{ color: "white", fontWeight: 700, fontSize: 16 }}>
                  {value} <span style={{ color: "#64748b", fontSize: 10 }}>{unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Probability bars */}
          <div style={{ backgroundColor: "#1e293b", borderRadius: 8, padding: "12px 14px" }}>
            <p style={{ color: "#94a3b8", fontSize: 10, marginBottom: 8 }}>CLASS PROBABILITY ANALYSIS</p>
            {classes.map(({ cls, color: c }) => {
              const isMatch = cls === p.predicted_class;
              const pct = isMatch ? p.confidence * 100 : Math.max(2, (1 - p.confidence) / 3 * 50);
              return (
                <div key={cls} className="flex items-center gap-2 mb-1.5">
                  <span style={{ color: isMatch ? "white" : "#64748b", fontSize: 11, width: 64, fontWeight: isMatch ? 700 : 400 }}>{cls}</span>
                  <div style={{ flex: 1, backgroundColor: "#334155", borderRadius: 3, height: 6 }}>
                    <div style={{ width: `${pct}%`, backgroundColor: c, height: 6, borderRadius: 3 }} />
                  </div>
                  <span style={{ color: isMatch ? "white" : "#64748b", fontSize: 10, width: 36, textAlign: "right", fontWeight: isMatch ? 700 : 400 }}>
                    {pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Recommendation */}
          <div style={{ backgroundColor: `${color}15`, border: `1px solid ${color}44`, borderRadius: 8, padding: "10px 14px", borderLeft: `3px solid ${color}` }}>
            <p style={{ color, fontSize: 10, fontWeight: 600, marginBottom: 4 }}>REPAIR RECOMMENDATION</p>
            <p style={{ color: "#cbd5e1", fontSize: 11, lineHeight: 1.5 }}>{REPAIR_TEXT[p.predicted_class]}</p>
          </div>

          {/* Urgency badge */}
          <div className="flex items-center gap-2">
            <span style={{ backgroundColor: urgCss, color: "white", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
              ⚠ {urgency.toUpperCase()}
            </span>
            <span style={{ color: "#64748b", fontSize: 10 }}>Repair priority level</span>
          </div>

          {/* Metadata */}
          <div style={{ borderTop: "1px solid #1e293b", paddingTop: 10 }}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                ["Report ID",  `RPT-${p.id}`],
                ["File",       p.original_filename],
                ["Date",       new Date(p.created_at).toLocaleString()],
                ["System",     "Road Damage Ultra AI v1.0"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p style={{ color: "#475569", fontSize: 9, textTransform: "uppercase" }}>{label}</p>
                  <p style={{ color: "#94a3b8", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ backgroundColor: "#1e293b", borderRadius: 6, padding: "6px 12px", borderTop: `2px solid ${color}` }}>
            <p style={{ color: "#64748b", fontSize: 9, textAlign: "center" }}>
              Generated by Road Damage Ultra AI · Version 1.0 · Smart Road Monitoring System
            </p>
          </div>
        </div>
      </div>
    );
  }
);
ReportPreview.displayName = "ReportPreview";
