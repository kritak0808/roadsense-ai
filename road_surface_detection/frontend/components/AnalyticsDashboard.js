"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FileBarChart, DollarSign, AlertCircle } from 'lucide-react';

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#64748b']; // Red (Pothole), Yellow (Crack), Green (Intact), Gray (Unknown)

export default function AnalyticsDashboard({ API_URL }) {
  const [data, setData] = useState({
    total_reports: 0,
    estimated_cost: 0,
    distribution: [],
    timeline: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${API_URL}/analytics`);
      if (res.data && res.data.success) {
        setData({
          total_reports: res.data.total_reports,
          estimated_cost: res.data.estimated_cost,
          distribution: res.data.distribution,
          timeline: res.data.timeline
        });
      }
    } catch (error) {
      console.error("Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-panel p-6 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <FileBarChart className="text-blue-400" size={24} />
        <h2 className="text-xl font-bold">Analytics & Insights</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Summary and Distribution */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Cost Estimate Card */}
          <div className="glass-panel p-5 flex items-center gap-4 border-l-4 border-emerald-500">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <DollarSign size={28} />
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">Est. Repair Cost</p>
              <h3 className="text-2xl font-bold">${data.estimated_cost.toLocaleString()}</h3>
            </div>
          </div>
          
          {/* Distribution Chart */}
          <div className="glass-panel p-5 flex-1">
            <h3 className="text-sm text-slate-400 font-medium mb-4 flex items-center gap-2">
              <AlertCircle size={16} /> Damage Distribution
            </h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Timeline Chart */}
        <div className="lg:col-span-2 glass-panel p-5">
           <h3 className="text-sm text-slate-400 font-medium mb-4">Reports Timeline</h3>
           <div className="h-64 w-full">
             {data.timeline.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.timeline}>
                    <XAxis 
                      dataKey="date" 
                      stroke="#64748b" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      cursor={{ fill: '#334155', opacity: 0.4 }}
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                    />
                    <Bar dataKey="reports" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Damage Reports" />
                  </BarChart>
                </ResponsiveContainer>
             ) : (
               <div className="flex w-full h-full items-center justify-center text-slate-500">
                 No timeline data available yet.
               </div>
             )}
           </div>
        </div>

      </div>
    </div>
  );
}
