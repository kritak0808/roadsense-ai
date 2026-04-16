"use client";

import { useRef, useState, useEffect } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

const CLASSES = ["Good", "Crack", "Pothole", "Vandalism"];
const CLASS_COLORS: Record<string, string> = {
  Good: "#22c55e", Crack: "#f59e0b", Pothole: "#ef4444", Vandalism: "#8b5cf6",
};

interface Box { x: number; y: number; w: number; h: number; label: string; }

interface Props { predictionId?: number; imageUrl?: string; }

export default function AnnotationTool({ predictionId, imageUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });
  const [selectedClass, setSelectedClass] = useState("Pothole");
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      setImgEl(img);
      const canvas = canvasRef.current;
      if (canvas) { canvas.width = img.width; canvas.height = img.height; }
      redraw(img, []);
    };
  }, [imageUrl]);

  const redraw = (img: HTMLImageElement, bxs: Box[]) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    for (const b of bxs) {
      ctx.strokeStyle = CLASS_COLORS[b.label] ?? "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = CLASS_COLORS[b.label] ?? "#fff";
      ctx.font = "12px Inter";
      ctx.fillText(b.label, b.x + 4, b.y + 14);
    }
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = canvasRef.current!.width / rect.width;
    const scaleY = canvasRef.current!.height / rect.height;
    setStart({ x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY });
    setDrawing(true);
  };

  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !imgEl) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = canvasRef.current!.width / rect.width;
    const scaleY = canvasRef.current!.height / rect.height;
    const ex = (e.clientX - rect.left) * scaleX;
    const ey = (e.clientY - rect.top) * scaleY;
    const newBox: Box = {
      x: Math.min(start.x, ex), y: Math.min(start.y, ey),
      w: Math.abs(ex - start.x), h: Math.abs(ey - start.y),
      label: selectedClass,
    };
    const updated = [...boxes, newBox];
    setBoxes(updated);
    redraw(imgEl, updated);
    setDrawing(false);
  };

  const onContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvasRef.current!.width / rect.width);
    const my = (e.clientY - rect.top) * (canvasRef.current!.height / rect.height);
    const filtered = boxes.filter((b) => !(mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h));
    setBoxes(filtered);
    if (imgEl) redraw(imgEl, filtered);
  };

  const exportYOLO = () => {
    if (!canvasRef.current) return;
    const W = canvasRef.current.width, H = canvasRef.current.height;
    const lines = boxes.map((b) => {
      const cx = (b.x + b.w / 2) / W, cy = (b.y + b.h / 2) / H;
      const bw = b.w / W, bh = b.h / H;
      return `${CLASSES.indexOf(b.label)} ${cx.toFixed(6)} ${cy.toFixed(6)} ${bw.toFixed(6)} ${bh.toFixed(6)}`;
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "annotations.txt"; a.click();
  };

  const saveAnnotations = async () => {
    if (!predictionId) return;
    try {
      await api.datasets.annotate({ prediction_id: predictionId, annotations: boxes });
      toast.success("Annotations saved");
    } catch { toast.error("Save failed"); }
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Manual Annotation</h3>
        <div className="flex gap-2">
          {CLASSES.map((cls) => (
            <button
              key={cls}
              onClick={() => setSelectedClass(cls)}
              className="text-xs px-2 py-1 rounded-full border transition-colors"
              style={{
                borderColor: CLASS_COLORS[cls],
                color: selectedClass === cls ? "#fff" : CLASS_COLORS[cls],
                background: selectedClass === cls ? CLASS_COLORS[cls] + "33" : "transparent",
              }}
            >
              {cls}
            </button>
          ))}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full rounded-lg cursor-crosshair bg-gray-800"
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onContextMenu={onContextMenu}
      />

      <p className="text-xs text-gray-500">Drag to draw · Right-click to delete</p>

      <div className="flex gap-2">
        <button onClick={exportYOLO} className="btn-secondary text-sm flex-1">Export YOLO</button>
        {predictionId && (
          <button onClick={saveAnnotations} className="btn-primary text-sm flex-1">Save</button>
        )}
      </div>
    </div>
  );
}
