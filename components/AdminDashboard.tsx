"use client";
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, PlusCircle, UserPlus, FileText, ChevronLeft, ChevronRight, X, Activity, Radio, AlertCircle, Globe } from 'lucide-react';
import LeafletMap from './LeafletMap';

const SMOOTH_EASE = [0.22, 1, 0.36, 1];

export default function AdminDashboard({ selectedState, substations, selectedSubstation, selectedSubstationId, setSelectedSubstationId, leafletReady, handleBack, setShowStationModal, setShowEngineerModal, handleGenerateReport, handlePrevSubstation, handleNextSubstation, updateSubstationCapacity }: any) {
  return (
    <motion.div key="dashboard-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="min-h-screen bg-[#131313] flex">
      <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.1, ease: SMOOTH_EASE }} className="w-20 lg:w-72 bg-[#1c1b1b] flex flex-col p-8 shrink-0 z-20">
        <div className="flex items-center gap-6 mb-16">
          <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_12px_#ffffff] shrink-0" />
          <div className="hidden lg:block">
            <span className="font-bold text-xl tracking-tighter text-white block">RLDC Admin</span>
            <span className="text-[11px] text-neutral-500 font-medium tracking-[0.1em] uppercase mt-1 block">{selectedState?.name}</span>
          </div>
        </div>
        <nav className="flex-1 space-y-4">
          <button className="flex items-center gap-4 text-white font-bold text-sm tracking-tight uppercase w-full"><span className="w-1.5 h-1.5 bg-white rounded-full" /> Geographic Mapping</button>
          <button className="flex items-center gap-4 text-neutral-500 hover:text-white transition-colors font-medium text-sm tracking-tight uppercase w-full pl-[22px]">Load Analytics</button>
        </nav>
        <button onClick={handleBack} className="mt-auto flex items-center gap-4 text-neutral-500 hover:text-white transition-all w-full group"><LogOut className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" /><span className="hidden lg:block font-bold uppercase tracking-tight text-sm">Terminate Session</span></button>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.2, ease: SMOOTH_EASE }} className="flex-1 overflow-y-auto p-4 lg:p-12 flex flex-col">
        <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 mb-12 shrink-0">
          <div><h2 className="text-4xl font-bold tracking-tighter text-white">Regional Telemetry</h2><p className="text-neutral-400 text-sm mt-2">Live grid data stream.</p></div>
          <div className="flex flex-col md:flex-row items-end md:items-center gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <button onClick={() => setShowStationModal(true)} className="bg-[#2a2a2a] hover:bg-[#353534] text-white px-6 py-3 rounded-sm text-xs font-bold uppercase tracking-tight flex items-center gap-3 transition-colors"><PlusCircle className="w-4 h-4" /> Add Station</button>
              <button onClick={() => setShowEngineerModal(true)} className="bg-[#2a2a2a] hover:bg-[#353534] text-white px-6 py-3 rounded-sm text-xs font-bold uppercase tracking-tight flex items-center gap-3 transition-colors"><UserPlus className="w-4 h-4" /> Add Engineer</button>
              <button onClick={handleGenerateReport} className="bg-[#2a2a2a] hover:bg-[#353534] text-white px-6 py-3 rounded-sm text-xs font-bold uppercase tracking-tight flex items-center gap-3 transition-colors"><FileText className="w-4 h-4" /> Reports</button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_#ffffff]"></div>
              <span className="text-[11px] font-medium tracking-[0.1em] uppercase text-neutral-400">Uplink Secured</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 shrink-0">
          <div className="bg-[#1c1b1b] p-8 rounded-sm"><p className="text-[11px] text-neutral-500 mb-4 font-medium uppercase tracking-[0.1em]">Regional Load</p><h4 className="text-4xl font-bold tracking-tighter text-white mb-6">{selectedState?.load}%</h4><div className="h-1 w-full bg-[#0e0e0e] rounded-sm overflow-hidden"><div className="h-full bg-white w-[65%]" /></div></div>
          <div className="bg-[#1c1b1b] p-8 rounded-sm"><p className="text-[11px] text-neutral-500 mb-4 font-medium uppercase tracking-[0.1em]">Active Nodes</p><h4 className="text-4xl font-bold tracking-tighter text-white mb-6">{substations.length}</h4><div className="h-1 w-full bg-[#0e0e0e] rounded-sm overflow-hidden"><div className="h-full bg-white w-full" /></div></div>
          <div className="bg-[#1c1b1b] p-8 rounded-sm"><p className="text-[11px] text-neutral-500 mb-4 font-medium uppercase tracking-[0.1em]">Warnings</p><h4 className={`text-4xl font-bold tracking-tighter mb-6 ${substations.some((s:any) => s.status === 'warning' || s.status === 'critical') ? 'text-red-500' : 'text-white'}`}>{substations.filter((s:any) => s.status === 'warning' || s.status === 'critical').length.toString().padStart(2, '0')}</h4><div className="h-1 w-full bg-[#0e0e0e] rounded-sm overflow-hidden"><div className={`h-full ${substations.some((s:any) => s.status === 'warning' || s.status === 'critical') ? 'bg-red-500 w-full' : 'bg-white w-[5%]'}`} /></div></div>
        </div>

        <div className="flex-1 min-h-[600px] grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 bg-[#0e0e0e] rounded-sm flex flex-col relative overflow-hidden min-h-[500px] p-1 border border-[#474747]/15">
            <div className="absolute top-6 left-6 z-20 pointer-events-none"><h3 className="text-[11px] font-medium tracking-[0.1em] uppercase text-neutral-400">Tactical GIS Mapping</h3></div>
            {leafletReady && selectedState ? <LeafletMap selectedState={selectedState} substations={substations} selectedSubstationId={selectedSubstationId} onSelectSubstation={setSelectedSubstationId} /> : <div className="w-full h-full flex items-center justify-center text-neutral-500"><Activity className="w-6 h-6 animate-spin text-neutral-600"/></div>}
          </div>
          <div className="xl:col-span-1 flex flex-col h-full bg-[#1c1b1b] rounded-sm overflow-hidden relative">
            <AnimatePresence mode="wait">
              {selectedSubstation ? (
                <motion.div key={selectedSubstation.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col p-8 overflow-y-auto">
                  <div className="flex items-start justify-between mb-8 shrink-0">
                    <div>
                      <div className="text-[11px] text-neutral-500 tracking-[0.1em] uppercase mb-2">Selected Node</div>
                      <h3 className={`text-2xl font-bold tracking-tighter mb-1 ${selectedSubstation.status === 'critical' ? 'text-red-500' : 'text-white'}`}>{selectedSubstation.name}</h3>
                      <p className="text-neutral-500 text-xs font-mono uppercase">{selectedSubstation.id}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-3">
                        <button onClick={handlePrevSubstation} className="text-neutral-500 hover:text-white transition-colors" title="Previous"><ChevronLeft className="w-5 h-5"/></button>
                        <span className="text-sm font-mono text-neutral-300">{substations.findIndex((s:any)=>s.id===selectedSubstation.id) + 1}/{substations.length}</span>
                        <button onClick={handleNextSubstation} className="text-neutral-500 hover:text-white transition-colors" title="Next"><ChevronRight className="w-5 h-5"/></button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0e0e0e] p-6 rounded-sm shrink-0 mb-6">
                    <div className="flex justify-between text-[11px] mb-4 font-medium text-neutral-400 uppercase tracking-[0.1em]"><span>Output Load</span><span className={`${selectedSubstation.status === 'critical' ? 'text-red-500' : 'text-white'}`}>{selectedSubstation.currentLoadMW} MW</span></div>
                    <div className="h-1 bg-[#1c1b1b] rounded-sm overflow-hidden relative"><div className="absolute top-0 bottom-0 left-[85%] w-px bg-[#474747] z-10"></div><motion.div animate={{ width: `${Math.min((selectedSubstation.currentLoadMW / selectedSubstation.maxCapacityMW) * 100, 100)}%` }} className={`h-full ${selectedSubstation.status === 'critical' ? 'bg-red-500' : 'bg-white'}`} /></div>
                  </div>
                  <div className="bg-[#0e0e0e] p-6 rounded-sm shrink-0 mb-6">
                      <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-[0.1em] mb-4">Safe Capacity Limit</h4>
                      <input type="range" min="50" max="500" step="10" value={selectedSubstation.maxCapacityMW} onChange={(e) => updateSubstationCapacity(selectedSubstation.id, parseInt(e.target.value))} className="w-full h-1 bg-[#1c1b1b] rounded-sm appearance-none cursor-pointer accent-white" />
                      <div className="flex justify-between text-xs text-neutral-500 font-mono mt-4"><span>50 MW</span><span className="text-white">{selectedSubstation.maxCapacityMW} MW</span><span>500 MW</span></div>
                  </div>
                  <div className="bg-[#0e0e0e] p-6 rounded-sm flex-1 flex flex-col min-h-[200px]">
                      <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-[0.1em] mb-4">Terminal Logs</h4>
                      <div className="space-y-4 overflow-y-auto pr-2 flex-1">
                          {selectedSubstation.logs.map((log:any) => (
                              <div key={log.id} className="flex flex-col"><p className={`text-sm leading-relaxed mb-1 ${log.type === 'critical' ? 'text-red-400 font-medium' : log.type === 'success' ? 'text-white' : 'text-neutral-400'}`}>{log.message}</p><span className="text-neutral-600 font-mono text-[10px]">{log.timestamp.toLocaleTimeString()}</span></div>
                          ))}
                      </div>
                  </div>
                </motion.div>
              ) : <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-500 p-8"><p className="text-[11px] uppercase tracking-[0.1em] font-medium">Select a node</p></div>}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
