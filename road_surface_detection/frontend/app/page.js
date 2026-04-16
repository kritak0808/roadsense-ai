"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, ShieldCheck, Database, Server } from 'lucide-react';
import ImageUpload from '../components/ImageUpload';
import PredictionResult from '../components/PredictionResult';
import HistoryTable from '../components/HistoryTable';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import { Download } from 'lucide-react';

const API_URL = 'http://localhost:5000';

export default function Home() {
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [serverStatus, setServerStatus] = useState('checking');

  useEffect(() => {
    checkServerStatus();
    fetchHistory();
    // Poll for history every 10s
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkServerStatus = async () => {
    try {
      await axios.get(`${API_URL}/health`);
      setServerStatus('online');
    } catch (err) {
      setServerStatus('offline');
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/history`);
      if (res.data && res.data.success) {
        setHistory(res.data.history);
      }
    } catch (error) {
      console.error("Failed to fetch history");
    }
  };

  const handlePredict = async (files, location = null) => {
    const formData = new FormData();
    // Append all selected files
    files.forEach(file => {
      formData.append('images', file);
    });

    if (location) {
      formData.append('latitude', location.latitude);
      formData.append('longitude', location.longitude);
    }

    try {
      const res = await axios.post(`${API_URL}/predict_batch`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data.success) {
        // Just show the first result in the card 
        const latestResult = res.data.results[0];
        
        // Add a cache-buster timestamp to the heatmap URL
        if (latestResult.heatmap_url) {
          latestResult.heatmap_url = `${latestResult.heatmap_url}?t=${Date.now()}`;
        }
        
        setResult(latestResult);
        fetchHistory(); // Still update history table
        
      } else {
        alert("Prediction failed: " + res.data.error);
      }
    } catch (error) {
      alert("Error communicating with server: " + (error.response?.data?.error || error.message));
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await axios.get(`${API_URL}/export_history`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'prediction_history.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert("Error exporting CSV: " + error.message);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 glass-panel p-4 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
            <span className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <Activity size={24} />
            </span>
            <span className="heading-gradient">RoadVision AI</span>
          </h1>
          <p className="text-slate-400">Automatic Road Surface Damage Detection using VisNet-based CNN</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-sm font-medium">
            <Server size={14} className={serverStatus === 'online' ? 'text-emerald-400' : 'text-rose-400'} />
            <span className={serverStatus === 'online' ? 'text-emerald-400' : 'text-rose-400'}>
              API: {serverStatus.toUpperCase()}
            </span>
          </div>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-sm font-medium text-slate-200 transition-all shrink-0"
          >
            <Download size={16} className="text-blue-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="h-full min-h-[450px]">
          <ImageUpload onPredict={handlePredict} />
        </div>
        <div className="h-full min-h-[450px]">
          <PredictionResult result={result} API_URL={API_URL} />
        </div>
      </div>

      {/* Analytics Dashboard */}
      <div className="mb-8">
        <AnalyticsDashboard API_URL={API_URL} />
      </div>

      {/* History Table */}
      <HistoryTable history={history} />
    </main>
  );
}
