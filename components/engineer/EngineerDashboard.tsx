"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, cubicBezier } from 'framer-motion';
import { LogOut, CheckCircle2, AlertCircle, Info } from 'lucide-react';

const SMOOTH_EASE = cubicBezier(0.22, 1, 0.36, 1);

type EngineerTab = 'inbox' | 'profile' | 'leave';

type LeaveRequest = {
  id: string;
  engineerEmail: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
};

type EngineerTask = {
  id: string;
  location: string;
  description: string;
  severity: 'medium' | 'critical';
  status: 'pending' | 'completed';
  timestamp: Date;
};

type AppAlert = { id: string; message: string; type: 'critical' | 'success' | 'info' };

interface EngineerDashboardProps {
  engineerEmail: string;
  engineerName: string;
  region: string;
  onClockOut: () => void;
}

export default function EngineerDashboard({
  engineerEmail,
  engineerName,
  region,
  onClockOut
}: EngineerDashboardProps) {
  const [engTab, setEngTab] = useState<EngineerTab>('inbox');
  const [activeAlerts, setActiveAlerts] = useState<AppAlert[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveRequestsLoading, setLeaveRequestsLoading] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ start: '', end: '', reason: '' });

  const [engTasks, setEngTasks] = useState<EngineerTask[]>([
    {
      id: 'tsk-001',
      location: 'Substation Alpha',
      description: 'Transformer Oil Temp Critical',
      severity: 'critical',
      status: 'pending',
      timestamp: new Date(Date.now() - 3600000)
    },
    {
      id: 'tsk-002',
      location: 'Sector 42 Relay',
      description: 'Phase B Voltage Drop',
      severity: 'medium',
      status: 'pending',
      timestamp: new Date(Date.now() - 7200000)
    }
  ]);

  const pushAlert = (message: string, type: 'critical' | 'success' | 'info') => {
    const id = Math.random().toString();
    setActiveAlerts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setActiveAlerts((prev) => prev.filter((item) => item.id !== id)), 4500);
  };

  const mapLeaveRow = (row: any): LeaveRequest => ({
    id: String(row.id),
    engineerEmail: String(row.engineer_email ?? row.engineerEmail),
    startDate: String(row.start_date ?? row.startDate),
    endDate: String(row.end_date ?? row.endDate),
    reason: String(row.reason),
    status: String(row.status).toLowerCase() as LeaveRequest['status'],
    submittedAt: String(row.submitted_at ?? row.submittedAt)
  });

  useEffect(() => {
    const loadLeaves = async () => {
      try {
        setLeaveRequestsLoading(true);
        const response = await fetch(`/api/leave-requests?engineerEmail=${encodeURIComponent(engineerEmail)}`, {
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error('Failed loading leaves');
        }

        const payload = await response.json();
        const rows = Array.isArray(payload.data) ? payload.data : [];
        setLeaveRequests(rows.map(mapLeaveRow));
      } catch {
        pushAlert('Unable to load leave history right now.', 'info');
      } finally {
        setLeaveRequestsLoading(false);
      }
    };

    if (engineerEmail) {
      loadLeaves();
    }
  }, [engineerEmail]);

  const handleResolveTask = (taskId: string) => {
    setEngTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'completed' } : t)));
    pushAlert('Fault marked as successfully resolved.', 'success');
  };

  const handleLeaveSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!leaveForm.start || !leaveForm.end || !leaveForm.reason || !engineerEmail) return;

    try {
      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineerEmail,
          startDate: new Date(`${leaveForm.start}T00:00:00Z`).toISOString(),
          endDate: new Date(`${leaveForm.end}T00:00:00Z`).toISOString(),
          reason: leaveForm.reason.trim()
        })
      });

      if (!response.ok) throw new Error('Leave submit failed');

      const payload = await response.json();
      if (payload.data) {
        setLeaveRequests((prev) => [mapLeaveRow(payload.data), ...prev]);
      }
      setLeaveForm({ start: '', end: '', reason: '' });
      pushAlert('Leave application successfully submitted.', 'success');
    } catch {
      pushAlert('Leave application could not be submitted.', 'critical');
    }
  };

  return (
    <motion.div
      key="engineer-portal-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-[#131313] flex"
    >
      <div className="fixed top-8 right-8 z-100 flex flex-col gap-4 pointer-events-none">
        <AnimatePresence>
          {activeAlerts.map((alert) => {
            const isCritical = alert.type === 'critical';
            const isSuccess = alert.type === 'success';
            const Icon = isCritical ? AlertCircle : isSuccess ? CheckCircle2 : Info;
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, x: 10 }}
                className="bg-[#1c1b1b] border border-[#474747]/15 p-6 rounded-sm flex items-start gap-4 w-80 pointer-events-auto shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
              >
                <Icon className={`w-5 h-5 shrink-0 ${isCritical ? 'text-red-500' : 'text-white'}`} />
                <div>
                  <h4 className="font-bold text-[11px] tracking-widest uppercase text-white mb-1">
                    {isCritical ? 'System Critical' : isSuccess ? 'Operation Complete' : 'System Event'}
                  </h4>
                  <p className="text-sm text-neutral-400 leading-relaxed">{alert.message}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <motion.div
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: SMOOTH_EASE }}
        className="w-20 lg:w-72 bg-[#1c1b1b] flex flex-col p-8 shrink-0 z-20"
      >
        <div className="flex items-center gap-6 mb-16">
          <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_12px_#ffffff] shrink-0" />
          <div className="hidden lg:block">
            <span className="font-bold text-xl tracking-tighter text-white block">Field Ops</span>
            <span className="text-[11px] text-neutral-500 font-medium tracking-widest uppercase mt-1 block">Engineer Portal</span>
          </div>
        </div>
        <nav className="flex-1 space-y-4">
          <button onClick={() => setEngTab('inbox')} className={`flex justify-between items-center font-bold text-sm tracking-tight uppercase w-full ${engTab === 'inbox' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-5.5'}`}>
            <div className="flex items-center gap-4">{engTab === 'inbox' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />} Fault Inbox</div>
            {engTasks.filter((t) => t.status === 'pending').length > 0 && <span className="text-[10px] bg-white text-black px-2 py-0.5 rounded-sm">{engTasks.filter((t) => t.status === 'pending').length}</span>}
          </button>
          <button onClick={() => setEngTab('profile')} className={`flex items-center gap-4 font-bold text-sm tracking-tight uppercase w-full ${engTab === 'profile' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-5.5'}`}>{engTab === 'profile' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />} My Profile</button>
          <button onClick={() => setEngTab('leave')} className={`flex items-center gap-4 font-bold text-sm tracking-tight uppercase w-full ${engTab === 'leave' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-5.5'}`}>{engTab === 'leave' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />} Leave Application</button>
        </nav>
        <button onClick={onClockOut} className="mt-auto flex items-center gap-4 text-neutral-500 hover:text-white transition-all w-full group"><LogOut className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" /><span className="hidden lg:block font-bold uppercase tracking-tight text-sm">Clock Out</span></button>
      </motion.div>

      <div className="flex-1 p-4 lg:p-12 overflow-y-auto">
        <header className="mb-12 border-b border-[#474747]/15 pb-8">
          <h2 className="text-4xl font-bold tracking-tighter text-white">Maintenance Directives</h2>
          <p className="text-neutral-400 text-sm mt-2">State: <span className="text-white font-medium">{region}</span> | Status: <span className="text-white font-medium">On Duty</span></p>
        </header>

        {engTab === 'inbox' && (
          <div className="max-w-4xl space-y-6">
            {engTasks.map((task) => (
              <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`bg-[#1c1b1b] rounded-sm p-8 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center transition-all ${task.status === 'completed' ? 'opacity-40' : ''}`}>
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-4"><span className="text-neutral-500 text-[11px] font-medium tracking-widest uppercase">{task.status === 'completed' ? 'Resolved' : `${task.severity} Priority`}</span><span className="text-neutral-600 text-[11px] font-mono">{task.timestamp.toLocaleTimeString()}</span></div>
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
                <div><h2 className="text-4xl font-bold tracking-tighter text-white mb-2">{engineerName || 'Engineer'}</h2><p className="text-neutral-500 font-mono text-sm mb-4">{engineerEmail}</p><span className="text-white text-[11px] font-bold uppercase tracking-widest">Field Engineer</span></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-[#474747]/15 pt-12">
                <div className="space-y-6">
                  <div><p className="text-[11px] text-neutral-500 font-medium tracking-widest uppercase mb-1">Department</p><p className="text-white text-sm">High Voltage Transmissions</p></div>
                  <div><p className="text-[11px] text-neutral-500 font-medium tracking-widest uppercase mb-1">Base Region</p><p className="text-white text-sm">{region || 'Local'} Grid</p></div>
                </div>
                <div className="space-y-6">
                  <div className="bg-[#0e0e0e] p-6 rounded-sm"><span className="block text-[11px] text-neutral-500 font-medium tracking-widest uppercase mb-2">Faults Resolved</span><span className="text-3xl font-bold tracking-tighter text-white">{engTasks.filter((t) => t.status === 'completed').length}</span></div>
                  <div className="bg-[#0e0e0e] p-6 rounded-sm"><span className="block text-[11px] text-neutral-500 font-medium tracking-widest uppercase mb-2">Duty Hours (Mo)</span><span className="text-3xl font-bold tracking-tighter text-white">164h</span></div>
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
                  <div><label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-2">Start Date</label><input type="date" required value={leaveForm.start} onChange={(e) => setLeaveForm({ ...leaveForm, start: e.target.value })} className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 text-white outline-none" /></div>
                  <div><label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-2">End Date</label><input type="date" required value={leaveForm.end} onChange={(e) => setLeaveForm({ ...leaveForm, end: e.target.value })} className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 text-white outline-none" /></div>
                </div>
                <div><label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-2">Reason</label><textarea required rows={4} value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 text-white outline-none resize-none"></textarea></div>
                <button type="submit" className="w-full bg-white hover:bg-neutral-200 text-[#1a1c1c] font-bold py-4 rounded-sm transition-all tracking-tight uppercase mt-4">Submit Request</button>
              </form>
            </div>
            <div className="bg-[#1c1b1b] rounded-sm p-10 flex flex-col">
              <h3 className="text-2xl font-bold tracking-tighter text-white mb-8 border-b border-[#474747]/15 pb-6">Leave History</h3>
              <div className="space-y-6 overflow-y-auto flex-1 pr-2">
                {leaveRequestsLoading && <p className="text-neutral-500 text-sm">Loading leave history...</p>}
                {!leaveRequestsLoading && leaveRequests.length === 0 && <p className="text-neutral-500 text-sm">No leave requests currently in system.</p>}
                {leaveRequests.map((leave) => (
                  <div key={leave.id} className="bg-[#0e0e0e] p-6 rounded-sm">
                    <div className="flex justify-between items-start mb-4"><div className="text-sm font-bold text-white tracking-tight">{new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}</div><span className="text-[11px] font-medium tracking-widest uppercase text-neutral-500">{leave.status}</span></div>
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
