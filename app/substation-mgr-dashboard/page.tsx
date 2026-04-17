"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, cubicBezier } from 'framer-motion';
import { 
  LogOut, AlertCircle, CheckCircle2, Info, ArrowLeft, Activity, Zap, AlertOctagon
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { processLeaveTx, reportFaultTx, toUiError } from '@/lib/blockchain';
import { useWalletSync } from '@/lib/useWalletSync';

const SMOOTH_EASE = cubicBezier(0.22, 1, 0.36, 1);

const INDIA_BOUNDS = { minLat: 6.4, maxLat: 35.0, minLon: 68.1, maxLon: 97.4 };
const AUTO_CHAIN_FAULT_COOLDOWN_MS = 90_000;
const ENABLE_AUTO_CHAIN_FAULT_REPORTING = process.env.NEXT_PUBLIC_ENABLE_AUTO_CHAIN_FAULT_REPORTING === 'true';

// ─── Types ───────────────────────────────────────────────────────────────────
type ManagerTab = 'overview' | 'meters' | 'theft-detection' | 'leave-approvals';
type ViewState = 'login-manager' | 'manager-portal';

interface LeaveRequest { id: string; engineerName: string; engineerEmail: string; startDate: string; endDate: string; reason: string; status: 'pending' | 'approved' | 'rejected'; submittedAt: string; chainLeaveId?: number | null; }
interface Substation { id: string; name: string; lat: number; lon: number; location: string; currentLoadMW: number; maxCapacityMW: number; status: 'stable' | 'warning' | 'critical'; voltage: number; logs: any[]; }
interface SmartMeter { id: string; houseAddress: string; voltage: number; current: number; status: 'normal' | 'high' | 'low'; lineDrawKW: number; meterReadingKW: number; theftSuspected: boolean; lastUpdated: Date; }
interface StateData { id: number; name: string; color: string; path: string; load: number; centerX: number; centerY: number; minLat: number; maxLat: number; minLon: number; maxLon: number; }
interface AppAlert { id: string; message: string; type: 'critical' | 'success' | 'info'; }

// ─── LeafletMap ──────────────────────────────────────────────────────────────
const LeafletMap = React.memo(({ selectedState, substations, selectedSubstationId }: { selectedState: StateData | null; substations: Substation[]; selectedSubstationId: string | null; }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const isMapReady = useRef(false);

  useEffect(() => {
    if (!mapRef.current || !window.L || mapInstance.current) return;
    const map = window.L.map(mapRef.current, { zoomControl: false });
    map.fitBounds([[INDIA_BOUNDS.minLat, INDIA_BOUNDS.minLon], [INDIA_BOUNDS.maxLat, INDIA_BOUNDS.maxLon]]);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);
    markersLayer.current = window.L.layerGroup().addTo(map);
    mapInstance.current = map;
    isMapReady.current = true;
    renderMarkersRef.current?.();

    return () => {
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; markersLayer.current = null; isMapReady.current = false; }
    };
  }, []); 

  useEffect(() => {
    if (!mapInstance.current || !selectedState) return;
    mapInstance.current.fitBounds([
      [Math.max(selectedState.minLat, INDIA_BOUNDS.minLat), Math.max(selectedState.minLon, INDIA_BOUNDS.minLon)],
      [Math.min(selectedState.maxLat, INDIA_BOUNDS.maxLat), Math.min(selectedState.maxLon, INDIA_BOUNDS.maxLon)]
    ]);
  }, [selectedState]);

  const renderMarkersRef = useRef<(() => void) | null>(null);
  renderMarkersRef.current = () => {
    if (!mapInstance.current || !markersLayer.current || !window.L || !isMapReady.current) return;
    markersLayer.current.clearLayers();

    substations.forEach((sub) => {
      const isCritical = sub.status === 'warning' || sub.status === 'critical';
      const color = isCritical ? '#ef4444' : '#ffffff';
      const glowColor = isCritical ? 'rgba(239,68,68,0.5)' : '#5d5f5f';
      
      const isSelected = sub.id === selectedSubstationId;
      const size = isSelected ? 24 : 12;
      const opacity = isSelected ? 1 : 0.15; 
      const pointerEvents = isSelected ? 'auto' : 'none'; 

      const html = `<div style="background-color:${color};width:${size}px;height:${size}px;border-radius:50%;box-shadow:0 0 15px ${glowColor};opacity:${opacity};pointer-events:${pointerEvents};transition:all 0.4s cubic-bezier(0.22,1,0.36,1);"></div>`;
      const icon = window.L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });

      const marker = window.L.marker([sub.lat, sub.lon], { icon, interactive: isSelected });

      if (isSelected) {
        marker.bindTooltip(
          `<div class="font-sans text-[11px] tracking-widest uppercase">${sub.name}<br/><span class="text-neutral-400">${sub.currentLoadMW} MW</span></div>`,
          { direction: 'top', offset: [0, -10] }
        );
      }
      markersLayer.current.addLayer(marker);
    });

    if (selectedSubstationId) {
      const sub = substations.find((s) => s.id === selectedSubstationId);
      if (sub) { mapInstance.current.flyTo([sub.lat, sub.lon], Math.max(mapInstance.current.getZoom(), 8), { animate: true, duration: 1 }); }
    }
  };

  useEffect(() => { renderMarkersRef.current?.(); }, [substations, selectedSubstationId]);

  return <div ref={mapRef} className="w-full h-full z-0 bg-[#0e0e0e]" />;
});
LeafletMap.displayName = 'LeafletMap';

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ManagerDashboardPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>('login-manager');
  const [managerTab, setManagerTab] = useState<ManagerTab>('overview');
  
  const [stationLoginId, setStationLoginId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loginStateId, setLoginStateId] = useState('');
  
  const [isHydrated, setIsHydrated] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveRequestsLoading, setLeaveRequestsLoading] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<AppAlert[]>([]);
  const [selectedState, setSelectedState] = useState<StateData | null>(null);
  const [mapData, setMapData] = useState<StateData[] | null>(null);
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [selectedSubstationId, setSelectedSubstationId] = useState<string | null>(null);
  const [smartMeters, setSmartMeters] = useState<SmartMeter[]>([]);
  const [leafletReady, setLeafletReady] = useState(false);
  const [substationsLoading, setSubstationsLoading] = useState(false);
  const [subStationChanges, setSubstationChanges] = useState<Map<string, Partial<Substation>>>(new Map());
  const [leaveActionPendingId, setLeaveActionPendingId] = useState<string | null>(null);

  const faultTxInFlightRef = useRef(false);
  const lastFaultTxAtRef = useRef(0);
  const lastFaultSkipNoticeAtRef = useRef(0);

  const pushAlert = useCallback((message: string, type: 'critical' | 'success' | 'info') => {
    const id = Math.random().toString();
    setActiveAlerts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setActiveAlerts((prev) => prev.filter((a) => a.id !== id)), 6000);
  }, []);

  const {
    walletAddress,
    walletBusy,
    walletChainId,
    expectedChainId,
    walletOnExpectedChain,
    handleConnectWallet,
    handleClearWallet,
  } = useWalletSync(pushAlert);

  const attachChainFaultMarker = useCallback(async (description: string) => {
    if (!ENABLE_AUTO_CHAIN_FAULT_REPORTING) return description;
    if (!walletAddress) return description;
    if (managerTab === 'leave-approvals') return description;

    const now = Date.now();
    if (faultTxInFlightRef.current) return description;
    if (now - lastFaultTxAtRef.current < AUTO_CHAIN_FAULT_COOLDOWN_MS) return description;

    faultTxInFlightRef.current = true;
    try {
      const chain = await reportFaultTx(description);
      lastFaultTxAtRef.current = Date.now();
      if (chain.faultId === null) return description;
      return `${description} [chainFaultId:${chain.faultId}]`;
    } catch (error) {
      console.warn('On-chain fault report failed:', error);

      if (Date.now() - lastFaultSkipNoticeAtRef.current > 60_000) {
        pushAlert('Auto on-chain fault logging skipped temporarily. Manual approvals remain available.', 'info');
        lastFaultSkipNoticeAtRef.current = Date.now();
      }

      return description;
    } finally {
      faultTxInFlightRef.current = false;
    }
  }, [walletAddress, managerTab, pushAlert]);

  useEffect(() => {
    const savedStationId = localStorage.getItem('stationLoginId') || '';
    const savedStateId = localStorage.getItem('managerStateId') || '';
    const savedUUID = localStorage.getItem('selectedSubstationUUID') || '';
    if (savedStationId && savedStateId && savedUUID) {
      setStationLoginId(savedStationId); setLoginStateId(savedStateId); setSelectedSubstationId(savedUUID); setView('manager-portal');
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!mapData || mapData.length === 0 || !loginStateId) return;
    const state = mapData.find((s) => s.id.toString() === loginStateId);
    if (state && state.id !== selectedState?.id) { setSelectedState(state); }
  }, [mapData, loginStateId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.L) { setLeafletReady(true); return; }
    if (!document.getElementById('leaflet-css')) { const link = document.createElement('link'); link.id = 'leaflet-css'; link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link); }
    if (!document.getElementById('leaflet-js')) { const script = document.createElement('script'); script.id = 'leaflet-js'; script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; script.onload = () => setLeafletReady(true); document.body.appendChild(script); }
  }, []);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/geohacker/india/master/state/india_telengana.geojson')
      .then((r) => r.json())
      .then((data) => {
        const features: StateData[] = data.features.map((f: any, i: number) => {
          const name = (f.properties.NAME_1 || f.properties.st_nm || `State ${i}`).replace(' and ', ' & ');
          const load = Math.floor(Math.random() * 40 + 50);
          let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
          const process = (c: [number, number]) => { if (c[1] < minLat) minLat = c[1]; if (c[1] > maxLat) maxLat = c[1]; if (c[0] < minLon) minLon = c[0]; if (c[0] > maxLon) maxLon = c[0]; };
          if (f.geometry.type === 'Polygon') f.geometry.coordinates[0].forEach(process); else if (f.geometry.type === 'MultiPolygon') f.geometry.coordinates.forEach((poly: any) => poly[0].forEach(process));
          return { id: i, name, color: '', path: '', load, centerX: 0, centerY: 0, minLat, maxLat, minLon, maxLon };
        });
        features.sort((a, b) => a.name.localeCompare(b.name));
        setMapData(features);
      }).catch((err) => console.error('Map Data Error:', err));
  }, []);

  useEffect(() => {
    if (view !== 'manager-portal') return;
    const load = async () => {
      try {
        setLeaveRequestsLoading(true);
        const res = await fetch('/api/leave-requests', { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const payload = await res.json();
        const rows = Array.isArray(payload.data) ? payload.data : [];
        setLeaveRequests(
          rows.map((row: any) => ({
            id: String(row.id), engineerName: String(row.engineer_name ?? row.engineerName ?? 'Unknown'),
            engineerEmail: String(row.engineer_email ?? row.engineerEmail ?? ''), startDate: String(row.start_date ?? row.startDate),
            endDate: String(row.end_date ?? row.endDate), reason: String(row.reason), status: String(row.status).toLowerCase() as LeaveRequest['status'],
            submittedAt: String(row.submitted_at ?? row.submittedAt),
            chainLeaveId: row.chainLeaveId !== undefined && row.chainLeaveId !== null ? Number(row.chainLeaveId) : null,
          }))
        );
      } catch {
        pushAlert('Unable to load leave requests.', 'info');
      } finally { setLeaveRequestsLoading(false); }
    };
    load();
  }, [view, pushAlert]);

  useEffect(() => {
    if (view !== 'manager-portal' || !selectedState) return;
    const load = async () => {
      try {
        setSubstationsLoading(true);
        const res = await fetch(`/api/substations?state=${encodeURIComponent(selectedState.name)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const payload = await res.json();
        const subs: Substation[] = Array.isArray(payload.data) ? payload.data : [];
        const mappedSubs = subs.map((sub: any) => ({
          ...sub, logs: [{ id: `init-${sub.id}`, timestamp: new Date(sub.createdAt || Date.now()), message: 'Telemetry Sync Established', type: 'info' as const }]
        }));
        setSubstations(mappedSubs);

        const savedUUID = localStorage.getItem('selectedSubstationUUID');
        const matchedSub = mappedSubs.find(s => s.id === savedUUID);
        
        if (matchedSub) { setSelectedSubstationId(matchedSub.id); }
      } catch (err) { pushAlert('Unable to fetch live substations.', 'info'); } 
      finally { setSubstationsLoading(false); }
    };
    load();
  }, [view, selectedState, pushAlert]);

  useEffect(() => {
    if (view !== 'manager-portal') return;
    const meters: SmartMeter[] = Array.from({ length: 15 }).map((_, i) => {
      const v = 210 + Math.floor(Math.random() * 50); 
      const c = 5 + Math.floor(Math.random() * 15); 
      const reading = (v * c) / 1000;
      return { 
        id: `MTR-88${i}${Math.floor(Math.random() * 90 + 10)}`, 
        houseAddress: `Block ${String.fromCharCode(65 + (i % 5))}, Plot ${i * 12 + 4}`, 
        voltage: v, 
        current: c, 
        status: v > 245 ? 'high' : v < 215 ? 'low' : 'normal',
        lineDrawKW: reading,
        meterReadingKW: reading,
        theftSuspected: false,
        lastUpdated: new Date() 
      };
    });
    setSmartMeters(meters);
  }, [view]);

  // ─── DEMO MODE: 10-SECOND DELAY + THEFT DETECTION ────────────────────────────
  useEffect(() => {
    if (view !== 'manager-portal' || !selectedState) return;
    
    // Set to 10000ms (10 seconds) specifically for the demo
    const telemetryInterval = setInterval(() => {
      // 1. Audit Smart Meters (V * I Formula + Theft Logic)
      setSmartMeters(prev => prev.map(meter => {
        // Keep theft detections visible for a short period, but allow them to clear.
        const keepPriorTheft = meter.theftSuspected && Math.random() > 0.35;
        const theftTriggered = keepPriorTheft || (Math.random() > 0.96);
        const newVoltage = Math.max(190, Math.min(270, meter.voltage + (Math.random() - 0.5) * 6));
        const newCurrent = Math.max(2, Math.min(30, meter.current + (Math.random() - 0.5) * 2));
        const newStatus: SmartMeter['status'] = newVoltage > 245 ? 'high' : newVoltage < 215 ? 'low' : 'normal';
        
        const reading = (newVoltage * newCurrent) / 1000;
        const lineLossKw = theftTriggered
          ? (2 + Math.random() * 2)
          : (0.05 + Math.random() * 0.25);
        const line = reading + lineLossKw;
        const suspected = theftTriggered;

        if (suspected && !meter.theftSuspected) {
          const msg = `THEFT DETECTED: Bypass at ${meter.houseAddress} (${(line - reading).toFixed(2)}kW)`;
          pushAlert(msg, 'critical');

          void (async () => {
            const description = await attachChainFaultMarker(msg);
            fetch('/api/tasks/auto-assign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: meter.houseAddress,
                description,
                severity: 'critical',
                state: selectedState.name
              })
            }).then(r => r.json()).then(data => {
              if(data.success) {
                pushAlert(`Automated Dispatch: Eng. ${data.assignedTo} routed.`, 'success');
              } else {
                pushAlert(`Dispatch Failed: ${data.error}`, 'info'); 
              }
            }).catch(e => console.error('Dispatch failed', e));
          })();
        }

        if (newStatus === 'high' && meter.status !== 'high') {
          const faultMsg = `METER FAULT: Severe Overvoltage (${newVoltage.toFixed(1)}V) detected at ${meter.houseAddress}.`;
          pushAlert(faultMsg, 'info'); // Alert the manager UI

          void (async () => {
            const baseDescription = `${faultMsg} Potential hardware failure or local transformer issue. Requires physical inspection.`;
            const description = await attachChainFaultMarker(baseDescription);

            fetch('/api/tasks/auto-assign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: meter.houseAddress,
                description,
                severity: 'MEDIUM', // Meter faults are MEDIUM severity
                state: selectedState.name
              })
            }).then(r => r.json()).then(data => {
              if(data.success) {
                pushAlert(`Maintenance Dispatch: Eng. ${data.assignedTo} routed to check overvoltage.`, 'success');
              }
            }).catch(e => console.error('Dispatch failed', e));
          })();
        }


        
        return { ...meter, voltage: newVoltage, current: newCurrent, status: newStatus, lineDrawKW: line, meterReadingKW: reading, theftSuspected: suspected, lastUpdated: new Date() };
      }));

      // 2. Local Substation Refresh & Auto Dispatch
      if (substations.length > 0) {
        let newlyTriggeredAlerts: AppAlert[] = [];
        setSubstations(prev => prev.map(sub => {
          if (sub.id !== selectedSubstationId) return sub;

          const loadFluctuation = Math.floor((Math.random() - 0.5) * 8);
          let newLoad = Math.max(10, Math.min(sub.maxCapacityMW + 10, sub.currentLoadMW + loadFluctuation));
          const loadPercentage = (newLoad / sub.maxCapacityMW) * 100;
          let newStatus: 'stable' | 'warning' | 'critical' = sub.status;
          let newLogs = [...sub.logs];
          
          if (loadPercentage >= 85 && sub.status === 'stable') {
              newStatus = 'critical';
              const errorMsg = `CRITICAL: Load exceeded safe threshold (${loadPercentage.toFixed(1)}%)`;
              newLogs.unshift({ id: Math.random().toString(), timestamp: new Date(), message: errorMsg, type: 'critical' });
              newlyTriggeredAlerts.push({ id: Math.random().toString(), message: `CRITICAL ALERT: Node Overloaded!`, type: 'critical' });

              void (async () => {
                const baseDescription = `Transformer Overload Warning: ${errorMsg}`;
                const description = await attachChainFaultMarker(baseDescription);

                fetch('/api/tasks/auto-assign', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    location: sub.name,
                    description,
                    severity: 'critical',
                    state: selectedState.name
                  })
                }).then(r => r.json()).then(data => {
                  if(data.success) {
                    pushAlert(`Automated Dispatch: Eng. ${data.assignedTo} routed to ${sub.name}`, 'success');
                  } else {
                    pushAlert(`Dispatch Failed: ${data.error}`, 'info'); 
                  }
                }).catch(e => console.error('Dispatch failed', e));
              })();

          } else if (loadPercentage < 80 && (sub.status === 'warning' || sub.status === 'critical')) {
              newStatus = 'stable';
              newLogs.unshift({ id: Math.random().toString(), timestamp: new Date(), message: 'Load returned to nominal levels', type: 'info' });
          }
          if (newLogs.length > 15) newLogs = newLogs.slice(0, 15);
          return { ...sub, currentLoadMW: newLoad, status: newStatus, logs: newLogs };
        }));

        if (newlyTriggeredAlerts.length > 0) {
            setActiveAlerts(prev => [...prev, ...newlyTriggeredAlerts]);
            setTimeout(() => { setActiveAlerts(prev => prev.filter(a => !newlyTriggeredAlerts.find(n => n.id === a.id))); }, 6000);
        }
      }
    }, 10000); // Trigger set to exactly 10 seconds
    return () => clearInterval(telemetryInterval);
  }, [view, smartMeters.length, selectedState, substations.length, selectedSubstationId, pushAlert, attachChainFaultMarker]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!stationLoginId || !passcode || !loginStateId) return;
    
    try {
      const loginPayload = {
        station_id: stationLoginId.trim().toUpperCase(),
        passcode: passcode.trim(),
      };

      const loginAttempts = 3;
      let res: Response | null = null;
      let loginErrorMessage = '';

      for (let attempt = 1; attempt <= loginAttempts; attempt += 1) {
        res = await fetch('/api/substations/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginPayload)
        });

        if (res.ok) {
          break;
        }

        const err = await res.json().catch(() => null) as { error?: unknown; details?: unknown; retryable?: unknown } | null;
        const parts = err
          ? [err.error, err.details].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          : [];
        loginErrorMessage = parts.join(' ');

        const retryableFlag = typeof err?.retryable === 'boolean' ? err.retryable : null;
        const retryable = retryableFlag ?? (res.status === 503 || res.status >= 500);

        if (!retryable || attempt === loginAttempts) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** (attempt - 1)));
      }

      if (!res || !res.ok) {
        pushAlert(loginErrorMessage || `Invalid credentials. Check Station ID and Passcode${res ? ` (HTTP ${res.status})` : ''}.`, 'critical');
        return;
      }

      const { data } = await res.json();

      const trimmedId = loginPayload.station_id;
      localStorage.setItem('stationLoginId', trimmedId);
      localStorage.setItem('managerStateId', loginStateId);
      localStorage.setItem('selectedSubstationUUID', data.id); 
      
      setStationLoginId(trimmedId); 
      setSelectedSubstationId(data.id);
      setView('manager-portal');
      pushAlert('Substation Terminal Linked Successfully.', 'success');
    } catch (err) {
      console.error(err);
      pushAlert('Connection to server failed. Please retry.', 'critical');
    }
  };

  const handleAbortProtocol = () => {
    localStorage.removeItem('stationLoginId');
    localStorage.removeItem('managerStateId');
    localStorage.removeItem('selectedSubstationUUID');
    router.push('/');
  };

  const handleClockOut = async () => {
    if (subStationChanges.size > 0) await syncChangesToDatabase();
    localStorage.removeItem('stationLoginId');
    localStorage.removeItem('managerStateId');
    localStorage.removeItem('selectedSubstationUUID');
    setStationLoginId(''); setPasscode(''); setLoginStateId(''); setSelectedSubstationId(null);
    setView('login-manager');
    pushAlert('Session terminated cleanly.', 'info');
  };

  const updateSubstationCapacity = (id: string, newCapacity: number) => {
    setSubstations(prev => prev.map(sub => {
        if (sub.id === id) {
            const newLogs = [{ id: Math.random().toString(), timestamp: new Date(), message: `CONFIG: Max Capacity adjusted to ${newCapacity} MW`, type: 'info' as const }, ...sub.logs].slice(0, 15);
            setSubstationChanges(prevMap => {
              const updated = new Map(prevMap);
              updated.set(id, { ...(updated.get(id) || {}), maxCapacityMW: newCapacity });
              return updated;
            });
            return { ...sub, maxCapacityMW: newCapacity, logs: newLogs };
        }
        return sub;
    }));
  };

  const syncChangesToDatabase = async () => {
    if (subStationChanges.size === 0) return;
    try {
      const syncPromises: Promise<any>[] = [];
      subStationChanges.forEach((changes, substationId) => {
        syncPromises.push(
          fetch('/api/substations', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: substationId, maxCapacityMw: changes.maxCapacityMW }),
          })
        );
      });
      await Promise.all(syncPromises);
      setSubstationChanges(new Map());
    } catch (err) {
      console.error("Sync error:", err);
    }
  };

  const handleLeaveAction = async (leaveId: string, action: 'approved' | 'rejected') => {
    if (leaveActionPendingId === leaveId) {
      return;
    }

    setLeaveActionPendingId(leaveId);

    try {
      const target = leaveRequests.find((request) => request.id === leaveId);
      if (!target) {
        throw new Error('Leave request not found.');
      }

      if (target.chainLeaveId !== null && target.chainLeaveId !== undefined) {
        if (!walletAddress) {
          pushAlert('Connect wallet before processing leave on-chain.', 'info');
          return;
        }
        await processLeaveTx(target.chainLeaveId, action === 'approved');
      }

      const res = await fetch('/api/leave-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leaveId, status: action, reviewedById: stationLoginId })
      });
      if (!res.ok) throw new Error();
      setLeaveRequests((prev) => prev.map((r) => r.id === leaveId ? { ...r, status: action } : r));
      pushAlert(`Leave request ${action === 'approved' ? 'approved' : 'denied'}.`, action === 'approved' ? 'success' : 'info');
    } catch (error) {
      pushAlert(toUiError(error), 'critical');
    } finally {
      setLeaveActionPendingId((current) => (current === leaveId ? null : current));
    }
  };

  if (!isHydrated) return null;
  const selectedSubstation = substations.find((s) => s.id === selectedSubstationId) ?? null;
  const suspiciousMeters = smartMeters
    .filter((meter) => meter.theftSuspected)
    .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());

  return (
    <div className="min-h-screen bg-[#131313] text-neutral-200 overflow-hidden font-sans selection:bg-white/20">

      {/* Toast Alerts */}
      <div className="fixed top-8 right-8 z-[100] flex flex-col gap-4 pointer-events-none">
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
                    {isCritical ? 'System Alert' : isSuccess ? 'Success' : 'Info'}
                  </h4>
                  <p className="text-sm text-neutral-400 leading-relaxed">{alert.message}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">

        {/* ── LOGIN ─────────────────────────────────────────────────────────── */}
        {view === 'login-manager' && (
          <motion.div
            key="login"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, filter: 'blur(4px)' }}
            transition={{ duration: 0.6, ease: SMOOTH_EASE }}
            className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#131313] relative"
          >
            <button
              onClick={handleAbortProtocol}
              className="absolute top-10 left-10 flex items-center gap-4 text-neutral-500 hover:text-white transition-colors font-medium tracking-widest uppercase text-[11px]"
            >
              <ArrowLeft className="w-4 h-4" /> Abort Protocol
            </button>

            <div className="w-full max-w-md">
              <div className="mb-16">
                <h1 className="text-5xl font-bold text-white mb-2 tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Substation Terminal
                </h1>
                <p className="text-neutral-400 font-medium text-sm tracking-wider">Local Node Telemetry Access</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6 bg-[#1c1b1b] p-8 rounded-sm shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">Operating Region</label>
                  <select
                    required
                    value={loginStateId}
                    onChange={(e) => setLoginStateId(e.target.value)}
                    className="w-full bg-[#353534] focus:bg-[#393939] focus:outline-none transition-all py-3 px-4 text-white text-sm appearance-none cursor-pointer rounded-sm"
                  >
                    <option value="">Select a region...</option>
                    {mapData?.map((state) => (
                      <option key={state.id} value={state.id.toString()}>{state.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">Station Login ID</label>
                  <input type="text" required placeholder="SUB-DL-01" value={stationLoginId} onChange={(e) => setStationLoginId(e.target.value)}
                    className="w-full bg-[#353534] focus:bg-[#393939] focus:outline-none transition-all py-3 px-4 text-white placeholder:text-neutral-600 rounded-sm text-sm font-mono" />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">Secure Passcode</label>
                  <input type="password" required placeholder="••••••••" value={passcode} onChange={(e) => setPasscode(e.target.value)}
                    className="w-full bg-[#353534] focus:bg-[#393939] focus:outline-none transition-all py-3 px-4 text-white placeholder:text-neutral-600 rounded-sm text-sm" />
                </div>

                <button type="submit" className="w-full bg-white hover:bg-neutral-100 text-[#1a1c1c] font-bold py-3 px-4 rounded-sm transition-all tracking-tight uppercase text-sm mt-8">
                  Access Terminal
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {/* ── MANAGER PORTAL ────────────────────────────────────────────────── */}
        {view === 'manager-portal' && (
          <motion.div
            key="manager-portal-view"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
            className="min-h-screen bg-[#131313] flex"
          >
            {/* Sidebar */}
            <motion.div
              initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1, ease: SMOOTH_EASE }}
              className="w-20 lg:w-72 bg-[#1c1b1b] flex flex-col p-8 shrink-0 z-20"
            >
              <div className="flex items-center gap-6 mb-16">
                <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_12px_#ffffff] shrink-0" />
                <div className="hidden lg:block">
                  <span className="font-bold text-xl tracking-tighter text-white block" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Substation Mgr</span>
                  <span className="text-[11px] text-neutral-500 font-medium tracking-widest uppercase mt-1 block">Local Control</span>
                </div>
              </div>

              <nav className="flex-1 space-y-4">
                {(['overview', 'meters', 'theft-detection', 'leave-approvals'] as ManagerTab[]).map((tab) => {
                  const labels: Record<ManagerTab, string> = { overview: 'Overview', meters: 'Meter Telemetry', 'theft-detection': 'Theft Detection', 'leave-approvals': 'Personnel' };
                  const pendingCount = tab === 'leave-approvals' ? leaveRequests.filter((l) => l.status === 'pending').length : tab === 'theft-detection' ? suspiciousMeters.length : 0;
                  
                  return (
                    <button key={tab} onClick={() => setManagerTab(tab)}
                      className={`flex items-center justify-between font-bold text-sm tracking-tight uppercase w-full ${managerTab === tab ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-[22px]'}`}
                    >
                      <div className="flex items-center gap-4">
                        {managerTab === tab && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0 shadow-[0_0_8px_#ffffff]" />}
                        <span className="hidden lg:block">{labels[tab]}</span>
                      </div>
                      {pendingCount > 0 && (
                        <span className={`text-[10px] bg-white text-[#1a1c1c] px-2 py-0.5 rounded-sm font-bold`}>{pendingCount}</span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <button onClick={handleClockOut} className="mt-auto flex items-center gap-4 text-neutral-500 hover:text-white transition-all w-full group">
                <LogOut className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
                <span className="hidden lg:block font-bold uppercase tracking-tight text-sm">Clock Out</span>
              </button>
            </motion.div>

            {/* Main Content */}
            <div className="flex-1 p-4 lg:p-12 overflow-y-auto">
              <header className="mb-12 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#474747]/15">
                <div>
                  <h2 className="text-4xl font-bold text-white tracking-tighter" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Node Administration</h2>
                  <p className="text-neutral-400 text-sm mt-2">Managing Substation Telemetry</p>
                </div>
                <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
                  <button onClick={walletAddress ? handleClearWallet : handleConnectWallet} disabled={walletBusy} className="bg-[#2a2a2a] hover:bg-[#353534] disabled:opacity-60 text-white px-4 py-2 rounded-sm text-[11px] font-bold uppercase tracking-tight transition-colors">
                    {walletBusy ? 'Connecting...' : walletAddress ? `Wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Connect Wallet'}
                  </button>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_#ffffff]" />
                      <span className="text-[11px] font-medium tracking-widest uppercase text-neutral-400">System Active</span>
                    </div>
                    {walletAddress && expectedChainId !== null && (
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${walletOnExpectedChain ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
                        <span className="text-[11px] font-medium tracking-widest uppercase text-neutral-400">
                          {walletOnExpectedChain ? `Chain ${walletChainId ?? expectedChainId}` : `Wrong Chain (${walletChainId ?? 'unknown'})`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </header>

              {/* ── OVERVIEW TAB ──────────────────────────────────────────── */}
              {managerTab === 'overview' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    <div className="bg-[#1c1b1b] rounded-sm p-8">
                      <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-widest mb-4">Assigned Node Health</p>
                      <div className="text-5xl font-bold tracking-tighter text-white mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        {selectedSubstation?.currentLoadMW || 0}
                        <span className="text-xl text-neutral-500 tracking-normal"> MW</span>
                      </div>
                    </div>
                    <div className="bg-[#1c1b1b] rounded-sm p-8">
                      <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-widest mb-4">Connected Smart Meters</p>
                      <div className="text-5xl font-bold tracking-tighter text-white mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        {substationsLoading ? <Activity className="w-8 h-8 animate-spin inline" /> : smartMeters.length}
                        <span className="text-xl text-neutral-500 tracking-normal"> Units</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[600px] grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* Map */}
                    <div className="xl:col-span-2 bg-[#0e0e0e] rounded-sm flex flex-col relative overflow-hidden min-h-[500px] p-1 border border-[#474747]/15">
                      <div className="absolute top-6 left-6 z-20 pointer-events-none">
                        <h3 className="text-[11px] font-medium tracking-widest uppercase text-neutral-400">
                          Tactical GIS Mapping
                        </h3>
                      </div>
                      {leafletReady && selectedState ? (
                        <LeafletMap
                          selectedState={selectedState}
                          substations={substations}
                          selectedSubstationId={selectedSubstationId}
                          // onSelectSubstation={() => {}} // Disabled navigation for other nodes
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-500">
                          <Activity className="w-6 h-6 animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* Substation Details Panel */}
                    <div className="xl:col-span-1 flex flex-col h-full bg-[#1c1b1b] rounded-sm overflow-hidden relative">
                      <AnimatePresence mode="wait">
                        {selectedSubstation ? (
                          <motion.div key={selectedSubstation.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col p-8 overflow-y-auto">
                            <div className="flex items-start justify-between mb-8 shrink-0">
                              <div>
                                <div className="text-[11px] text-neutral-500 tracking-widest uppercase mb-2">Assigned Node</div>
                                <h3 className={`text-2xl font-bold tracking-tighter mb-1 ${selectedSubstation.status === 'critical' ? 'text-red-500' : 'text-white'}`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                                  {selectedSubstation.name}
                                </h3>
                                <p className="text-neutral-500 text-xs font-mono uppercase">{stationLoginId}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="px-3 py-1 bg-[#0e0e0e] rounded-sm text-[10px] text-neutral-500 font-medium tracking-[0.1em] uppercase border border-[#474747]/15">
                                  LOCKED TO LOCAL NODE
                                </div>
                              </div>
                            </div>

                            <div className="bg-[#0e0e0e] p-6 rounded-sm shrink-0 mb-6">
                              <div className="flex justify-between text-[11px] mb-4 font-medium text-neutral-400 uppercase tracking-widest">
                                <span>Output Load</span>
                                <span className={selectedSubstation.status === 'critical' ? 'text-red-500' : 'text-white'}>
                                  {selectedSubstation.currentLoadMW} MW
                                </span>
                              </div>
                              <div className="h-1 bg-[#1c1b1b] rounded-sm overflow-hidden relative">
                                <div className="absolute top-0 bottom-0 left-[85%] w-px bg-[#474747] z-10" />
                                <motion.div
                                  animate={{ width: `${Math.min((selectedSubstation.currentLoadMW / selectedSubstation.maxCapacityMW) * 100, 100)}%` }}
                                  className={`h-full ${selectedSubstation.status === 'critical' ? 'bg-red-500' : 'bg-white'}`}
                                />
                              </div>
                            </div>

                            <div className="bg-[#0e0e0e] p-6 rounded-sm shrink-0 mb-6 flex justify-between items-center">
                              <div>
                                <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-widest mb-1">Max Capacity</h4>
                                <span className="text-white font-mono text-sm">{selectedSubstation.maxCapacityMW} MW</span>
                              </div>
                              <div className="text-right">
                                <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-widest mb-1">Voltage Phase</h4>
                                <span className="text-white font-mono text-sm">{selectedSubstation.voltage} kV</span>
                              </div>
                            </div>
                            
                            <div className="bg-[#0e0e0e] p-6 rounded-sm flex-1 flex flex-col min-h-[200px]">
                                <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-widest mb-4">Terminal Logs</h4>
                                <div className="space-y-4 overflow-y-auto pr-2 flex-1">
                                    {selectedSubstation.logs.map((log:any) => (
                                        <div key={log.id} className="flex flex-col"><p className={`text-sm leading-relaxed mb-1 ${log.type === 'critical' ? 'text-red-400 font-medium' : log.type === 'success' ? 'text-white' : 'text-neutral-400'}`}>{log.message}</p><span className="text-neutral-600 font-mono text-[10px]">{log.timestamp.toLocaleTimeString()}</span></div>
                                    ))}
                                </div>
                            </div>
                          </motion.div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-500 p-8">
                            {substationsLoading
                              ? <Activity className="w-6 h-6 animate-spin" />
                              : <p className="text-[11px] uppercase tracking-widest font-medium">No node assigned</p>
                            }
                          </div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </>
              )}

              {/* ── METERS TAB ────────────────────────────────────────────── */}
              {managerTab === 'meters' && (
                <div className="bg-[#1c1b1b] rounded-sm p-8">
                  <h3 className="text-2xl font-bold tracking-tighter text-white mb-8" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Residential Smart Meters</h3>
                  <div className="bg-[#0e0e0e] rounded-sm overflow-x-auto p-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-neutral-500 text-[11px] font-medium uppercase tracking-widest">
                          <th className="p-4 font-normal">Meter ID</th>
                          <th className="p-4 font-normal">Address</th>
                          <th className="p-4 font-normal text-right">Voltage (V)</th>
                          <th className="p-4 font-normal text-right">Current (A)</th>
                          <th className="p-4 font-normal text-right">Load (kW)</th>
                          <th className="p-4 font-normal text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {smartMeters.map((meter, index) => {
                          const calculatedLoad = ((meter.voltage * meter.current) / 1000).toFixed(2);
                          return (
                            <tr key={meter.id} className={index % 2 === 0 ? 'bg-[#0e0e0e]' : 'bg-[#131313]'}>
                              <td className="p-4 font-mono text-neutral-300">{meter.id}</td>
                              <td className="p-4 text-neutral-400">{meter.houseAddress}</td>
                              <td className="p-4 text-right">
                                <span className={`font-mono font-bold ${meter.status === 'high' ? 'text-red-400' : meter.status === 'low' ? 'text-neutral-500' : 'text-white'}`}>
                                  {meter.voltage.toFixed(1)}
                                </span>
                              </td>
                              <td className="p-4 text-right font-mono text-neutral-300">{meter.current.toFixed(1)}</td>
                              <td className="p-4 text-right font-mono font-bold text-sky-400">{calculatedLoad}</td>
                              <td className="p-4 text-center">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${
                                  meter.status === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                  meter.status === 'low' ? 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20' : 
                                  'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                }`}>
                                  {meter.status === 'high' ? 'Overvolt' : meter.status === 'low' ? 'Undervolt' : 'Nominal'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── THEFT DETECTION TAB ───────────────────────────────────── */}
              {managerTab === 'theft-detection' && (
                <div className="bg-[#1c1b1b] rounded-sm p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <AlertOctagon className="text-red-500 w-8 h-8" />
                    <h3 className="text-2xl font-bold tracking-tighter text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Active Bypass Audit</h3>
                  </div>
                  <div className="bg-[#0e0e0e] rounded-sm overflow-x-auto p-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-neutral-500 text-[11px] font-medium uppercase tracking-widest">
                          <th className="p-4 font-normal">Meter ID</th>
                          <th className="p-4 font-normal">Address</th>
                          <th className="p-4 font-normal text-right">Meter Reading (kW)</th>
                          <th className="p-4 font-normal text-right">Actual Draw (kW)</th>
                          <th className="p-4 font-normal text-right">Discrepancy</th>
                          <th className="p-4 font-normal text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm font-mono">
                        {suspiciousMeters.length === 0 ? (
                          <tr><td colSpan={6} className="p-8 text-center text-neutral-500 font-sans">No bypass anomalies currently detected in this cycle.</td></tr>
                        ) : suspiciousMeters.map((meter, index) => {
                          const discrepancy = (meter.lineDrawKW - meter.meterReadingKW).toFixed(2);
                          return (
                            <tr key={meter.id} className={index % 2 === 0 ? 'bg-[#0e0e0e]' : 'bg-[#131313]'}>
                              <td className="p-4 text-neutral-300">{meter.id}</td>
                              <td className="p-4 text-neutral-400 font-sans">{meter.houseAddress}</td>
                              <td className="p-4 text-right text-neutral-300">{meter.meterReadingKW.toFixed(2)}</td>
                              <td className="p-4 text-right text-white">{meter.lineDrawKW.toFixed(2)}</td>
                              <td className="p-4 text-right text-red-500 font-bold">+{discrepancy} kW</td>
                              <td className="p-4 text-center">
                                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded border border-red-500/30 text-red-500">
                                  AUTO-DISPATCHED
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── LEAVE APPROVALS TAB ───────────────────────────────────── */}
              {managerTab === 'leave-approvals' && (
                <div className="bg-[#1c1b1b] rounded-sm p-8">
                  <h3 className="text-2xl font-bold tracking-tighter text-white mb-8" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Pending Leave Approvals</h3>
                  {leaveRequestsLoading ? (
                    <div className="flex justify-center py-12"><Activity className="w-6 h-6 animate-spin text-neutral-500" /></div>
                  ) : leaveRequests.length === 0 ? (
                    <p className="text-neutral-500 text-sm">No leave requests currently in system.</p>
                  ) : (
                    <div className="space-y-6">
                      {leaveRequests.map((req) => (
                        <div key={req.id} className="bg-[#0e0e0e] p-8 rounded-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                          <div>
                            <div className="flex items-center gap-4 mb-3">
                              <h4 className="text-white font-bold text-lg">{req.engineerName}</h4>
                              <span className={`text-[11px] font-bold uppercase tracking-widest ${req.status === 'approved' ? 'text-green-400' : req.status === 'rejected' ? 'text-red-400' : 'text-neutral-500'}`}>{req.status}</span>
                            </div>
                            <p className="text-neutral-400 text-sm mb-2">
                              {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}
                            </p>
                            <p className="text-neutral-500 text-sm italic">"{req.reason}"</p>
                          </div>
                          {req.status === 'pending' && (
                            <div className="flex gap-4 shrink-0">
                              <button
                                onClick={() => handleLeaveAction(req.id, 'approved')}
                                disabled={leaveActionPendingId === req.id}
                                className="text-[#1a1c1c] bg-white hover:bg-neutral-200 disabled:opacity-60 disabled:cursor-not-allowed px-6 py-3 rounded-sm font-bold uppercase tracking-tight text-xs transition-colors"
                              >
                                {leaveActionPendingId === req.id ? 'Approving...' : 'Approve'}
                              </button>
                              <button
                                onClick={() => handleLeaveAction(req.id, 'rejected')}
                                disabled={leaveActionPendingId === req.id}
                                className="text-white bg-[#2a2a2a] hover:bg-[#353534] disabled:opacity-60 disabled:cursor-not-allowed px-6 py-3 rounded-sm font-bold uppercase tracking-tight text-xs transition-colors"
                              >
                                {leaveActionPendingId === req.id ? 'Processing...' : 'Deny'}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}