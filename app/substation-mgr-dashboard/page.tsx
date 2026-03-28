"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, cubicBezier } from 'framer-motion';
import { LogOut, AlertCircle, CheckCircle2, Info, ArrowLeft, Activity, Zap, Globe, Radio, Server, ChevronLeft, ChevronRight, SlidersHorizontal, CalendarDays, UserPlus, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

const SMOOTH_EASE = cubicBezier(0.22, 1, 0.36, 1);

// Leaflet Map Component
const LeafletMap = ({ selectedState, substations, selectedSubstationId, onSelectSubstation }: any) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    if (!mapInstance.current) {
      const map = window.L.map(mapRef.current, { zoomControl: false }).fitBounds([
        [selectedState.minLat, selectedState.minLon],
        [selectedState.maxLat, selectedState.maxLon]
      ]);
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);

      markersLayer.current = window.L.layerGroup().addTo(map);
      mapInstance.current = map;
      setMapReady(true);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markersLayer.current = null;
        setMapReady(false);
      }
    };
  }, [selectedState]);

  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current || !window.L || !mapReady) return;

    markersLayer.current.clearLayers();

    substations.forEach((sub: Substation) => {
      const isCritical = sub.status === 'warning' || sub.status === 'critical';
      const color = isCritical ? '#ef4444' : '#ffffff';
      const glowColor = isCritical ? 'rgba(239,68,68,0.5)' : '#5d5f5f';
      const isSelected = sub.id === selectedSubstationId;
      const size = isSelected ? 24 : 12;

      const html = `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; box-shadow: 0 0 15px ${glowColor}; opacity: ${isSelected ? 1 : 0.6}; transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1); cursor: pointer;"></div>`;
      const icon = window.L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });

      const marker = window.L.marker([sub.lat, sub.lon], { icon });
      marker.on('click', () => onSelectSubstation(sub.id));
      marker.bindTooltip(`<div class="font-sans text-[11px] tracking-widest uppercase">${sub.name} <br/> <span class="text-neutral-400">${sub.currentLoadMW} MW</span></div>`, { direction: 'top', offset: [0, -10] });

      markersLayer.current.addLayer(marker);
    });

    if (selectedSubstationId) {
      const sub = substations.find((s: Substation) => s.id === selectedSubstationId);
      if (sub) mapInstance.current.flyTo([sub.lat, sub.lon], Math.max(mapInstance.current.getZoom(), 8), { animate: true, duration: 1 });
    }
  }, [substations, selectedSubstationId, onSelectSubstation, mapReady]);

  return <div ref={mapRef} className="w-full h-full z-0 bg-[#0e0e0e]" />;
};


type ManagerTab = 'overview' | 'meters' | 'leave-approvals';
type ViewState = 'login-manager' | 'manager-portal';

interface LeaveRequest {
  id: string;
  engineerName: string;
  engineerEmail: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

interface Substation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  location: string;
  currentLoadMW: number;
  maxCapacityMW: number;
  status: 'stable' | 'warning' | 'critical';
  voltage: number;
}

interface SmartMeter {
  id: string;
  houseAddress: string;
  voltage: number;
  status: 'normal' | 'high' | 'low';
  lastUpdated: Date;
}

interface StateData {
  id: number;
  name: string;
  color: string;
  path: string;
  load: number;
  centerX: number;
  centerY: number;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

interface AppAlert {
  id: string;
  message: string;
  type: 'critical' | 'success' | 'info';
}

export default function ManagerDashboardPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>('login-manager');
  const [managerTab, setManagerTab] = useState<ManagerTab>('overview');
  const [managerId, setManagerId] = useState('');
  const [region, setRegion] = useState('');
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

  // Restore credentials from localStorage on mount
  useEffect(() => {
    const savedManagerId = localStorage.getItem('managerId') || '';
    const savedRegion = localStorage.getItem('managerRegion') || '';
    const savedStateId = localStorage.getItem('managerStateId') || '';

    if (savedManagerId && savedRegion && savedStateId) {
      setManagerId(savedManagerId);
      setRegion(savedRegion);
      setLoginStateId(savedStateId);
      setView('manager-portal');
    }

    setIsHydrated(true);
  }, []);

  // Update selected state when mapData loads and we have a saved state ID
  useEffect(() => {
    if (mapData && loginStateId && !selectedState) {
      const state = mapData.find(s => s.id.toString() === loginStateId);
      if (state) {
        setSelectedState(state);
      }
    }
  }, [mapData, loginStateId, selectedState]);

  // Load leave requests when entering manager portal
  useEffect(() => {
    if (view === 'manager-portal') {
      const loadLeaves = async () => {
        try {
          setLeaveRequestsLoading(true);
          const response = await fetch('/api/leave-requests', {
            cache: 'no-store'
          });

          if (!response.ok) throw new Error('Failed loading leaves');

          const payload = await response.json();
          const rows = Array.isArray(payload.data) ? payload.data : [];
          const mapped = rows.map((row: any) => ({
            id: String(row.id),
            engineerName: String(row.engineer_name ?? row.engineerName ?? 'Unknown'),
            engineerEmail: String(row.engineer_email ?? row.engineerEmail ?? ''),
            startDate: String(row.start_date ?? row.startDate),
            endDate: String(row.end_date ?? row.endDate),
            reason: String(row.reason),
            status: String(row.status).toLowerCase() as LeaveRequest['status'],
            submittedAt: String(row.submitted_at ?? row.submittedAt)
          }));
          setLeaveRequests(mapped);
        } catch {
          pushAlert('Unable to load leave requests.', 'info');
        } finally {
          setLeaveRequestsLoading(false);
        }
      };

      loadLeaves();
    }
  }, [view]);

  // Load Leaflet on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setLeafletReady(true);
      document.body.appendChild(script);
    } else if (typeof window !== 'undefined' && window.L) {
      setLeafletReady(true);
    }
  }, []);

  // Load map data
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/geohacker/india/master/state/india_telengana.geojson')
      .then(res => res.json())
      .then(data => {
        const features: StateData[] = data.features.map((f: any, i: number) => {
          const name = (f.properties.NAME_1 || f.properties.st_nm || `State ${i}`).replace(' and ', ' & ');
          const load = Math.floor(Math.random() * 40 + 50);

          let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;

          const processCoord = (c: [number, number]) => {
            if (c[1] < minLat) minLat = c[1];
            if (c[1] > maxLat) maxLat = c[1];
            if (c[0] < minLon) minLon = c[0];
            if (c[0] > maxLon) maxLon = c[0];
          };

          if (f.geometry.type === "Polygon") {
            f.geometry.coordinates[0].forEach(processCoord);
          } else if (f.geometry.type === "MultiPolygon") {
            f.geometry.coordinates.forEach((poly: any) => poly[0].forEach(processCoord));
          }

          return {
            id: i,
            name,
            color: '',
            path: '',
            load,
            centerX: 0,
            centerY: 0,
            minLat,
            maxLat,
            minLon,
            maxLon
          };
        });

        features.sort((a, b) => a.name.localeCompare(b.name));
        setMapData(features);
        if (features.length > 0) {
          setSelectedState(features[0]);
        }
      })
      .catch(err => console.error("Map Data Error:", err));
  }, []);

  // Generate substations when state changes
  useEffect(() => {
    if (view === 'manager-portal' && selectedState) {
      const generatedSubs: Substation[] = Array.from({ length: 6 }).map((_, i) => {
        const latRange = selectedState.maxLat - selectedState.minLat;
        const lonRange = selectedState.maxLon - selectedState.minLon;
        const lat = selectedState.minLat + latRange * (0.2 + Math.random() * 0.6);
        const lon = selectedState.minLon + lonRange * (0.2 + Math.random() * 0.6);

        const initialCapacity = Math.floor(Math.random() * 50 + 100);
        const initialLoad = Math.floor(Math.random() * (initialCapacity * 0.7) + 20);

        return {
          id: `sub-${i}`,
          name: i === 0 ? 'Primary Hub' : `Substation Node ${String.fromCharCode(64 + i)}`,
          lat,
          lon,
          location: `Sector ${Math.floor(Math.random() * 99 + 1)}`,
          currentLoadMW: initialLoad,
          maxCapacityMW: initialCapacity,
          status: 'stable',
          voltage: 132 + Math.floor(Math.random() * 10)
        };
      });
      setSubstations(generatedSubs);
      setSelectedSubstationId(generatedSubs[0].id);
    }
  }, [view, selectedState]);

  // Generate smart meters for manager
  useEffect(() => {
    if (view === 'manager-portal') {
      const meters: SmartMeter[] = Array.from({ length: 15 }).map((_, i) => {
        const voltage = 210 + Math.floor(Math.random() * 50);
        let status: 'normal' | 'high' | 'low' = 'normal';
        if (voltage > 245) status = 'high';
        if (voltage < 215) status = 'low';

        return {
          id: `MTR-88${i}${Math.floor(Math.random() * 90 + 10)}`,
          houseAddress: `Block ${String.fromCharCode(65 + (i % 5))}, Plot ${i * 12 + 4}`,
          voltage,
          status,
          lastUpdated: new Date()
        };
      });
      setSmartMeters(meters);
    }
  }, [view]);

  const pushAlert = (message: string, type: 'critical' | 'success' | 'info') => {
    const id = Math.random().toString();
    setActiveAlerts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setActiveAlerts((prev) => prev.filter((item) => item.id !== id)), 4500);
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!managerId || !region || !loginStateId) return;

    const trimmedId = managerId.trim().toUpperCase();
    const selectedStateData = mapData?.find(s => s.id.toString() === loginStateId);

    localStorage.setItem('managerId', trimmedId);
    localStorage.setItem('managerRegion', region);
    localStorage.setItem('managerStateId', loginStateId);

    setManagerId(trimmedId);
    setRegion(region);
    if (selectedStateData) {
      setSelectedState(selectedStateData);
    }
    setView('manager-portal');
    pushAlert('Session established. Welcome, Manager.', 'success');
  };

  const handleLeaveAction = async (leaveId: string, action: 'approved' | 'rejected') => {
    try {
      const response = await fetch(`/api/leave-requests`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: leaveId,
          status: action,
          reviewedById: managerId
        })
      });

      if (!response.ok) throw new Error('Action failed');

      setLeaveRequests((prev) =>
        prev.map((req) =>
          req.id === leaveId ? { ...req, status: action } : req
        )
      );

      pushAlert(
        `Leave request ${action === 'approved' ? 'approved' : 'denied'}.`,
        action === 'approved' ? 'success' : 'info'
      );
    } catch {
      pushAlert('Unable to process leave request.', 'critical');
    }
  };

  const handleAbortProtocol = () => {
    localStorage.removeItem('managerId');
    localStorage.removeItem('managerRegion');
    localStorage.removeItem('managerStateId');
    router.push('/');
  };

  const handleClockOut = () => {
    localStorage.removeItem('managerId');
    localStorage.removeItem('managerRegion');
    localStorage.removeItem('managerStateId');
    setManagerId('');
    setRegion('');
    setLoginStateId('');
    setView('login-manager');
    pushAlert('Session terminated.', 'info');
  };

  const updateSubstationCapacity = (id: string, newCapacity: number) => {
    setSubstations(prev => prev.map(sub => {
      if (sub.id === id) {
        return { ...sub, maxCapacityMW: newCapacity };
      }
      return sub;
    }));
  };

  const handlePrevSubstation = () => {
    if (!substations.length) return;
    const currentIndex = substations.findIndex(s => s.id === selectedSubstationId);
    const prevIndex = (currentIndex - 1 + substations.length) % substations.length;
    setSelectedSubstationId(substations[prevIndex].id);
  };

  const handleNextSubstation = () => {
    if (!substations.length) return;
    const currentIndex = substations.findIndex(s => s.id === selectedSubstationId);
    const nextIndex = (currentIndex + 1) % substations.length;
    setSelectedSubstationId(substations[nextIndex].id);
  };

  if (!isHydrated) return null;

  return (
    <div className="min-h-screen bg-[#131313] text-neutral-200 overflow-hidden font-sans selection:bg-white/20">
      {/* Global Alert Toast Container */}
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
        {/* LOGIN VIEW */}
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
                <p className="text-neutral-400 font-medium text-sm tracking-wider">
                  Local Node Telemetry Access
                </p>
              </div>

              <form
                onSubmit={handleLogin}
                className="space-y-6 bg-[#1c1b1b] p-8 rounded-sm shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
              >
                {/* State Selection */}
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">
                    Operating Region
                  </label>
                  <select
                    required
                    value={loginStateId}
                    onChange={(e) => setLoginStateId(e.target.value)}
                    className="w-full bg-[#353534] focus:bg-[#393939] focus:outline-none transition-all py-3 px-4 text-white text-sm appearance-none cursor-pointer rounded-sm"
                    style={{ 
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      paddingRight: '36px'
                    }}
                  >
                    <option value="">Select a region...</option>
                    {mapData?.map((state) => (
                      <option key={state.id} value={state.id.toString()}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Manager ID */}
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">
                    Station Master ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="MGR-102"
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                    className="w-full bg-[#353534] focus:bg-[#393939] focus:outline-none transition-all py-3 px-4 text-white placeholder:text-neutral-600 rounded-sm text-sm"
                  />
                </div>

                {/* Region Name */}
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">
                    Facility Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Northern Grid Hub"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full bg-[#353534] focus:bg-[#393939] focus:outline-none transition-all py-3 px-4 text-white placeholder:text-neutral-600 rounded-sm text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-white hover:bg-neutral-100 text-[#1a1c1c] font-bold py-3 px-4 rounded-sm transition-all tracking-tight uppercase text-sm mt-8"
                >
                  Access Terminal
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {/* --- MANAGER PORTAL VIEW --- */}
        {view === 'manager-portal' && (
          <motion.div 
            key="manager-portal-view"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
            className="min-h-screen bg-[#131313] flex"
          >
            {/* Sidebar */}
            <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.1, ease: SMOOTH_EASE }} className="w-20 lg:w-72 bg-[#1c1b1b] flex flex-col p-8 shrink-0 z-20">
              <div className="flex items-center gap-6 mb-16">
                <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_12px_#ffffff] shrink-0" />
                <div className="hidden lg:block"><span className="font-bold text-xl tracking-tighter text-white block" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Substation Mgr</span><span className="text-[11px] text-neutral-500 font-medium tracking-widest uppercase mt-1 block">Local Control</span></div>
              </div>
              <nav className="flex-1 space-y-4">
                <button onClick={() => setManagerTab('overview')} className={`flex items-center gap-4 font-bold text-sm tracking-tight uppercase w-full group ${managerTab === 'overview' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors'}`}>
                  {managerTab === 'overview' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0 shadow-[0_0_8px_#ffffff]" />}
                  {managerTab !== 'overview' && <span className="w-1.5 h-1.5 shrink-0" />}
                  <span className="hidden lg:block">Overview</span>
                </button>
                <button onClick={() => setManagerTab('meters')} className={`flex items-center gap-4 font-bold text-sm tracking-tight uppercase w-full group ${managerTab === 'meters' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors'}`}>
                  {managerTab === 'meters' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0 shadow-[0_0_8px_#ffffff]" />}
                  {managerTab !== 'meters' && <span className="w-1.5 h-1.5 shrink-0" />}
                  <span className="hidden lg:block">Meter Telemetry</span>
                </button>
                <button onClick={() => setManagerTab('leave-approvals')} className={`flex items-center justify-between font-bold text-sm tracking-tight uppercase w-full group ${managerTab === 'leave-approvals' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors'}`}>
                  <div className="flex items-center gap-4">
                    {managerTab === 'leave-approvals' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0 shadow-[0_0_8px_#ffffff]" />}
                    {managerTab !== 'leave-approvals' && <span className="w-1.5 h-1.5 shrink-0" />}
                    <span className="hidden lg:block">Personnel</span>
                  </div>
                  {leaveRequests.filter((l:any) => l.status === 'pending').length > 0 && <span className="text-[10px] bg-white text-black px-2 py-0.5 rounded-sm font-bold">{leaveRequests.filter((l:any) => l.status === 'pending').length}</span>}
                </button>
              </nav>
              <button onClick={handleClockOut} className="mt-auto flex items-center gap-4 text-neutral-500 hover:text-white transition-all w-full group"><LogOut className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" /><span className="hidden lg:block font-bold uppercase tracking-tight text-sm">Clock Out</span></button>
            </motion.div>

            {/* Main Content */}
            <div className="flex-1 p-4 lg:p-12 overflow-y-auto">
              {/* Header */}
              <header className="mb-12 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h2 className="text-4xl font-bold text-white tracking-tighter" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Node Administration</h2>
                  <p className="text-neutral-400 text-sm mt-2">Managing Substation Telemetry</p>
                </div>
                <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_#ffffff]"></div>
                    <span className="text-[11px] font-medium tracking-widest uppercase text-neutral-400">System Active</span>
                  </div>
                  <button onClick={handleAbortProtocol} className="text-neutral-500 hover:text-white transition-colors text-[11px] font-bold uppercase tracking-tight">
                    <ArrowLeft className="w-4 h-4 inline mr-2" /> Home
                  </button>
                </div>
              </header>

              {/* OVERVIEW TAB */}
              {managerTab === 'overview' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    <div className="bg-[#1c1b1b] rounded-sm p-8">
                      <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-widest mb-4">Node Health</p>
                      <div className="text-5xl font-bold tracking-tighter text-white mb-2">{substations[0]?.currentLoadMW || 0} <span className="text-xl text-neutral-500 tracking-normal">MW</span></div>
                    </div>
                    <div className="bg-[#1c1b1b] rounded-sm p-8">
                      <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-widest mb-4">Connected Smart Meters</p>
                      <div className="text-5xl font-bold tracking-tighter text-white mb-2">{smartMeters.length} <span className="text-xl text-neutral-500 tracking-normal">Units</span></div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[600px] grid grid-cols-1 xl:grid-cols-3 gap-8">
                    {/* Map */}
                    <div className="xl:col-span-2 bg-[#0e0e0e] rounded-sm flex flex-col relative overflow-hidden min-h-[500px] p-1 border border-[#474747]/15">
                      <div className="absolute top-6 left-6 z-20 pointer-events-none">
                        <h3 className="text-[11px] font-medium tracking-widest uppercase text-neutral-400">Tactical GIS Mapping</h3>
                      </div>
                      {leafletReady && selectedState ? (
                        <LeafletMap selectedState={selectedState} substations={substations} selectedSubstationId={selectedSubstationId} onSelectSubstation={setSelectedSubstationId} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-500">
                          <Activity className="w-6 h-6 animate-spin"/>
                        </div>
                      )}
                    </div>

                    {/* Selected Node Details */}
                    <div className="xl:col-span-1 flex flex-col h-full bg-[#1c1b1b] rounded-sm overflow-hidden relative">
                      <AnimatePresence mode="wait">
                        {substations.find(s => s.id === selectedSubstationId) ? (
                          <motion.div key={selectedSubstationId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col p-8 overflow-y-auto">
                            {(() => {
                              const selectedSubstation = substations.find(s => s.id === selectedSubstationId)!;
                              return (
                                <>
                                  <div className="flex items-start justify-between mb-8 shrink-0">
                                    <div>
                                      <div className="text-[11px] text-neutral-500 tracking-widest uppercase mb-2">Selected Node</div>
                                      <h3 className={`text-2xl font-bold tracking-tighter mb-1 ${selectedSubstation.status === 'critical' ? 'text-red-500' : 'text-white'}`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{selectedSubstation.name}</h3>
                                      <p className="text-neutral-500 text-xs font-mono uppercase">{selectedSubstation.id}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <button onClick={handlePrevSubstation} className="text-neutral-500 hover:text-white transition-colors" title="Previous"><ChevronLeft className="w-5 h-5"/></button>
                                      <span className="text-sm font-mono text-neutral-300">{substations.findIndex((s:any)=>s.id===selectedSubstation.id) + 1}/{substations.length}</span>
                                      <button onClick={handleNextSubstation} className="text-neutral-500 hover:text-white transition-colors" title="Next"><ChevronRight className="w-5 h-5"/></button>
                                    </div>
                                  </div>

                                  {/* Load Indicator */}
                                  <div className="bg-[#0e0e0e] p-6 rounded-sm shrink-0 mb-6">
                                    <div className="flex justify-between text-[11px] mb-4 font-medium text-neutral-400 uppercase tracking-widest">
                                      <span>Output Load</span>
                                      <span className={`${selectedSubstation.status === 'critical' ? 'text-red-500' : 'text-white'}`}>{selectedSubstation.currentLoadMW} MW</span>
                                    </div>
                                    <div className="h-1 bg-[#1c1b1b] rounded-sm overflow-hidden relative">
                                      <div className="absolute top-0 bottom-0 left-[85%] w-px bg-[#474747] z-10"></div>
                                      <motion.div animate={{ width: `${Math.min((selectedSubstation.currentLoadMW / selectedSubstation.maxCapacityMW) * 100, 100)}%` }} className={`h-full ${selectedSubstation.status === 'critical' ? 'bg-red-500' : 'bg-white'}`} />
                                    </div>
                                  </div>

                                  {/* Capacity Slider */}
                                  <div className="bg-[#0e0e0e] p-6 rounded-sm shrink-0 mb-6">
                                    <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-widest mb-4">Safe Capacity Limit</h4>
                                    <input 
                                      type="range" 
                                      min="50" 
                                      max="500" 
                                      step="10" 
                                      value={selectedSubstation.maxCapacityMW} 
                                      onChange={(e) => updateSubstationCapacity(selectedSubstation.id, parseInt(e.target.value))} 
                                      className="w-full h-1 bg-[#1c1b1b] rounded-sm appearance-none cursor-pointer accent-white" 
                                    />
                                    <div className="flex justify-between text-xs text-neutral-500 font-mono mt-4">
                                      <span>50 MW</span>
                                      <span className="text-white">{selectedSubstation.maxCapacityMW} MW</span>
                                      <span>500 MW</span>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </motion.div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-500 p-8">
                            <p className="text-[11px] uppercase tracking-widest font-medium">Select a node</p>
                          </div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </>
              )}

              {/* METERS TAB */}
              {managerTab === 'meters' && (
                <div className="bg-[#1c1b1b] rounded-sm p-8">
                  <h3 className="text-2xl font-bold tracking-tighter text-white mb-8" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Residential Smart Meters</h3>
                  <div className="bg-[#0e0e0e] rounded-sm overflow-x-auto p-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-neutral-500 text-[11px] font-medium uppercase tracking-widest">
                          <th className="p-4 font-normal">Meter ID</th>
                          <th className="p-4 font-normal">Address</th>
                          <th className="p-4 font-normal">Voltage</th>
                          <th className="p-4 font-normal">Status</th>
                          <th className="p-4 font-normal text-right">Last Ping</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {smartMeters.map((meter:any, index:number) => (
                          <tr key={meter.id} className={index % 2 === 0 ? 'bg-[#0e0e0e]' : 'bg-[#131313]'}>
                            <td className="p-4 font-mono text-neutral-300">{meter.id}</td>
                            <td className="p-4 text-neutral-400">{meter.houseAddress}</td>
                            <td className="p-4"><span className={`font-mono font-bold ${meter.status === 'high' ? 'text-red-400' : meter.status === 'low' ? 'text-neutral-500' : 'text-white'}`}>{meter.voltage} V</span></td>
                            <td className="p-4"><span className={`text-[11px] font-bold uppercase tracking-widest ${meter.status === 'high' ? 'text-red-400' : meter.status === 'low' ? 'text-neutral-500' : 'text-white'}`}>{meter.status === 'high' ? 'Overvolt' : meter.status === 'low' ? 'Undervolt' : 'Nominal'}</span></td>
                            <td className="p-4 font-mono text-[11px] text-neutral-500 text-right">{meter.lastUpdated.toLocaleTimeString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* LEAVE APPROVALS TAB */}
              {managerTab === 'leave-approvals' && (
                <div className="bg-[#1c1b1b] rounded-sm p-8">
                  <h3 className="text-2xl font-bold tracking-tighter text-white mb-8" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Pending Leave Approvals</h3>
                  <div className="space-y-6">
                    {leaveRequests.length === 0 ? (
                      <p className="text-neutral-500 text-sm">No leave requests currently in system.</p>
                    ) : (
                      leaveRequests.map((req:any) => (
                        <div key={req.id} className="bg-[#0e0e0e] p-8 rounded-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                          <div>
                            <div className="flex items-center gap-4 mb-3">
                              <h4 className="text-white font-bold text-lg">{req.engineerName}</h4>
                              <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">{req.status}</span>
                            </div>
                            <p className="text-neutral-400 text-sm mb-2">Dates: {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}</p>
                            <p className="text-neutral-500 text-sm italic">"{req.reason}"</p>
                          </div>
                          {req.status === 'pending' && (
                            <div className="flex gap-4 shrink-0">
                              <button onClick={() => handleLeaveAction(req.id, 'approved')} className="text-[#1a1c1c] bg-white hover:bg-neutral-200 px-6 py-3 rounded-sm font-bold uppercase tracking-tight text-xs transition-colors">Approve</button>
                              <button onClick={() => handleLeaveAction(req.id, 'rejected')} className="text-white bg-[#2a2a2a] hover:bg-[#353534] px-6 py-3 rounded-sm font-bold uppercase tracking-tight text-xs transition-colors">Deny</button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
