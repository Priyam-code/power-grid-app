"use client";
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Mail, UserCheck, CalendarDays, MapPin, CheckCircle, User as UserIcon, Briefcase, HardHat } from 'lucide-react';

const SMOOTH_EASE = [0.22, 1, 0.36, 1];

export default function EngineerPortal({ selectedState, engTab, setEngTab, engTasks, leaveRequests, leaveForm, setLeaveForm, handleLeaveSubmit, handleResolveTask, handleBack }: any) {
  return (
    <motion.div key="engineer-portal-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="min-h-screen bg-[#131313] flex">
      <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.1, ease: SMOOTH_EASE }} className="w-20 lg:w-72 bg-[#1c1b1b] flex flex-col p-8 shrink-0 z-20">
        <div className="flex items-center gap-6 mb-16">
          <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_12px_#ffffff] shrink-0" />
          <div className="hidden lg:block"><span className="font-bold text-xl tracking-tighter text-white block">Field Ops</span><span className="text-[11px] text-neutral-500 font-medium tracking-[0.1em] uppercase mt-1 block">Engineer Portal</span></div>
        </div>
        <nav className="flex-1 space-y-4">
          <button onClick={() => setEngTab('inbox')} className={`flex justify-between items-center font-bold text-sm tracking-tight uppercase w-full ${engTab === 'inbox' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-[22px]'}`}>
            <div className="flex items-center gap-4">{engTab === 'inbox' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />} Fault Inbox</div>
            {engTasks.filter((t:any) => t.status === 'pending').length > 0 && <span className="text-[10px] bg-white text-black px-2 py-0.5 rounded-sm">{engTasks.filter((t:any) => t.status === 'pending').length}</span>}
          </button>
          <button onClick={() => setEngTab('profile')} className={`flex items-center gap-4 font-bold text-sm tracking-tight uppercase w-full ${engTab === 'profile' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-[22px]'}`}>{engTab === 'profile' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />} My Profile</button>
          <button onClick={() => setEngTab('leave')} className={`flex items-center gap-4 font-bold text-sm tracking-tight uppercase w-full ${engTab === 'leave' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-[22px]'}`}>{engTab === 'leave' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />} Leave Application</button>
        </nav>
        <button onClick={handleBack} className="mt-auto flex items-center gap-4 text-neutral-500 hover:text-white transition-all w-full group"><LogOut className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" /><span className="hidden lg:block font-bold uppercase tracking-tight text-sm">Clock Out</span></button>
      </motion.div>

      <div className="flex-1 p-4 lg:p-12 overflow-y-auto">
        <header className="mb-12 border-b border-[#474747]/15 pb-8"><h2 className="text-4xl font-bold tracking-tighter text-white">Maintenance Directives</h2><p className="text-neutral-400 text-sm mt-2">Status: <span className="text-white font-medium">On Duty</span></p></header>

        {engTab === 'inbox' && (
          <div className="max-w-4xl space-y-6">
            {engTasks.map((task:any) => (
              <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`bg-[#1c1b1b] rounded-sm p-8 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center transition-all ${task.status === 'completed' ? 'opacity-40' : ''}`}>
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-4"><span className="text-neutral-500 text-[11px] font-medium tracking-[0.1em] uppercase">{task.status === 'completed' ? 'Resolved' : `${task.severity} Priority`}</span><span className="text-neutral-600 text-[11px] font-mono">{task.timestamp.toLocaleTimeString()}</span></div>
                  <h4 className={`text-2xl font-bold tracking-tighter ${task.status === 'completed' ? 'text-neutral-500 line-through' : task.severity === 'critical' ? 'text-red-500' : 'text-white'}`}>{task.description}</h4>
                  <div className="text-neutral-400 text-sm">{task.location}</div>
                </div>
                {task.status === 'pending' ? <button onClick={() => handleResolveTask(task.id)} className="shrink-0 bg-white hover:bg-neutral-200 text-[#1a1c1c] px-8 py-4 rounded-sm font-bold uppercase tracking-tight text-xs transition-colors">Mark Complete</button> : <div className="shrink-0 text-neutral-500 font-bold uppercase tracking-tight text-xs">Done</div>}
              </motion.div>
            ))}
          </div>
        )}

        {engTab === 'profile' && (
          <div className="max-w-3xl">
            <div className="bg-[#1c1b1b] rounded-sm p-12">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-8 mb-12">
                <div className="w-32 h-32 bg-[#0e0e0e] rounded-full flex items-center justify-center shrink-0"><UserIcon className="w-12 h-12 text-neutral-500" /></div>
                <div><h2 className="text-4xl font-bold tracking-tighter text-white mb-2">Ramesh Kumar</h2><p className="text-neutral-500 font-mono text-sm mb-4">ENG-ID: 884-XTR-9</p><span className="text-white text-[11px] font-bold uppercase tracking-[0.1em]">Level 3 Technician</span></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-[#474747]/15 pt-12">
                <div className="space-y-6">
                  <div><p className="text-[11px] text-neutral-500 font-medium tracking-[0.1em] uppercase mb-1">Department</p><p className="text-white text-sm">High Voltage Transmissions</p></div>
                  <div><p className="text-[11px] text-neutral-500 font-medium tracking-[0.1em] uppercase mb-1">Base Station</p><p className="text-white text-sm">{selectedState?.name || 'Local'} Grid</p></div>
                </div>
                <div className="space-y-6">
                   <div className="bg-[#0e0e0e] p-6 rounded-sm"><span className="block text-[11px] text-neutral-500 font-medium tracking-[0.1em] uppercase mb-2">Faults Resolved</span><span className="text-3xl font-bold tracking-tighter text-white">142</span></div>
                   <div className="bg-[#0e0e0e] p-6 rounded-sm"><span className="block text-[11px] text-neutral-500 font-medium tracking-[0.1em] uppercase mb-2">Duty Hours (Mo)</span><span className="text-3xl font-bold tracking-tighter text-white">164h</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {engTab === 'leave' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 max-w-6xl">
            <div className="bg-[#1c1b1b] rounded-sm p-10">
              <h3 className="text-2xl font-bold tracking-tighter text-white mb-8">New Leave Request</h3>
              <form onSubmit={handleLeaveSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div><label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-[0.1em] mb-2">Start Date</label><input type="date" required value={leaveForm.start} onChange={e=>setLeaveForm({...leaveForm, start: e.target.value})} className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 text-white outline-none" /></div>
                  <div><label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-[0.1em] mb-2">End Date</label><input type="date" required value={leaveForm.end} onChange={e=>setLeaveForm({...leaveForm, end: e.target.value})} className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 text-white outline-none" /></div>
                </div>
                <div><label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-[0.1em] mb-2">Reason</label><textarea required rows={4} value={leaveForm.reason} onChange={e=>setLeaveForm({...leaveForm, reason: e.target.value})} className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 text-white outline-none resize-none"></textarea></div>
                <button type="submit" className="w-full bg-white hover:bg-neutral-200 text-[#1a1c1c] font-bold py-4 rounded-sm transition-all tracking-tight uppercase mt-4">Submit Request</button>
              </form>
            </div>
            <div className="bg-[#1c1b1b] rounded-sm p-10 flex flex-col">
              <h3 className="text-2xl font-bold tracking-tighter text-white mb-8 border-b border-[#474747]/15 pb-6">Leave History</h3>
              <div className="space-y-6 overflow-y-auto flex-1 pr-2">
                {leaveRequests.map((leave:any) => (
                  <div key={leave.id} className="bg-[#0e0e0e] p-6 rounded-sm">
                    <div className="flex justify-between items-start mb-4"><div className="text-sm font-bold text-white tracking-tight">{new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}</div><span className="text-[11px] font-medium tracking-[0.1em] uppercase text-neutral-500">{leave.status}</span></div>
                    <p className="text-neutral-400 text-sm leading-relaxed">{leave.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}