"use client";

import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import toast from "react-hot-toast";

interface TrainMetric { epoch: number; train_loss: number; val_accuracy: number; }

export default function RetrainPage() {
  const [datasets, setDatasets] = useState<{ dataset_id: string; name: string }[]>([]);
  const [form, setForm] = useState({ dataset_id: "", arch: "resnet50", epochs: 10, batch_size: 32, lr: 0.0001 });
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [metrics, setMetrics] = useState<TrainMetric[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.datasets.list().then(({ data }) => setDatasets(data.data as { dataset_id: string; name: string }[])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const socket = getSocket();
    socket.on("retrain_progress", (data: TrainMetric & { job_id: string }) => {
      if (data.job_id === jobId) {
        setMetrics((prev) => [...prev, { epoch: data.epoch, train_loss: data.train_loss, val_accuracy: data.val_accuracy }]);
        setStatus(`Epoch ${data.epoch} — loss: ${data.train_loss} acc: ${(data.val_accuracy * 100).toFixed(1)}%`);
      }
    });
    socket.on("retrain_complete", (data: { job_id: string }) => {
      if (data.job_id === jobId) { setStatus("Training complete"); toast.success("Model trained"); }
    });
    return () => { socket.off("retrain_progress"); socket.off("retrain_complete"); };
  }, [jobId]);

  const start = async () => {
    if (!form.dataset_id) { toast.error("Select a dataset"); return; }
    setLoading(true); setMetrics([]);
    try {
      const { data } = await api.retrain.start(form);
      setJobId(data.data.job_id);
      setStatus("Training started…");
      toast.success("Retraining job queued");
    } catch { toast.error("Failed to start training"); }
    finally { setLoading(false); }
  };

  const cancel = async () => {
    if (!jobId) return;
    await api.retrain.cancel(jobId);
    setStatus("Cancelled"); setJobId(null);
    toast("Job cancelled");
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-xl font-bold text-white">Model Retraining</h1>

        <div className="card space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Dataset</label>
              <select value={form.dataset_id} onChange={(e) => setForm({ ...form, dataset_id: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                <option value="">Select dataset…</option>
                {datasets.map((d) => <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Architecture</label>
              <select value={form.arch} onChange={(e) => setForm({ ...form, arch: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
                <option value="resnet50">ResNet-50</option>
                <option value="efficientnet_b4">EfficientNet-B4</option>
                <option value="vit_b16">ViT-B/16</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Epochs</label>
              <input type="number" value={form.epochs} min={1} max={100}
                onChange={(e) => setForm({ ...form, epochs: +e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Batch Size</label>
              <input type="number" value={form.batch_size} min={4} max={128}
                onChange={(e) => setForm({ ...form, batch_size: +e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Learning Rate</label>
              <input type="number" value={form.lr} step={0.00001} min={0.00001} max={0.1}
                onChange={(e) => setForm({ ...form, lr: +e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={start} disabled={loading || !!jobId} className="btn-primary flex-1">
              {loading ? "Starting…" : "Start Training"}
            </button>
            {jobId && (
              <button onClick={cancel} className="btn-secondary">Cancel</button>
            )}
          </div>

          {status && <p className="text-sm text-gray-400">{status}</p>}
        </div>

        {metrics.length > 0 && (
          <div className="card space-y-4">
            <h3 className="font-semibold text-white">Live Training Progress</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="epoch" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 1]} tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151" }} />
                <Line yAxisId="left" type="monotone" dataKey="train_loss" stroke="#ef4444" strokeWidth={2} dot={false} name="Loss" />
                <Line yAxisId="right" type="monotone" dataKey="val_accuracy" stroke="#22c55e" strokeWidth={2} dot={false} name="Val Acc" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </main>
    </div>
  );
}
