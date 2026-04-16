import React from 'react';
import { Clock, CheckCircle, AlertCircle, TriangleAlert, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const HistoryTable = ({ history }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  const getPriorityBadge = (cls, conf) => {
    const c = (cls || '').toLowerCase();
    if (c.includes('pothole')) {
      if (conf > 0.85) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">CRITICAL</span>;
      return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">HIGH</span>;
    }
    if (c.includes('crack')) {
      if (conf > 0.8) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">MEDIUM</span>;
      return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">LOW</span>;
    }
    return null;
  };

  const getStatusBadge = (className) => {
    switch (className) {
      case 'normal road': return <span className="badge badge-success"><CheckCircle size={12} /> Normal</span>;
      case 'pothole': return <span className="badge badge-danger"><AlertCircle size={12} /> Pothole</span>;
      case 'crack': return <span className="badge badge-warning"><TriangleAlert size={12} /> Crack</span>;
      case 'damaged road': return <span className="badge badge-warning"><TriangleAlert size={12} /> Damaged</span>;
      default: return <span className="badge">{className}</span>;
    }
  };

  // Prepare analytics data
  const classCounts = history.reduce((acc, curr) => {
    acc[curr.predicted_class] = (acc[curr.predicted_class] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.keys(classCounts).map(key => ({
    name: key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    count: classCounts[key],
    fill: key === 'normal road' ? '#10b981' : 
          key === 'pothole' ? '#ef4444' : 
          key === 'crack' ? '#f59e0b' : '#f97316'
  }));

  return (
    <div className="glass-panel p-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 border-b border-slate-800 pb-8">
        <div className="md:col-span-2">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-6">
              <Clock size={20} className="text-blue-400" />
              Prediction History
            </h2>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
              <table className="custom-table">
                <thead className="sticky top-0 bg-slate-900 z-10">
                  <tr>
                    <th>Image</th>
                    <th>Prediction</th>
                    <th>Confidence</th>
                    <th>Latency</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length > 0 ? (
                     history.map((record) => (
                      <tr key={record.id} className="transition-colors">
                        <td className="font-medium max-w-[120px] truncate" title={record.image_name}>
                          {record.image_name}
                        </td>
                        <td className="whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                                {getStatusBadge(record.predicted_class)}
                                {getPriorityBadge(record.predicted_class, record.confidence)}
                            </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <div className="w-12 h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${record.predicted_class === 'normal road' ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                                style={{ width: `${record.confidence * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium">{(record.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="text-slate-300 font-mono text-sm whitespace-nowrap">
                            {record.latency_ms ? `${record.latency_ms.toFixed(0)}ms` : '--'}
                        </td>
                        <td className="text-slate-400 text-sm whitespace-nowrap">
                          {formatDate(record.timestamp)}
                        </td>
                      </tr>
                    ))
                  ) : (
                     <tr>
                      <td colSpan="5" className="text-center py-8 text-slate-500">
                        No predictions yet. Upload an image to start.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
        </div>

        <div className="bg-slate-800/20 rounded-xl p-4 border border-slate-700">
            <h3 className="text-md font-semibold flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-purple-400" />
              Condition Distribution
            </h3>
            <div className="h-[300px] w-full mt-6">
              {history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 12}} />
                    <YAxis allowDecimals={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <Tooltip cursor={{fill: '#1e293b'}} contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px'}} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                  Waiting for data...
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryTable;
