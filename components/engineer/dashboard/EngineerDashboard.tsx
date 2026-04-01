"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { LogOut, CheckCircle, Clock, MapPin, AlertTriangle, Activity } from 'lucide-react';

interface Task {
  id: string;
  location: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
}

export default function EngineerDashboard({ engineerName, badgeId, region, engineerEmail, onClockOut }: any) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch tasks assigned specifically to this engineer BY BADGE ID
  const fetchTasks = useCallback(async () => {
    console.log("Current Engineer Badge ID:", badgeId); // Changed to log badgeId

    if (!badgeId || badgeId === 'undefined') {
        console.warn("Fetch aborted: No Badge ID found.");
        return;
    }

    try {
      // Changed the API endpoint to use badgeId instead of email
      // Note: Make sure this URL matches the folder where you put the new API route!
      const res = await fetch(`/api/tasks?badgeId=${encodeURIComponent(badgeId)}`);
      const result = await res.json();
      
      console.log("Database Response:", result);

      if (result.success && result.data) {
        setTasks(result.data);
      }
    } catch (err) {
      console.error("Failed to load tasks", err);
    } finally {
      setLoading(false);
    }
  }, [badgeId]); // Changed dependency from engineerEmail to badgeId

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, [fetchTasks]);

  // 2. Resolve Task Logic
  const handleResolve = async (taskId: string) => {
    try {
      const res = await fetch('/api/tasks/resolve', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      });

      if (res.ok) {
        // Optimistically update UI
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'COMPLETED' } : t));
        alert("Node Cleared! This location is now open for new monitoring.");
      }
    } catch (err) {
      alert("Failed to resolve task");
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'PENDING');

  return (
    <div className="flex flex-col min-h-screen bg-[#131313] p-8">
      {/* Header */}
      <header className="flex justify-between items-center mb-12 border-b border-white/10 pb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tighter uppercase">Field Operations</h1>
          <p className="text-neutral-500 text-sm mt-1">Engineer: {engineerName} ({badgeId}) | Region: {region}</p>
        </div>
        <button onClick={onClockOut} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors uppercase text-xs font-bold tracking-widest">
          <LogOut className="w-4 h-4" /> Clock Out
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Task List Section */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Active Dispatch Queue
          </h3>

          {loading ? (
            <div className="text-neutral-500 animate-pulse">Synchronizing with RLDC Command...</div>
          ) : pendingTasks.length === 0 ? (
            <div className="bg-[#1c1b1b] p-12 rounded-sm border border-dashed border-white/10 text-center">
              <p className="text-neutral-500 uppercase tracking-widest text-xs">No active faults in your sector.</p>
            </div>
          ) : (
            pendingTasks.map((task) => (
              <div key={task.id} className="bg-[#1c1b1b] border-l-4 border-red-500 p-6 rounded-sm shadow-xl animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded font-bold uppercase">
                        {task.severity}
                      </span>
                      <span className="text-neutral-600 font-mono text-[10px] uppercase">{task.id.split('-')[1]}</span>
                    </div>
                    <h4 className="text-xl font-bold text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-neutral-500" /> {task.location}
                    </h4>
                  </div>
                  <span className="text-neutral-500 text-[10px] font-mono">
                    {new Date(task.created_at).toLocaleTimeString()}
                  </span>
                </div>
                
                <p className="text-neutral-400 text-sm leading-relaxed mb-6">{task.description}</p>
                
                <button 
                  onClick={() => handleResolve(task.id)}
                  className="w-full bg-white hover:bg-neutral-200 text-[#1a1c1c] font-bold py-3 rounded-sm uppercase tracking-tighter text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <CheckCircle className="w-4 h-4" /> Resolve & Clear Node
                </button>
              </div>
            ))
          )}
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-6">
          <div className="bg-[#1c1b1b] p-6 rounded-sm">
            <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4">Daily Performance</h4>
            <div className="flex items-end justify-between">
              <span className="text-4xl font-bold text-white tracking-tighter">
                {tasks.filter(t => t.status === 'COMPLETED').length}
              </span>
              <span className="text-neutral-500 text-xs mb-1 uppercase font-medium">Faults Resolved</span>
            </div>
          </div>
          <div className="bg-[#1c1b1b] p-6 rounded-sm border border-yellow-500/10">
            <h4 className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-4">Current Status</h4>
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse shadow-[0_0_10px_#eab308]" />
              <span className="text-white font-bold uppercase tracking-widest text-xs">On Call</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}