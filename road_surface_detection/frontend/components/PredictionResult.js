import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Info, TriangleAlert, FileDown, Cpu, MemoryStick, MapPin, ExternalLink } from 'lucide-react';

const getStatusColor = (className) => {
  switch (className) {
    case 'normal road': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'pothole': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
    case 'crack': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    case 'damaged road': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
    default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
  }
};

const getStatusIcon = (className) => {
  switch (className) {
    case 'normal road': return <CheckCircle size={24} className="text-emerald-400" />;
    case 'pothole': return <AlertCircle size={24} className="text-rose-400" />;
    case 'crack': return <TriangleAlert size={24} className="text-amber-400" />;
    case 'damaged road': return <TriangleAlert size={24} className="text-orange-400" />;
    default: return <Info size={24} className="text-blue-400" />;
  }
};

const PredictionResult = ({ result, API_URL }) => {
  const [opacity, setOpacity] = useState(0.5);

  if (!result) {
    return (
      <div className="glass-panel p-6 h-full flex flex-col items-center justify-center text-slate-400">
        <Info size={48} className="mb-4 text-slate-500 opacity-50" />
        <p>Upload an image to see prediction results and Grad-CAM heatmap</p>
      </div>
    );
  }

  const { predicted_class, confidence, heatmap_url, all_predictions, metrics, sys_info, id, latitude, longitude } = result;
  const confidencePercent = (confidence * 100).toFixed(1);

  return (
    <div className="glass-panel p-6 animate-fade-in h-full flex flex-col">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        {getStatusIcon(predicted_class)}
        Analysis Result
      </h2>

      <div className={`p-4 rounded-xl border mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${getStatusColor(predicted_class)}`}>
        <div>
          <p className="text-sm opacity-80 uppercase tracking-wider font-semibold mb-1">Detected Condition</p>
          <h3 className="text-2xl font-bold capitalize">{predicted_class}</h3>
        </div>
        <div className="md:text-right">
          <p className="text-sm opacity-80 uppercase tracking-wider font-semibold mb-1">Confidence</p>
          <h3 className="text-2xl font-bold">{confidencePercent}%</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 flex-1">
        <div>
          <div className="flex justify-between items-end mb-3">
             <h4 className="text-sm font-medium text-slate-400 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-blue-500"></span>
               Grad-CAM Visualization
             </h4>
             <div className="flex flex-col items-end">
                <label className="text-xs text-slate-400 mb-1">Heatmap Opacity</label>
                <input 
                  type="range" 
                  min="0" max="1" step="0.1" 
                  value={opacity} 
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-24 accent-blue-500"
                />
             </div>
          </div>
          
          <div className="rounded-xl overflow-hidden bg-black border border-slate-700 aspect-video relative group">
            <img 
              src={heatmap_url ? `${API_URL}${heatmap_url}` : `${API_URL}/results/heatmap_${result.filename || result.image_name}`}
              alt="Grad-CAM Heatmap" 
              className="w-full h-full object-contain"
              style={{ opacity: 0.3 + (opacity * 0.7) }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent pointer-events-none flex items-end p-4">
              <span className="text-xs bg-black/60 text-white px-2 py-1 rounded backdrop-blur-sm border border-slate-700">
                Heatmap highlights detected anomalies
              </span>
            </div>
          </div>
        </div>
        
        {metrics && (
          <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
             <div className="flex justify-between items-center mb-3">
               <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Technical Diagnostics</h4>
               {sys_info && (
                 <div className="flex gap-3">
                   <span className="text-xs font-mono text-emerald-400 flex items-center gap-1"><Cpu size={12}/> CPU: {sys_info.cpu}%</span>
                   <span className="text-xs font-mono text-blue-400 flex items-center gap-1"><MemoryStick size={12}/> RAM: {sys_info.ram}%</span>
                 </div>
               )}
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                   <p className="text-xs text-slate-400">Latency</p>
                   <p className="font-mono text-sm">{metrics.latency_ms?.toFixed(0)} ms</p>
                </div>
                <div>
                   <p className="text-xs text-slate-400">Brightness</p>
                   <p className="font-mono text-sm">{metrics.brightness?.toFixed(1)}</p>
                </div>
                <div>
                   <p className="text-xs text-slate-400">Contrast</p>
                   <p className="font-mono text-sm">{metrics.contrast?.toFixed(1)}</p>
                </div>
                <div>
                   <p className="text-xs text-slate-400">Sharpness</p>
                   <p className="font-mono text-sm">{metrics.sharpness?.toFixed(0)}</p>
                </div>
             </div>
             
             {/* Geographic Location removed as per user request */}
          </div>
        )}

        {result.maintenance && (
          <div className="bg-blue-500/5 rounded-xl p-4 border border-blue-500/20 mt-6">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-3 flex items-center gap-2">
              <ShieldCheck size={14} /> AI Maintenance Advisor
            </h4>
            
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Suggested Priority:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  result.maintenance.priority === 'Critical' ? 'bg-rose-500 text-white' :
                  result.maintenance.priority === 'High' ? 'bg-orange-500 text-white' :
                  result.maintenance.priority === 'Medium' ? 'bg-amber-500 text-white' :
                  'bg-emerald-500 text-white'
                }`}>
                  {result.maintenance.priority}
                </span>
              </div>
              
              <div className="bg-slate-900/40 p-3 rounded-lg border border-white/5">
                <p className="text-xs text-slate-400 font-medium mb-1">Recommended Action:</p>
                <p className="text-sm text-slate-200 font-semibold">{result.maintenance.action}</p>
                <p className="text-xs text-slate-400 mt-2 italic border-t border-white/5 pt-2">
                  {result.maintenance.recommendation}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {id && (
            <a 
              href={`${API_URL}/generate_report/${id}`} 
              target="_blank" 
              rel="noreferrer"
              className="mt-2 w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-slate-600 shadow-lg"
            >
              <FileDown size={18} /> Download Comprehensive PDF Report
            </a>
        )}
      </div>
    </div>
  );
};

export default PredictionResult;
