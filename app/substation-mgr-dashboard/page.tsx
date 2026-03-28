"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, cubicBezier } from 'framer-motion';
import { LogOut, AlertCircle, CheckCircle2, Info, ArrowLeft, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

const SMOOTH_EASE = cubicBezier(0.22, 1, 0.36, 1);

const INDIA_BOUNDS = {
  minLat: 6.4,
  maxLat: 35.0,
  minLon: 68.1,
  maxLon: 97.4
};

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── LeafletMap ──────────────────────────────────────────────────────────────
// FIX 1: Separate map lifecycle from marker lifecycle.
// FIX 2: Never destroy the map in cleanup when deps change — only on true unmount.
// FIX 3: Stabilize onMapClick with useCallback in parent so it doesn't recreate the map.
// FIX 4: mapReady replaced with a ref so markers effect doesn't need it as a dep.

const LeafletMap = React.memo(({
  selectedState,
  substations,
  selectedSubstationId,
  onSelectSubstation,
  isAddMode = false,
  onMapClick,
  tempMarkerPos
}: {
  selectedState: StateData | null;
  substations: Substation[];
  selectedSubstationId: string | null;
  onSelectSubstation: (id: string) => void;
  isAddMode?: boolean;
  onMapClick?: (coords: [number, number]) => void;
  tempMarkerPos?: [number, number] | null;
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const tempMarkerRef = useRef<any>(null);
  const isMapReady = useRef(false); // ref, not state — avoids triggering re-renders

  // ── Effect 1: Initialize map ONCE, never destroy on dep change ──────────────
  useEffect(() => {
    if (!mapRef.current || !window.L || mapInstance.current) return;

    const map = window.L.map(mapRef.current, { zoomControl: false });

    const indiaBounds: [[number, number], [number, number]] = [
      [INDIA_BOUNDS.minLat, INDIA_BOUNDS.minLon],
      [INDIA_BOUNDS.maxLat, INDIA_BOUNDS.maxLon]
    ];
    map.fitBounds(indiaBounds);

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20
    }).addTo(map);

    markersLayer.current = window.L.layerGroup().addTo(map);
    mapInstance.current = map;
    isMapReady.current = true;

    // Trigger marker render now that map exists
    renderMarkersRef.current?.();

    // True cleanup — only on component unmount
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markersLayer.current = null;
        isMapReady.current = false;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally empty

  // ── Effect 2: Zoom to selected state when it changes ───────────────────────
  useEffect(() => {
    if (!mapInstance.current || !selectedState) return;

    const bounds: [[number, number], [number, number]] = [
      [
        Math.max(selectedState.minLat, INDIA_BOUNDS.minLat),
        Math.max(selectedState.minLon, INDIA_BOUNDS.minLon)
      ],
      [
        Math.min(selectedState.maxLat, INDIA_BOUNDS.maxLat),
        Math.min(selectedState.maxLon, INDIA_BOUNDS.maxLon)
      ]
    ];
    mapInstance.current.fitBounds(bounds);
  }, [selectedState]);

  // ── Effect 3: Click handler — attach/detach cleanly ────────────────────────
  useEffect(() => {
    if (!mapInstance.current) return;

    const handler = (e: any) => {
      if (isAddMode && onMapClick) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    };

    mapInstance.current.on('click', handler);
    return () => {
      mapInstance.current?.off('click', handler);
    };
  }, [isAddMode, onMapClick]);

  // ── Marker render function stored in ref so map init can call it ───────────
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

      const html = `<div style="background-color:${color};width:${size}px;height:${size}px;border-radius:50%;box-shadow:0 0 15px ${glowColor};opacity:${isSelected ? 1 : 0.6};transition:all 0.4s cubic-bezier(0.22,1,0.36,1);cursor:pointer;"></div>`;
      const icon = window.L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });

      const marker = window.L.marker([sub.lat, sub.lon], { icon });

      marker.on('click', () => {
        if (!isAddMode) onSelectSubstation(sub.id);
      });

      marker.bindTooltip(
        `<div class="font-sans text-[11px] tracking-widest uppercase">${sub.name}<br/><span class="text-neutral-400">${sub.currentLoadMW} MW</span></div>`,
        { direction: 'top', offset: [0, -10] }
      );

      markersLayer.current.addLayer(marker);
    });

    if (selectedSubstationId && !isAddMode) {
      const sub = substations.find((s) => s.id === selectedSubstationId);
      if (sub) {
        mapInstance.current.flyTo(
          [sub.lat, sub.lon],
          Math.max(mapInstance.current.getZoom(), 8),
          { animate: true, duration: 1 }
        );
      }
    }
  };

  // ── Effect 4: Re-render markers whenever substations/selection changes ──────
  useEffect(() => {
    renderMarkersRef.current?.();
  }, [substations, selectedSubstationId, isAddMode]);

  // ── Effect 5: Temp marker for add mode ─────────────────────────────────────
  useEffect(() => {
    if (!mapInstance.current || !window.L) return;

    if (tempMarkerRef.current) {
      mapInstance.current.removeLayer(tempMarkerRef.current);
      tempMarkerRef.current = null;
    }

    if (tempMarkerPos && isAddMode) {
      const icon = window.L.divIcon({
        html: '<div style="width:16px;height:16px;background-color:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 0 10px rgba(59,130,246,0.5);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        className: ''
      });
      tempMarkerRef.current = window.L.marker(tempMarkerPos, { icon }).addTo(mapInstance.current);
    }
  }, [tempMarkerPos, isAddMode]);

  return <div ref={mapRef} className="w-full h-full z-0 bg-[#0e0e0e]" />;
});

LeafletMap.displayName = 'LeafletMap';

// ─── Main Page ────────────────────────────────────────────────────────────────

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
  const [substationsLoading, setSubstationsLoading] = useState(false);
  const [showAddSubstationModal, setShowAddSubstationModal] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [tempMarkerPos, setTempMarkerPos] = useState<[number, number] | null>(null);
  const [addFormData, setAddFormData] = useState({
    name: '',
    location: '',
    lat: '',
    lon: '',
    currentLoadMw: '50',
    maxCapacityMw: '150',
    voltage: '132'
  });

  // ── FIX: Stable callback so LeafletMap doesn't re-init on every render ──────
  const handleMapClick = useCallback((coords: [number, number]) => {
    if (!selectedState) return;
    const [lat, lon] = coords;
    const inside =
      lat >= selectedState.minLat &&
      lat <= selectedState.maxLat &&
      lon >= selectedState.minLon &&
      lon <= selectedState.maxLon;

    if (inside) {
      setTempMarkerPos(coords);
      setAddFormData((prev) => ({
        ...prev,
        lat: lat.toFixed(6),
        lon: lon.toFixed(6)
      }));
    } else {
      pushAlert('Location is outside the selected state.', 'info');
    }
  }, [selectedState]); // only re-creates when selectedState changes

  // ── Restore session from localStorage on mount ──────────────────────────────
  // FIX: Don't try to resolve selectedState here — mapData hasn't loaded yet.
  // We persist loginStateId and resolve it once mapData arrives (see below).
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

  // ── FIX: Resolve selectedState once mapData is ready ───────────────────────
  // This covers both login flow and page refresh.
  useEffect(() => {
    if (!mapData || mapData.length === 0 || !loginStateId) return;
    const state = mapData.find((s) => s.id.toString() === loginStateId);
    if (state && state.id !== selectedState?.id) {
      setSelectedState(state);
    }
  }, [mapData, loginStateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load leave requests ─────────────────────────────────────────────────────
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
            id: String(row.id),
            engineerName: String(row.engineer_name ?? row.engineerName ?? 'Unknown'),
            engineerEmail: String(row.engineer_email ?? row.engineerEmail ?? ''),
            startDate: String(row.start_date ?? row.startDate),
            endDate: String(row.end_date ?? row.endDate),
            reason: String(row.reason),
            status: String(row.status).toLowerCase() as LeaveRequest['status'],
            submittedAt: String(row.submitted_at ?? row.submittedAt)
          }))
        );
      } catch {
        pushAlert('Unable to load leave requests.', 'info');
      } finally {
        setLeaveRequestsLoading(false);
      }
    };

    load();
  }, [view]);

  // ── Load Leaflet script ─────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.L) {
      setLeafletReady(true);
      return;
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setLeafletReady(true);
      document.body.appendChild(script);
    }
  }, []);

  // ── Load India GeoJSON ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/geohacker/india/master/state/india_telengana.geojson')
      .then((r) => r.json())
      .then((data) => {
        const features: StateData[] = data.features.map((f: any, i: number) => {
          const name = (f.properties.NAME_1 || f.properties.st_nm || `State ${i}`).replace(' and ', ' & ');
          const load = Math.floor(Math.random() * 40 + 50);

          let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
          const process = (c: [number, number]) => {
            if (c[1] < minLat) minLat = c[1];
            if (c[1] > maxLat) maxLat = c[1];
            if (c[0] < minLon) minLon = c[0];
            if (c[0] > maxLon) maxLon = c[0];
          };

          if (f.geometry.type === 'Polygon') f.geometry.coordinates[0].forEach(process);
          else if (f.geometry.type === 'MultiPolygon')
            f.geometry.coordinates.forEach((poly: any) => poly[0].forEach(process));

          return { id: i, name, color: '', path: '', load, centerX: 0, centerY: 0, minLat, maxLat, minLon, maxLon };
        });

        features.sort((a, b) => a.name.localeCompare(b.name));
        setMapData(features);
      })
      .catch((err) => console.error('Map Data Error:', err));
  }, []);

  // ── Fetch substations when state changes ────────────────────────────────────
  useEffect(() => {
    if (view !== 'manager-portal' || !selectedState) return;

    const load = async () => {
      try {
        setSubstationsLoading(true);
        const res = await fetch(`/api/substations?state=${encodeURIComponent(selectedState.name)}`, {
          cache: 'no-store'
        });
        if (!res.ok) throw new Error();
        const payload = await res.json();
        const subs: Substation[] = Array.isArray(payload.data) ? payload.data : [];
        setSubstations(subs);

        // Cache for offline fallback
        localStorage.setItem('substationsCache', JSON.stringify(subs));
        localStorage.setItem('substationsCacheState', selectedState.name);

        if (subs.length > 0) setSelectedSubstationId(subs[0].id);
        else setSelectedSubstationId(null);
      } catch {
        // Try cache
        const cached = localStorage.getItem('substationsCache');
        const cachedState = localStorage.getItem('substationsCacheState');
        if (cached && cachedState === selectedState.name) {
          try {
            const parsed: Substation[] = JSON.parse(cached);
            setSubstations(parsed);
            if (parsed.length > 0) setSelectedSubstationId(parsed[0].id);
          } catch {
            pushAlert('Unable to load substations.', 'info');
            setSubstations([]);
          }
        } else {
          pushAlert('Unable to load substations.', 'info');
          setSubstations([]);
        }
      } finally {
        setSubstationsLoading(false);
      }
    };

    load();
  }, [view, selectedState]);

  // ── Generate smart meters ───────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'manager-portal') return;
    const meters: SmartMeter[] = Array.from({ length: 15 }).map((_, i) => {
      const voltage = 210 + Math.floor(Math.random() * 50);
      const status: SmartMeter['status'] = voltage > 245 ? 'high' : voltage < 215 ? 'low' : 'normal';
      return {
        id: `MTR-88${i}${Math.floor(Math.random() * 90 + 10)}`,
        houseAddress: `Block ${String.fromCharCode(65 + (i % 5))}, Plot ${i * 12 + 4}`,
        voltage,
        status,
        lastUpdated: new Date()
      };
    });
    setSmartMeters(meters);
  }, [view]);

  // ── Utilities ───────────────────────────────────────────────────────────────

  const pushAlert = (message: string, type: 'critical' | 'success' | 'info') => {
    const id = Math.random().toString();
    setActiveAlerts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setActiveAlerts((prev) => prev.filter((a) => a.id !== id)), 4500);
  };

  const validateCoordinatesInState = (lat: number, lon: number) => {
    if (!selectedState) return false;
    return lat >= selectedState.minLat && lat <= selectedState.maxLat &&
      lon >= selectedState.minLon && lon <= selectedState.maxLon;
  };

  const closeAddSubstationModal = () => {
    setShowAddSubstationModal(false);
    setIsAddMode(false);
    setTempMarkerPos(null);
    setAddFormData({ name: '', location: '', lat: '', lon: '', currentLoadMw: '50', maxCapacityMw: '150', voltage: '132' });
  };

  const handleAddSubstationSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const lat = parseFloat(addFormData.lat);
    const lon = parseFloat(addFormData.lon);

    if (!addFormData.name || !addFormData.location) { pushAlert('Name and location are required.', 'info'); return; }
    if (isNaN(lat) || isNaN(lon)) { pushAlert('Invalid latitude or longitude.', 'info'); return; }
    if (!validateCoordinatesInState(lat, lon)) { pushAlert('Location is outside the selected state.', 'info'); return; }

    try {
      const res = await fetch('/api/substations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addFormData.name, state: selectedState?.name || '', location: addFormData.location,
          lat, lon, currentLoadMw: parseInt(addFormData.currentLoadMw),
          maxCapacityMw: parseInt(addFormData.maxCapacityMw), voltage: parseInt(addFormData.voltage), status: 'stable'
        })
      });
      if (!res.ok) throw new Error();
      const payload = await res.json();
      setSubstations((prev) => {
        const updated = [...prev, payload.data];
        localStorage.setItem('substationsCache', JSON.stringify(updated));
        return updated;
      });
      closeAddSubstationModal();
      pushAlert('Substation added successfully.', 'success');
    } catch {
      pushAlert('Failed to add substation.', 'critical');
    }
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!managerId || !region || !loginStateId) return;
    const trimmedId = managerId.trim().toUpperCase();
    localStorage.setItem('managerId', trimmedId);
    localStorage.setItem('managerRegion', region);
    localStorage.setItem('managerStateId', loginStateId);
    setManagerId(trimmedId);
    // selectedState resolves via the mapData effect
    setView('manager-portal');
    pushAlert('Session established. Welcome, Manager.', 'success');
  };

  const handleLeaveAction = async (leaveId: string, action: 'approved' | 'rejected') => {
    try {
      const res = await fetch('/api/leave-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leaveId, status: action, reviewedById: managerId })
      });
      if (!res.ok) throw new Error();
      setLeaveRequests((prev) => prev.map((r) => r.id === leaveId ? { ...r, status: action } : r));
      pushAlert(`Leave request ${action === 'approved' ? 'approved' : 'denied'}.`, action === 'approved' ? 'success' : 'info');
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
    setManagerId(''); setRegion(''); setLoginStateId('');
    setView('login-manager');
    pushAlert('Session terminated.', 'info');
  };

  const updateSubstationCapacity = (id: string, newCapacity: number) => {
    setSubstations((prev) => prev.map((s) => s.id === id ? { ...s, maxCapacityMW: newCapacity } : s));
  };

  const handlePrevSubstation = () => {
    if (!substations.length) return;
    const idx = substations.findIndex((s) => s.id === selectedSubstationId);
    setSelectedSubstationId(substations[(idx - 1 + substations.length) % substations.length].id);
  };

  const handleNextSubstation = () => {
    if (!substations.length) return;
    const idx = substations.findIndex((s) => s.id === selectedSubstationId);
    setSelectedSubstationId(substations[(idx + 1) % substations.length].id);
  };

  if (!isHydrated) return null;

  const selectedSubstation = substations.find((s) => s.id === selectedSubstationId) ?? null;

  // ─── Render ─────────────────────────────────────────────────────────────────

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
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      paddingRight: '36px'
                    }}
                  >
                    <option value="">Select a region...</option>
                    {mapData?.map((state) => (
                      <option key={state.id} value={state.id.toString()}>{state.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">Station Master ID</label>
                  <input type="text" required placeholder="MGR-102" value={managerId} onChange={(e) => setManagerId(e.target.value)}
                    className="w-full bg-[#353534] focus:bg-[#393939] focus:outline-none transition-all py-3 px-4 text-white placeholder:text-neutral-600 rounded-sm text-sm" />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">Facility Name</label>
                  <input type="text" required placeholder="e.g., Northern Grid Hub" value={region} onChange={(e) => setRegion(e.target.value)}
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
                {(['overview', 'meters', 'leave-approvals'] as ManagerTab[]).map((tab) => {
                  const labels: Record<ManagerTab, string> = { overview: 'Overview', meters: 'Meter Telemetry', 'leave-approvals': 'Personnel' };
                  const pendingCount = tab === 'leave-approvals' ? leaveRequests.filter((l) => l.status === 'pending').length : 0;
                  return (
                    <button key={tab} onClick={() => setManagerTab(tab)}
                      className={`flex items-center justify-between font-bold text-sm tracking-tight uppercase w-full ${managerTab === tab ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors'}`}
                    >
                      <div className="flex items-center gap-4">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${managerTab === tab ? 'bg-white shadow-[0_0_8px_#ffffff]' : ''}`} />
                        <span className="hidden lg:block">{labels[tab]}</span>
                      </div>
                      {pendingCount > 0 && (
                        <span className="text-[10px] bg-white text-black px-2 py-0.5 rounded-sm font-bold">{pendingCount}</span>
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
              <header className="mb-12 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h2 className="text-4xl font-bold text-white tracking-tighter" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Node Administration</h2>
                  <p className="text-neutral-400 text-sm mt-2">Managing Substation Telemetry</p>
                </div>
                <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_#ffffff]" />
                    <span className="text-[11px] font-medium tracking-widest uppercase text-neutral-400">System Active</span>
                  </div>
                  {managerTab === 'overview' && (
                    <button
                      onClick={() => { setShowAddSubstationModal(true); setIsAddMode(true); }}
                      className="text-white hover:text-blue-400 transition-colors text-[11px] font-bold uppercase tracking-tight bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded-sm"
                    >
                      + Add Substation
                    </button>
                  )}
                  <button onClick={handleAbortProtocol} className="text-neutral-500 hover:text-white transition-colors text-[11px] font-bold uppercase tracking-tight">
                    <ArrowLeft className="w-4 h-4 inline mr-2" /> Home
                  </button>
                </div>
              </header>

              {/* ── OVERVIEW TAB ──────────────────────────────────────────── */}
              {managerTab === 'overview' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    <div className="bg-[#1c1b1b] rounded-sm p-8">
                      <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-widest mb-4">Node Health (Avg Load)</p>
                      <div className="text-5xl font-bold tracking-tighter text-white mb-2">
                        {substations.length > 0
                          ? Math.round(substations.reduce((s, sub) => s + sub.currentLoadMW, 0) / substations.length)
                          : 0}
                        <span className="text-xl text-neutral-500 tracking-normal"> MW</span>
                      </div>
                    </div>
                    <div className="bg-[#1c1b1b] rounded-sm p-8">
                      <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-widest mb-4">Active Substations</p>
                      <div className="text-5xl font-bold tracking-tighter text-white mb-2">
                        {substationsLoading ? <Activity className="w-8 h-8 animate-spin inline" /> : substations.length}
                        <span className="text-xl text-neutral-500 tracking-normal"> Nodes</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-150 grid grid-cols-1 xl:grid-cols-3 gap-8">
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
                          onSelectSubstation={setSelectedSubstationId}
                          isAddMode={false}
                          onMapClick={handleMapClick}
                          tempMarkerPos={null}
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
                                <div className="text-[11px] text-neutral-500 tracking-widest uppercase mb-2">Selected Node</div>
                                <h3 className={`text-2xl font-bold tracking-tighter mb-1 ${selectedSubstation.status === 'critical' ? 'text-red-500' : 'text-white'}`} style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                                  {selectedSubstation.name}
                                </h3>
                                <p className="text-neutral-500 text-xs font-mono uppercase">{selectedSubstation.id}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <button onClick={handlePrevSubstation} className="text-neutral-500 hover:text-white transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                                <span className="text-sm font-mono text-neutral-300">
                                  {substations.findIndex((s) => s.id === selectedSubstation.id) + 1}/{substations.length}
                                </span>
                                <button onClick={handleNextSubstation} className="text-neutral-500 hover:text-white transition-colors"><ChevronRight className="w-5 h-5" /></button>
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

                            <div className="bg-[#0e0e0e] p-6 rounded-sm shrink-0 mb-6">
                              <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-widest mb-4">Safe Capacity Limit</h4>
                              <input
                                type="range" min="50" max="500" step="10"
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
                          </motion.div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-500 p-8">
                            {substationsLoading
                              ? <Activity className="w-6 h-6 animate-spin" />
                              : <p className="text-[11px] uppercase tracking-widest font-medium">Select a node</p>
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
                          {['Meter ID', 'Address', 'Voltage', 'Status', 'Last Ping'].map((h, i) => (
                            <th key={h} className={`p-4 font-normal ${i === 4 ? 'text-right' : ''}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {smartMeters.map((meter, index) => (
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
                              <button onClick={() => handleLeaveAction(req.id, 'approved')} className="text-[#1a1c1c] bg-white hover:bg-neutral-200 px-6 py-3 rounded-sm font-bold uppercase tracking-tight text-xs transition-colors">Approve</button>
                              <button onClick={() => handleLeaveAction(req.id, 'rejected')} className="text-white bg-[#2a2a2a] hover:bg-[#353534] px-6 py-3 rounded-sm font-bold uppercase tracking-tight text-xs transition-colors">Deny</button>
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

      {/* ── ADD SUBSTATION MODAL ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddSubstationModal && (
          <motion.div
            key="add-substation-modal"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[#131313] flex"
          >
            {/* Map pane */}
            <motion.div initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }} className="flex-1 hidden md:flex flex-col relative">
              {leafletReady && selectedState ? (
                <LeafletMap
                  selectedState={selectedState}
                  substations={substations}
                  selectedSubstationId={selectedSubstationId}
                  onSelectSubstation={setSelectedSubstationId}
                  isAddMode={true}
                  onMapClick={handleMapClick}
                  tempMarkerPos={tempMarkerPos}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-500">
                  <Activity className="w-6 h-6 animate-spin" />
                </div>
              )}
              <div className="absolute top-6 left-6 z-20 pointer-events-none">
                <h3 className="text-[11px] font-medium tracking-widest uppercase text-neutral-400 bg-black/50 px-3 py-2 rounded">
                  Click map to select location
                </h3>
              </div>
            </motion.div>

            {/* Form pane */}
            <motion.div
              initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full md:w-96 bg-[#1c1b1b] border-l border-[#474747]/15 flex flex-col p-6"
            >
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h3 className="text-xl font-bold text-white tracking-tighter" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Add Substation</h3>
                <button onClick={closeAddSubstationModal} className="text-neutral-500 hover:text-white transition-colors text-lg">✕</button>
              </div>

              <form onSubmit={handleAddSubstationSubmit} className="flex-1 flex flex-col gap-4 overflow-y-auto">
                <div className="space-y-4">
                  {[
                    { label: 'Name', key: 'name', placeholder: 'e.g., Northern Hub' },
                    { label: 'Location', key: 'location', placeholder: 'e.g., Sector 5' }
                  ].map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-2">{label}</label>
                      <input type="text" required placeholder={placeholder}
                        value={addFormData[key as keyof typeof addFormData]}
                        onChange={(e) => setAddFormData({ ...addFormData, [key]: e.target.value })}
                        className="w-full bg-[#353534] focus:bg-[#393939] focus:outline-none transition-all py-2 px-3 text-white placeholder:text-neutral-600 rounded-sm text-sm"
                      />
                    </div>
                  ))}

                  <div className="bg-[#0e0e0e] p-3 rounded-sm border border-blue-500/30 text-xs text-blue-300 space-y-1">
                    <p className="font-semibold">Location Methods:</p>
                    <p>✓ Click map to set coordinates</p>
                    <p>✓ Or enter manually below</p>
                    {tempMarkerPos && <p className="text-green-400">📍 Location selected!</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Lat', key: 'lat', placeholder: '28.7041' },
                      { label: 'Lon', key: 'lon', placeholder: '77.1025' }
                    ].map(({ label, key, placeholder }) => (
                      <div key={key}>
                        <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-1">{label}</label>
                        <input type="number" required step="0.000001" placeholder={placeholder}
                          value={addFormData[key as keyof typeof addFormData]}
                          onChange={(e) => setAddFormData({ ...addFormData, [key]: e.target.value })}
                          className="w-full bg-[#353534] focus:bg-[#393939] focus:outline-none transition-all py-2 px-3 text-white placeholder:text-neutral-600 rounded-sm text-xs"
                        />
                      </div>
                    ))}
                  </div>

                  {[
                    { label: 'Current Load (MW)', key: 'currentLoadMw', placeholder: '50' },
                    { label: 'Max Capacity (MW)', key: 'maxCapacityMw', placeholder: '150' },
                    { label: 'Voltage (kV)', key: 'voltage', placeholder: '132' }
                  ].map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-2">{label}</label>
                      <input type="number" required min="0" placeholder={placeholder}
                        value={addFormData[key as keyof typeof addFormData]}
                        onChange={(e) => setAddFormData({ ...addFormData, [key]: e.target.value })}
                        className="w-full bg-[#353534] focus:bg-[#393939] focus:outline-none transition-all py-2 px-3 text-white placeholder:text-neutral-600 rounded-sm text-sm"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 mt-auto pt-4 border-t border-[#474747]/15 shrink-0">
                  <button type="button" onClick={closeAddSubstationModal}
                    className="flex-1 bg-[#2a2a2a] hover:bg-[#353534] text-white py-2 px-3 rounded-sm transition-all tracking-tight uppercase text-xs font-bold">
                    Cancel
                  </button>
                  <button type="submit"
                    className="flex-1 bg-white hover:bg-neutral-100 text-[#1a1c1c] font-bold py-2 px-3 rounded-sm transition-all tracking-tight uppercase text-xs">
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}