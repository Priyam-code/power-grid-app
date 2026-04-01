"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, cubicBezier } from 'framer-motion';
import { LogOut, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import styles from "./dashboard.module.css";

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
  engineerName: string;
  badgeId: string;
  region: string;
  engineerEmail?: string;
  onClockOut: () => void;
}

export default function EngineerDashboard({
  engineerName,
  badgeId,
  region,
  engineerEmail,
  onClockOut
}: EngineerDashboardProps) {
  const [engTab, setEngTab] = useState<EngineerTab>('inbox');
  const [activeAlerts, setActiveAlerts] = useState<AppAlert[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveRequestsLoading, setLeaveRequestsLoading] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ start: '', end: '', reason: '' });

  const [engTasks, setEngTasks] = useState<EngineerTask[]>([]);

  

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
        const response = await fetch(`/api/leave-requests?badgeId=${encodeURIComponent(badgeId)}`, {
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

    if (badgeId) {
      loadLeaves();
    }
  }, [badgeId]);

  const fetchTasks = useCallback(async () => {
    console.log("Current Engineer Badge ID:", badgeId);

    if (!badgeId || badgeId === 'undefined') {
        console.warn("Fetch aborted: No Badge ID found.");
        return;
    }

    try {
      const res = await fetch(`/api/tasks?badgeId=${encodeURIComponent(badgeId)}`);
      const result = await res.json();
      
      console.log("Database Response:", result);

      if (result.success && result.data) {
        const mappedTasks: EngineerTask[] = result.data.map((t: any) => ({
          id: String(t.id),
          location: String(t.location),
          description: String(t.description),
          severity: (t.severity || 'medium').toLowerCase() as 'medium' | 'critical',
          status: (t.status || 'pending').toLowerCase() as 'pending' | 'completed',
          timestamp: new Date(t.created_at)
        }));
        setEngTasks(mappedTasks);
      }
    } catch (err) {
      console.error("Failed to load tasks", err);
    }
  }, [badgeId]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const handleResolveTask = async (taskId: string) => {
    try {
      const res = await fetch('/api/tasks/resolve', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      });

      if (res.ok) {
        setEngTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'completed' } : t)));
        pushAlert('Node Cleared! This location is now open for new monitoring.', 'success');
      } else {
        pushAlert('Failed to resolve task', 'critical');
      }
    } catch (err) {
      pushAlert('Failed to resolve task', 'critical');
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!leaveForm.start || !leaveForm.end || !leaveForm.reason || !badgeId) return;

    try {
      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          badgeId,
          engineerName,
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
      className={styles.container}
    >
      <div className={styles.alertsContainer}>
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
                className={styles.alert}
              >
                <Icon className={`${styles.alertIcon} ${isCritical ? styles.alertIconCritical : styles.alertIconSuccess}`} />
                <div>
                  <h4 className={styles.alertTitle}>
                    {isCritical ? 'System Critical' : isSuccess ? 'Operation Complete' : 'System Event'}
                  </h4>
                  <p className={styles.alertMessage}>{alert.message}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <motion.div
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: cubicBezier(0.22, 1, 0.36, 1) }}
        className={styles.sidebar}
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarDot} />
          <div className={styles.sidebarTitle}>
            <span className={styles.sidebarTitleMain}>Field Ops</span>
            <span className={styles.sidebarTitleSub}>Engineer Portal</span>
          </div>
        </div>
        <nav className={styles.nav}>
          <button onClick={() => setEngTab('inbox')} className={`${styles.navButton} ${engTab === 'inbox' ? styles.navButtonActive : styles.navButtonInactive}`}>
            <div className="flex items-center gap-4">{engTab === 'inbox' && <span className={styles.navButtonDot} />} Fault Inbox</div>
            {engTasks.filter((t) => t.status === 'pending').length > 0 && <span className={styles.navButtonBadge}>{engTasks.filter((t) => t.status === 'pending').length}</span>}
          </button>
          <button onClick={() => setEngTab('profile')} className={`${styles.navButton} ${engTab === 'profile' ? styles.navButtonActive : styles.navButtonInactive}`}>{engTab === 'profile' && <span className={styles.navButtonDot} />} My Profile</button>
          <button onClick={() => setEngTab('leave')} className={`${styles.navButton} ${engTab === 'leave' ? styles.navButtonActive : styles.navButtonInactive}`}>{engTab === 'leave' && <span className={styles.navButtonDot} />} Leave Application</button>
        </nav>
        <button onClick={onClockOut} className={styles.clockOutButton}><LogOut className={styles.clockOutIcon} /><span className={styles.clockOutText}>Clock Out</span></button>
      </motion.div>

      <div className={styles.mainContent}>
        <header className={styles.header}>
          <h2 className={styles.headerTitle}>Maintenance Directives</h2>
          <p className={styles.headerSubtitle}>State: <span className={styles.headerState}>{region}</span> | Status: <span className={styles.headerState}>On Duty</span></p>
        </header>

        {engTab === 'inbox' && (
          <div className={styles.inboxContainer}>
            {engTasks.map((task) => (
              <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${styles.taskCard} ${task.status === 'completed' ? styles.taskCardCompleted : ''}`}>
                <div className={styles.taskContent}>
                  <div className={styles.taskMeta}><span className={styles.taskStatus}>{task.status === 'completed' ? 'Resolved' : `${task.severity} Priority`}</span><span className={styles.taskTime}>{task.timestamp.toLocaleTimeString()}</span></div>
                  <h4 className={`${styles.taskDescription} ${task.status === 'completed' ? styles.taskDescriptionCompleted : task.severity === 'critical' ? styles.taskDescriptionCritical : ''}`}>{task.description}</h4>
                  <div className={styles.taskLocation}>{task.location}</div>
                </div>
                {task.status === 'pending' ? <button onClick={() => handleResolveTask(task.id)} className={styles.taskButton}>Mark Complete</button> : <div className={styles.taskDoneLabel}>Done</div>}
              </motion.div>
            ))}
          </div>
        )}

        {engTab === 'profile' && (
          <div className={styles.profileContainer}>
            <div className={styles.profileCard}>
              <div className={styles.profileHeader}>
                <div className={styles.profileInfo}>
                  <h2>{engineerName || 'Engineer'}</h2>
                  <p className={styles.profileEmail}>{badgeId}</p>
                  <span className={styles.profileRole}>Field Engineer</span>
                </div>
              </div>
              <div className={styles.profileGrid}>
                <div className={styles.profileGridItem}>
                  <div className={styles.profileDetail}>
                    <p className={styles.profileDetailLabel}>Department</p>
                    <p className={styles.profileDetailValue}>High Voltage Transmissions</p>
                  </div>
                  <div className={styles.profileDetail}>
                    <p className={styles.profileDetailLabel}>Base Region</p>
                    <p className={styles.profileDetailValue}>{region || 'Local'} Grid</p>
                  </div>
                </div>
                <div className={styles.profileGridItem}>
                  <div className={styles.profileStatBox}>
                    <span className={styles.profileStatLabel}>Faults Resolved</span>
                    <span className={styles.profileStatValue}>{engTasks.filter((t) => t.status === 'completed').length}</span>
                  </div>
                  <div className={styles.profileStatBox}>
                    <span className={styles.profileStatLabel}>Duty Hours (Mo)</span>
                    <span className={styles.profileStatValue}>164h</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {engTab === 'leave' && (
          <div className={styles.leaveGrid}>
            <div className={styles.leaveFormCard}>
              <h3 className={styles.leaveFormTitle}>New Leave Request</h3>
              <form onSubmit={handleLeaveSubmit} className={styles.leaveForm}>
                <div className={styles.leaveFormRow}>
                  <div className={styles.leaveFormGroup}>
                    <label className={styles.leaveFormLabel}>Start Date</label>
                    <input type="date" required value={leaveForm.start} onChange={(e) => setLeaveForm({ ...leaveForm, start: e.target.value })} className={styles.leaveFormInput} />
                  </div>
                  <div className={styles.leaveFormGroup}>
                    <label className={styles.leaveFormLabel}>End Date</label>
                    <input type="date" required value={leaveForm.end} onChange={(e) => setLeaveForm({ ...leaveForm, end: e.target.value })} className={styles.leaveFormInput} />
                  </div>
                </div>
                <div className={styles.leaveFormGroup}>
                  <label className={styles.leaveFormLabel}>Reason</label>
                  <textarea required rows={4} value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} className={styles.leaveFormTextarea}></textarea>
                </div>
                <button type="submit" className={styles.leaveFormButton}>Submit Request</button>
              </form>
            </div>
            <div className={styles.leaveHistoryCard}>
              <h3 className={styles.leaveHistoryTitle}>Leave History</h3>
              <div className={styles.leaveHistoryList}>
                {leaveRequestsLoading && <p className={styles.leaveHistoryLoading}>Loading leave history...</p>}
                {!leaveRequestsLoading && leaveRequests.length === 0 && <p className={styles.leaveHistoryEmpty}>No leave requests currently in system.</p>}
                {leaveRequests.map((leave) => (
                  <div key={leave.id} className={styles.leaveHistoryItem}>
                    <div className={styles.leaveHistoryItemHeader}>
                      <div className={styles.leaveHistoryItemDates}>{new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}</div>
                      <span className={styles.leaveHistoryItemStatus}>{leave.status}</span>
                    </div>
                    <p className={styles.leaveHistoryItemReason}>{leave.reason}</p>
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
