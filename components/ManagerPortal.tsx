"use client";
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Activity, Globe, ChevronLeft, ChevronRight, UserPlus, FileText, CheckCircle2, XSquare, Home, Zap, CalendarDays, Server } from 'lucide-react';
import LeafletMap from './LeafletMap';

const SMOOTH_EASE = [0.22, 1, 0.36, 1];

export default function ManagerPortal({ selectedState, substations, selectedSubstation, selectedSubstationId, setSelectedSubstationId, leafletReady, managerTab, setManagerTab, handleBack, setShowEngineerModal, handleGenerateReport, smartMeters, leaveRequests, handleLeaveAction, handlePrevSubstation, handleNextSubstation, updateSubstationCapacity }: any) {
  return (
    <motion.div key="manager-portal-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="min-h-screen bg-[#131313] flex">
      <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.1, ease: SMOOTH_EASE }} className="w-20 lg:w-72 bg-[#1c1b1b] flex flex-col p-8 shrink-0 z-20">
        <div className="flex items-center gap-6 mb-16">
          <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_12px_#ffffff] shrink-0" />
          <div className="hidden lg:block"><span className="font-bold text-xl tracking-tighter text-white block">Substation Mgr</span><span className="text-[11px] text-neutral-500 font-medium tracking-[0.1em] uppercase mt-1 block">Local Control</span></div>
        </div>
        <nav className="flex-1 space-y-4">
          <button onClick={() => setManagerTab('overview')} className={`flex items-center gap-4 font-bold text-sm tracking-tight uppercase w-full ${managerTab === 'overview' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-[22px]'}`}>{managerTab === 'overview' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />} Overview</button>
          <button onClick={() => setManagerTab('meters')} className={`flex items-center gap-4 font-bold text-sm tracking-tight uppercase w-full ${managerTab === 'meters' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-[22px]'}`}>{managerTab === 'meters' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />} Meter Telemetry</button>
          <button onClick={() => setManagerTab('leave-approvals')} className={`flex items-center justify-between font-bold text-sm tracking-tight uppercase w-full ${managerTab === 'leave-approvals' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-[22px]'}`}>
            <div className="flex items-center gap-4">{managerTab === 'leave-approvals' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />} Personnel</div>
            {leaveRequests.filter((l:any) => l.status === 'pending').length > 0 && <span className="text-[10px] bg-white text-black px-2 py-0.5 rounded-sm">{leaveRequests.filter((l:any) => l.status === 'pending').length}</span>}
          </button>
        </nav>
        <button onClick={handleBack} className="mt-auto flex items-center gap-4 text-neutral-500 hover:text-white transition-all w-full group"><LogOut className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" /><span className="hidden lg:block font-bold uppercase tracking-tight text-sm">Terminate Session</span></button>
      </motion.div>

      <div className="flex-1 p-4 lg:p-12 overflow-y-auto">
        <header className="mb-12 border-b border-[#474747]/15 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div><h2 className="text-4xl font-bold text-white tracking-tighter">Node Administration</h2><p className="text-neutral-400 text-sm mt-2">Managing Substation Telemetry</p></div>
          <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <button onClick={() => setShowEngineerModal(true)} className="bg-[#2a2a2a] hover:bg-[#353534] text-white px-6 py-3 rounded-sm text-xs font-bold uppercase tracking-tight flex items-center gap-3 transition-colors">Assign Engineer</button>
              <button onClick={handleGenerateReport} className="bg-[#2a2a2a] hover:bg-[#353534] text-white px-6 py-3 rounded-sm text-xs font-bold uppercase tracking-tight flex items-center gap-3 transition-colors">Generate Report</button>
            </div>
          </div>
        </header>

        {managerTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
             <div className="bg-[#1c1b1b] rounded-sm p-8"><p className="text-[11px] text-neutral-500 font-medium uppercase tracking-[0.1em] mb-4">Node Health</p><div className="text-4xl font-bold tracking-tighter text-white mb-2">{substations[0]?.currentLoadMW || 0} <span className="text-xl text-neutral-500 tracking-normal">MW</span></div></div>
             <div className="bg-[#1c1b1b] rounded-sm p-8"><p className="text-[11px] text-neutral-500 font-medium uppercase tracking-[0.1em] mb-4">Connected Smart Meters</p><div className="text-4xl font-bold tracking-tighter text-white mb-2">{smartMeters.length} <span className="text-xl text-neutral-500 tracking-normal">Units</span></div></div>
          </div>
        )}

        {managerTab === 'overview' && (
          <div className="flex-1 min-h-[600px] grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 bg-[#0e0e0e] rounded-sm flex flex-col relative overflow-hidden min-h-[500px] p-1 border border-[#474747]/15">
              <div className="absolute top-6 left-6 z-20 pointer-events-none"><h3 className="text-[11px] font-medium tracking-[0.1em] uppercase text-neutral-400">Tactical GIS Mapping</h3></div>
              {leafletReady && selectedState ? <LeafletMap selectedState={selectedState} substations={substations} selectedSubstationId={selectedSubstationId} onSelectSubstation={setSelectedSubstationId} /> : <div className="w-full h-full flex items-center justify-center text-neutral-500"><Activity className="w-6 h-6 animate-spin"/></div>}
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
                      <div className="flex items-center gap-3">
                        <button onClick={handlePrevSubstation} className="text-neutral-500 hover:text-white transition-colors" title="Previous"><ChevronLeft className="w-5 h-5"/></button>
                        <span className="text-sm font-mono text-neutral-300">{substations.findIndex((s:any)=>s.id===selectedSubstation.id) + 1}/{substations.length}</span>
                        <button onClick={handleNextSubstation} className="text-neutral-500 hover:text-white transition-colors" title="Next"><ChevronRight className="w-5 h-5"/></button>
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
                  </motion.div>
                ) : <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-500 p-8"><p className="text-[11px] uppercase tracking-[0.1em] font-medium">Select a node</p></div>}
              </AnimatePresence>
            </div>
          </div>
        )}

        {managerTab === 'meters' && (
          <div className="bg-[#1c1b1b] rounded-sm p-8">
            <h3 className="text-2xl font-bold tracking-tighter text-white mb-8">Residential Smart Meters</h3>
            <div className="bg-[#0e0e0e] rounded-sm overflow-x-auto p-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-neutral-500 text-[11px] font-medium uppercase tracking-[0.1em]">
                    <th className="p-4 font-normal">Meter ID</th><th className="p-4 font-normal">Address</th><th className="p-4 font-normal">Voltage</th><th className="p-4 font-normal">Status</th><th className="p-4 font-normal text-right">Last Ping</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {smartMeters.map((meter:any, index:number) => (
                    <tr key={meter.id} className={index % 2 === 0 ? 'bg-[#0e0e0e]' : 'bg-[#131313]'}>
                      <td className="p-4 font-mono text-neutral-300">{meter.id}</td><td className="p-4 text-neutral-400">{meter.houseAddress}</td>
                      <td className="p-4"><span className={`font-mono font-bold ${meter.status === 'high' ? 'text-red-400' : meter.status === 'low' ? 'text-neutral-500' : 'text-white'}`}>{meter.voltage} V</span></td>
                      <td className="p-4"><span className={`text-[11px] font-bold uppercase tracking-[0.1em] ${meter.status === 'high' ? 'text-red-400' : meter.status === 'low' ? 'text-neutral-500' : 'text-white'}`}>{meter.status === 'high' ? 'Overvolt' : meter.status === 'low' ? 'Undervolt' : 'Nominal'}</span></td>
                      <td className="p-4 font-mono text-[11px] text-neutral-500 text-right">{meter.lastUpdated.toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {managerTab === 'leave-approvals' && (
          <div className="bg-[#1c1b1b] rounded-sm p-8">
            <h3 className="text-2xl font-bold tracking-tighter text-white mb-8">Pending Leave Approvals</h3>
            <div className="space-y-6">
              {leaveRequests.length === 0 ? <p className="text-neutral-500 text-sm">No leave requests currently in system.</p> : leaveRequests.map((req:any) => (
                  <div key={req.id} className="bg-[#0e0e0e] p-8 rounded-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                    <div>
                      <div className="flex items-center gap-4 mb-3"><h4 className="text-white font-bold text-lg">{req.engineerName}</h4><span className="text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-500">{req.status}</span></div>
                      <p className="text-neutral-400 text-sm mb-2">Dates: {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}</p><p className="text-neutral-500 text-sm italic">"{req.reason}"</p>
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex gap-4 shrink-0">
                        <button onClick={() => handleLeaveAction(req.id, 'approved')} className="text-[#1a1c1c] bg-white hover:bg-neutral-200 px-6 py-3 rounded-sm font-bold uppercase tracking-tight text-xs transition-colors">Approve</button>
                        <button onClick={() => handleLeaveAction(req.id, 'rejected')} className="text-white bg-[#2a2a2a] hover:bg-[#353534] px-6 py-3 rounded-sm font-bold uppercase tracking-tight text-xs transition-colors">Deny</button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
