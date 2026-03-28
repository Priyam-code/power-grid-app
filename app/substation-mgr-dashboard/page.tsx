"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, cubicBezier } from 'framer-motion';
import { 
  ShieldCheck, MapPin, Lock, ChevronRight, ChevronLeft, Activity, 
  AlertCircle, Database, ArrowLeft, LogOut, User as UserIcon, 
  Radio, Cpu, Landmark, BarChart3, Globe, SlidersHorizontal, 
  TerminalSquare, Wrench, Mail, UserCheck, CalendarDays, 
  CheckCircle, Clock, Briefcase, HardHat, PlusCircle, UserPlus, 
  FileText, X, CheckCircle2, Info, Home, Zap, XSquare, Server
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// --- Global Declarations ---
declare global {
  var __firebase_config: string | undefined;
  var __app_id: string | undefined;
  var __initial_auth_token: string | undefined;
  interface Window { L: any; }
}

// --- Firebase Setup (Safe Local Mock Mode) ---
let app: any = null;
let auth: any = null;
let db: any = null;

try {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    const firebaseConfig = JSON.parse(__firebase_config);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (error) {
  console.warn("Running in local mock mode.");
}
const appId = typeof __app_id !== 'undefined' ? __app_id : 'india-power-grid-001';

// --- Types & Interfaces ---
export type ViewState = 'map' | 'login-admin' | 'login-manager' | 'login-engineer' | 'dashboard' | 'manager-portal' | 'engineer-portal';
export type UserRole = 'admin' | 'manager' | 'engineer';

export interface StateData {
  id: number; name: string; color: string; path: string; load: number;
  centerX: number; centerY: number; minLat: number; maxLat: number; minLon: number; maxLon: number;
}
export interface LogEntry { id: string; timestamp: Date; message: string; type: 'info' | 'warning' | 'critical' | 'success'; }
export interface Substation {
  id: string; name: string; lat: number; lon: number; location: string;
  currentLoadMW: number; maxCapacityMW: number; status: 'stable' | 'warning' | 'critical'; voltage: number; logs: LogEntry[];
}
export interface EngineerTask { id: string; location: string; description: string; severity: 'low' | 'medium' | 'critical'; status: 'pending' | 'completed'; timestamp: Date; }
export interface LeaveRequest { id: string; engineerName: string; startDate: string; endDate: string; reason: string; status: 'pending' | 'approved' | 'rejected'; submittedAt: Date; }
export interface AppAlert { id: string; message: string; type: 'critical' | 'success' | 'info'; }
export interface SmartMeter { id: string; houseAddress: string; voltage: number; status: 'normal' | 'high' | 'low'; lastUpdated: Date; }

const SMOOTH_EASE = cubicBezier(0.22, 1, 0.36, 1);

// --- Design System Tokens (Kinetic Monolith) ---
const TOKENS = {
  surface: '#131313', surfaceLow: '#1c1b1b', surfaceContainer: '#201f1f',
  surfaceHigh: '#2a2a2a', surfaceHighest: '#353534', surfaceLowest: '#0e0e0e',
  primary: '#ffffff', onPrimary: '#1a1c1c', ghostBorder: 'rgba(71, 71, 71, 0.15)',
  error: '#ef4444', synapseGlow: '0 0 12px #5d5f5f'
};

// ============================================================================
// STRICT-MODE SAFE LEAFLET COMPONENT
// ============================================================================

const LeafletMap = ({ selectedState, substations, selectedSubstationId, onSelectSubstation }: any) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersLayer = useRef<any>(null); // Use LayerGroup to manage markers safely
  const [mapReady, setMapReady] = useState(false); // Force marker effect to run on remount

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

    // Clear old markers before drawing new ones to prevent duplicates
    markersLayer.current.clearLayers();

    substations.forEach((sub: Substation) => {
      const isCritical = sub.status === 'warning' || sub.status === 'critical';
      const color = isCritical ? TOKENS.error : TOKENS.primary; 
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


// --- Main Application ---
export default function App() {
  const [view, setView] = useState<ViewState>('login-manager');
  const [selectedState, setSelectedState] = useState<StateData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [mapData, setMapData] = useState<StateData[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [leafletReady, setLeafletReady] = useState(false);
  
  const [loginStateId, setLoginStateId] = useState<string>('');
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [selectedSubstationId, setSelectedSubstationId] = useState<string | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<AppAlert[]>([]); 

  const [showStationModal, setShowStationModal] = useState(false);
  const [showEngineerModal, setShowEngineerModal] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [newStationCap, setNewStationCap] = useState('200');
  const [newEngName, setNewEngName] = useState('');

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([
    { id: 'lv-001', engineerName: 'Ramesh Kumar', startDate: '2026-04-10', endDate: '2026-04-12', reason: 'Family medical emergency', status: 'pending', submittedAt: new Date(Date.now() - 86400000) }
  ]);

  const [engTab, setEngTab] = useState<'inbox' | 'profile' | 'leave'>('inbox');
  const [engTasks, setEngTasks] = useState<EngineerTask[]>([
    { id: 'tsk-001', location: 'Substation Alpha', description: 'Transformer Oil Temp Critical', severity: 'critical', status: 'pending', timestamp: new Date(Date.now() - 3600000) },
    { id: 'tsk-002', location: 'Sector 42 Relay', description: 'Phase B Voltage Drop', severity: 'medium', status: 'pending', timestamp: new Date(Date.now() - 7200000) },
  ]);
  const [leaveForm, setLeaveForm] = useState({ start: '', end: '', reason: '' });

  const [managerTab, setManagerTab] = useState<'overview' | 'meters' | 'leave-approvals'>('overview');
  const [smartMeters, setSmartMeters] = useState<SmartMeter[]>([]);

  const pushAlert = (message: string, type: 'critical' | 'success' | 'info') => {
    const id = Math.random().toString();
    setActiveAlerts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setActiveAlerts(prev => prev.filter(a => a.id !== id));
    }, 5000);
  };

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

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/geohacker/india/master/state/india_telengana.geojson')
      .then(res => res.json())
      .then(data => {
        const project = ([lon, lat]: [number, number]): [number, number] => {
          const scale = 25; 
          const x = (lon - 82) * scale;
          const y = -(lat - 22.5) * scale;
          return [x + 400, y + 450]; 
        };

        const features: StateData[] = data.features.map((f: any, i: number) => {
          const rawName = f.properties.NAME_1 || f.properties.st_nm || `State ${i}`;
          const name = rawName.replace(' and ', ' & ').replace(' Islands', '');
          const load = Math.floor(Math.random() * 40 + 50);
          
          let path = "";
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;

          const processCoord = (c: [number, number]) => {
            const [lon, lat] = c;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;

            const [x, y] = project(c);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            return `${x},${y}`;
          };

          if (f.geometry.type === "Polygon") {
            path = "M" + f.geometry.coordinates[0].map(processCoord).join("L") + "Z";
          } else if (f.geometry.type === "MultiPolygon") {
            path = f.geometry.coordinates.map((poly: any) => 
              "M" + poly[0].map(processCoord).join("L") + "Z"
            ).join(" ");
          }

          return { 
            id: i, name, color: '', path, load,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
            minLat, maxLat, minLon, maxLon
          };
        });
        
        features.sort((a, b) => a.name.localeCompare(b.name));
        setMapData(features);
        setLoginStateId(features[0].id.toString()); 
      })
      .catch(err => console.error("Map Data Error:", err));
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      if (!auth) {
        setUser({ uid: 'local-dev-user' } as User);
        setLoading(false);
        return;
      }
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        setUser({ uid: 'local-dev-user' } as User); 
        setLoading(false);
      }
    };
    initAuth();
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        if (u) setUser(u);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    if ((view === 'manager-portal' || view === 'engineer-portal' || view === 'dashboard') && selectedState) {
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
          lat, lon,
          location: `Sector ${Math.floor(Math.random() * 99 + 1)}`,
          currentLoadMW: initialLoad,
          maxCapacityMW: initialCapacity,
          status: 'stable',
          voltage: 132 + Math.floor(Math.random() * 10),
          logs: [
            { id: `init-${i}`, timestamp: new Date(), message: 'Telemetry Sync Established', type: 'info' }
          ]
        };
      });
      setSubstations(generatedSubs);
      setSelectedSubstationId(generatedSubs[0].id);
    }
  }, [view, selectedState]);

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

  useEffect(() => {
    if (view.includes('login') || view === 'map') return;
    
    const interval = setInterval(() => {
      if (substations.length > 0) {
        let newlyTriggeredAlerts: AppAlert[] = [];
        setSubstations(prev => prev.map(sub => {
          const loadFluctuation = Math.floor((Math.random() - 0.5) * 8);
          let newLoad = Math.max(10, Math.min(sub.maxCapacityMW + 10, sub.currentLoadMW + loadFluctuation));
          
          const loadPercentage = (newLoad / sub.maxCapacityMW) * 100;
          let newStatus: 'stable' | 'warning' | 'critical' = sub.status;
          let newLogs = [...sub.logs];
          
          if (loadPercentage >= 85 && sub.status === 'stable') {
              newStatus = 'critical';
              newLogs.unshift({
                  id: Math.random().toString(),
                  timestamp: new Date(),
                  message: `CRITICAL: Load exceeded safe threshold (${loadPercentage.toFixed(1)}%)`,
                  type: 'critical'
              });
              newlyTriggeredAlerts.push({
                  id: Math.random().toString(),
                  message: `CRITICAL ALERT: ${sub.name} exceeded max capacity (${loadPercentage.toFixed(1)}%)!`,
                  type: 'critical'
              });
          } else if (loadPercentage < 80 && (sub.status === 'warning' || sub.status === 'critical')) {
              newStatus = 'stable';
              newLogs.unshift({
                  id: Math.random().toString(),
                  timestamp: new Date(),
                  message: 'Load returned to nominal levels',
                  type: 'info'
              });
          }
          if (newLogs.length > 15) newLogs = newLogs.slice(0, 15);
          return { ...sub, currentLoadMW: newLoad, status: newStatus, logs: newLogs };
        }));

        if (newlyTriggeredAlerts.length > 0 && view !== 'manager-portal') {
            setActiveAlerts(prev => [...prev, ...newlyTriggeredAlerts]);
            setTimeout(() => {
                setActiveAlerts(prev => prev.filter(a => !newlyTriggeredAlerts.find(n => n.id === a.id)));
            }, 6000);
        }
      }

      if (view === 'manager-portal' && smartMeters.length > 0) {
        setSmartMeters(prev => prev.map(meter => {
          const voltFluctuation = Math.floor((Math.random() - 0.5) * 6);
          const newVoltage = Math.max(190, Math.min(270, meter.voltage + voltFluctuation));
          let newStatus: 'normal' | 'high' | 'low' = 'normal';
          if (newVoltage > 245) newStatus = 'high';
          if (newVoltage < 215) newStatus = 'low';
          return { ...meter, voltage: newVoltage, status: newStatus, lastUpdated: new Date() };
        }));
      }

    }, 3000);

    return () => clearInterval(interval);
  }, [view, substations.length, smartMeters.length]);

  useEffect(() => {
    if (view !== 'engineer-portal') return;

    const interval = setInterval(() => {
      const isCritical = Math.random() > 0.7;
      const locations = ['Substation Delta', 'Grid Node 7', 'Main Hub Relay', 'Sector 12 Step-down'];
      const descriptions = ['Cooling Fan Failure', 'Breaker Tripped', 'Telemetry Offline', 'Voltage Spike Detected'];
      
      const newTask: EngineerTask = {
        id: `tsk-${Math.floor(Math.random() * 10000)}`,
        location: locations[Math.floor(Math.random() * locations.length)],
        description: descriptions[Math.floor(Math.random() * descriptions.length)],
        severity: isCritical ? 'critical' : 'medium',
        status: 'pending',
        timestamp: new Date()
      };

      setEngTasks(prev => [newTask, ...prev]);
      pushAlert(`NEW DISPATCH: ${newTask.description} at ${newTask.location}`, 'critical');

    }, 15000); 

    return () => clearInterval(interval);
  }, [view]);

  const updateSubstationCapacity = (id: string, newCapacity: number) => {
      setSubstations(prev => prev.map(sub => {
          if (sub.id === id) {
              const newLogs = [{
                  id: Math.random().toString(),
                  timestamp: new Date(),
                  message: `CONFIG: Max Capacity adjusted to ${newCapacity} MW`,
                  type: 'info' as const
              }, ...sub.logs].slice(0, 15);
              return { ...sub, maxCapacityMW: newCapacity, logs: newLogs };
          }
          return sub;
      }));
  };

  const handleMapStateClick = (state: StateData) => {
    setSelectedState(state);
    setView('login-admin');
  };

  const executeLogin = async (e: React.FormEvent<HTMLFormElement>, targetView: ViewState) => {
    e.preventDefault();
    
    if (targetView !== 'dashboard' && mapData) {
      const selected = mapData.find(s => s.id.toString() === loginStateId);
      if (selected) setSelectedState(selected);
    }

    if (user && db) { 
      try {
        const logRef = collection(db, 'artifacts', appId, 'users', user.uid, 'logs');
        await addDoc(logRef, {
          action: `Login successful to ${targetView}`,
          timestamp: serverTimestamp()
        });
      } catch (err) {}
    }
    setView(targetView);
  };

  const handleBack = () => {
    setView('map');
    setSelectedState(null);
    setSubstations([]);
    setSelectedSubstationId(null);
  };

  const handleResolveTask = (taskId: string) => {
    setEngTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' } : t));
    pushAlert('Fault marked as successfully resolved.', 'success');
  };

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.start || !leaveForm.end || !leaveForm.reason) return;
    
    const newLeave: LeaveRequest = {
      id: `lv-${Date.now()}`,
      engineerName: 'Ramesh Kumar', 
      startDate: leaveForm.start,
      endDate: leaveForm.end,
      reason: leaveForm.reason,
      status: 'pending',
      submittedAt: new Date()
    };
    
    setLeaveRequests([newLeave, ...leaveRequests]);
    setLeaveForm({ start: '', end: '', reason: '' });
    pushAlert('Leave application successfully submitted.', 'success');
  };

  const handleLeaveAction = (id: string, action: 'approved' | 'rejected') => {
    setLeaveRequests(prev => prev.map(lr => lr.id === id ? { ...lr, status: action } : lr));
    pushAlert(`Leave request ${action}.`, action === 'approved' ? 'success' : 'info');
  };

  const handleAddStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedState) return;

    const latRange = selectedState.maxLat - selectedState.minLat;
    const lonRange = selectedState.maxLon - selectedState.minLon;
    const lat = selectedState.minLat + latRange * (0.1 + Math.random() * 0.8);
    const lon = selectedState.minLon + lonRange * (0.1 + Math.random() * 0.8);

    const newSub: Substation = {
      id: `sub-new-${Date.now()}`,
      name: newStationName,
      lat, lon,
      location: `Sector ${Math.floor(Math.random() * 99 + 1)}`,
      currentLoadMW: 0,
      maxCapacityMW: parseInt(newStationCap) || 200,
      status: 'stable',
      voltage: 132,
      logs: [{ id: `init-new`, timestamp: new Date(), message: 'Station initialized & registered.', type: 'success' }]
    };

    setSubstations(prev => [...prev, newSub]);
    setSelectedSubstationId(newSub.id);
    setShowStationModal(false);
    setNewStationName('');
    pushAlert(`New Substation "${newStationName}" registered successfully.`, 'success');
  };

  const handleAddEngineer = (e: React.FormEvent) => {
    e.preventDefault();
    setShowEngineerModal(false);
    setNewEngName('');
    pushAlert(`Engineer "${newEngName}" successfully assigned.`, 'success');
  };

  const handleGenerateReport = () => {
    pushAlert('Gathering grid telemetry... Report generation initiated.', 'info');
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


  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#131313] text-white">
      <div className="flex flex-col items-center gap-6">
        <div className="w-8 h-8 rounded-full bg-white shadow-[0_0_20px_#ffffff] animate-pulse" />
        <p className="text-[11px] text-neutral-400 tracking-[0.2em] uppercase font-medium">Booting Kinetic System</p>
      </div>
    </div>
  );

  const selectedSubstation = substations.find(s => s.id === selectedSubstationId) || null;

  return (
    <div className="min-h-screen bg-[#131313] text-neutral-200 overflow-hidden font-sans selection:bg-white/20">
      
      {/* High-Performance 2D Flat Hover CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        .state-path {
          fill: #1c1b1b;
          stroke: rgba(255,255,255,0.05);
          stroke-width: 1px;
          transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), fill 0.2s ease, stroke 0.2s ease, filter 0.2s ease;
          will-change: transform, fill, stroke, filter;
        }
        .state-path:hover {
          fill: #201f1f;
          stroke: #ffffff;
          stroke-width: 2px;
          /* 2D Flat hover with hardware acceleration */
          transform: scale(1.01) translateZ(0); 
          filter: drop-shadow(0 0 15px rgba(255,255,255,0.15));
          z-index: 100;
        }
        .leaflet-container { background: #0e0e0e !important; font-family: inherit; }
        .leaflet-tooltip { background: #1c1b1b; border: none; color: white; border-radius: 2px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .leaflet-tooltip-top:before { border-top-color: #1c1b1b; }
      `}} />

      {/* Global Alert Toast Container */}
      <div className="fixed top-8 right-8 z-100 flex flex-col gap-4 pointer-events-none">
        <AnimatePresence>
          {activeAlerts.map(alert => {
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

      {/* DASHBOARD MODALS */}
      <AnimatePresence>
        {showStationModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-200 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-[#1c1b1b] border border-[#474747]/15 p-10 rounded-sm w-full max-w-md shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold tracking-tighter text-white">Register Node</h3>
                <button onClick={() => setShowStationModal(false)} className="text-neutral-500 hover:text-white transition-colors"><X className="w-6 h-6"/></button>
              </div>
              <form onSubmit={handleAddStation} className="space-y-6">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-widest mb-2">Designation Name</label>
                  <input type="text" required value={newStationName} onChange={(e) => setNewStationName(e.target.value)} className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none text-white transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-widest mb-2">Max Capacity (MW)</label>
                  <input type="number" required value={newStationCap} onChange={(e) => setNewStationCap(e.target.value)} className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none text-white transition-all font-mono" />
                </div>
                <button type="submit" className="w-full bg-white hover:bg-neutral-200 text-[#1a1c1c] font-bold py-4 rounded-sm transition-all tracking-tight uppercase mt-4">DEPLOY NODE</button>
              </form>
            </motion.div>
          </motion.div>
        )}
        {showEngineerModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-200 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-[#1c1b1b] border border-[#474747]/15 p-10 rounded-sm w-full max-w-md shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold tracking-tighter text-white">Assign Engineer</h3>
                <button onClick={() => setShowEngineerModal(false)} className="text-neutral-500 hover:text-white transition-colors"><X className="w-6 h-6"/></button>
              </div>
              <form onSubmit={handleAddEngineer} className="space-y-6">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-widest mb-2">Full Name</label>
                  <input type="text" required value={newEngName} onChange={(e) => setNewEngName(e.target.value)} className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none text-white transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 uppercase tracking-widest mb-2">Role Tier</label>
                  <select className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none text-white transition-all appearance-none cursor-pointer">
                     <option>Level 1 Technician</option>
                     <option>Level 2 Technician</option>
                     <option>Grid Specialist</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-white hover:bg-neutral-200 text-[#1a1c1c] font-bold py-4 rounded-sm transition-all tracking-tight uppercase mt-4">REGISTER PERSONNEL</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        
        {/* --- MAP VIEW (FLAT 2D GLOW MAP) --- */}
        {view === 'map' && (
          <motion.div 
            key="map-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(4px)' }}
            transition={{ duration: 0.8, ease: SMOOTH_EASE }}
            className="relative flex flex-col items-center justify-center h-screen p-8 overflow-hidden bg-[#131313]"
          >
            <div className="absolute top-10 left-10 z-10 flex items-start gap-6">
              <div className="p-4 bg-white text-[#1a1c1c] rounded-sm">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tighter text-white uppercase leading-none">
                  National Grid
                </h1>
                <p className="text-neutral-400 text-[11px] tracking-widest uppercase mt-2">Central Command Overview</p>
              </div>
            </div>

            <div className="absolute top-10 right-10 z-10 flex flex-col gap-4 items-end">
              <div className="text-[11px] text-neutral-500 font-medium tracking-widest uppercase mb-2">Access Protocol</div>
              
              <button 
                onClick={() => setView('login-manager')}
                className="flex items-center gap-4 px-6 py-4 rounded-sm transition-all w-64 bg-[#1c1b1b] hover:bg-[#201f1f] border border-[#474747]/15 group"
              >
                <div className="w-2 h-2 rounded-full bg-white opacity-40 group-hover:opacity-100 group-hover:shadow-[0_0_10px_#ffffff] transition-all" />
                <span className="font-bold tracking-tight text-sm uppercase text-neutral-300 group-hover:text-white">Substation Mgr</span>
              </button>

              <button 
                onClick={() => setView('login-engineer')}
                className="flex items-center gap-4 px-6 py-4 rounded-sm transition-all w-64 bg-[#1c1b1b] hover:bg-[#201f1f] border border-[#474747]/15 group"
              >
                <div className="w-2 h-2 rounded-full bg-white opacity-40 group-hover:opacity-100 group-hover:shadow-[0_0_10px_#ffffff] transition-all" />
                <span className="font-bold tracking-tight text-sm uppercase text-neutral-300 group-hover:text-white">Field Engineer</span>
              </button>
            </div>

            {/* Flat 2D Map Container */}
            <div className="relative w-full max-w-4xl lg:max-w-5xl aspect-square flex items-center justify-center mt-16">
              {mapData ? (
                <svg 
                  viewBox="0 0 800 900" 
                  className="w-full h-full overflow-visible relative z-10"
                >
                  <g>
                    {/* Surface Pass */}
                    {mapData.map((state) => (
                      <g key={`group-${state.id}`}>
                        <path
                          d={state.path}
                          className="state-path"
                          style={{ transformOrigin: `${state.centerX}px ${state.centerY}px` }}
                          onClick={() => handleMapStateClick(state)}
                        />
                        <text
                          x={state.centerX}
                          y={state.centerY}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="11"
                          className="pointer-events-none font-medium opacity-40 tracking-wider uppercase"
                        >
                          {state.name}
                        </text>
                      </g>
                    ))}
                  </g>
                </svg>
              ) : (
                <div className="flex flex-col items-center text-neutral-500 gap-6">
                  <div className="w-6 h-6 rounded-full border-2 border-t-white border-white/20 animate-spin" />
                </div>
              )}
            </div>
            
            <div className="absolute bottom-10 left-10 text-neutral-500 flex items-center gap-4 z-10">
              <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_#5d5f5f] animate-pulse" />
              <span className="text-[11px] tracking-widest uppercase">Select Region to Authorize Admin Panel</span>
            </div>
          </motion.div>
        )}

        {/* --- LOGIN VIEW --- */}
        {view.includes('login') && (
          <motion.div 
            key="login"
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, filter: 'blur(4px)' }} transition={{ duration: 0.6, ease: SMOOTH_EASE }}
            className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#131313]"
          >
            <button onClick={handleBack} className="absolute top-10 left-10 flex items-center gap-4 text-neutral-500 hover:text-white transition-colors font-medium tracking-widest uppercase text-[11px]"><ArrowLeft className="w-4 h-4"/> Abort Protocol</button>
            <div className="w-full max-w-md">
              <div className="mb-12">
                <h2 className="text-4xl font-bold text-white mb-4 tracking-tighter">
                  {view === 'login-engineer' ? 'Field Ops Login' : view === 'login-manager' ? 'Substation Terminal' : 'Admin Dispatch'}
                </h2>
                <p className="text-neutral-400 font-medium text-sm mb-4">
                  {view === 'login-engineer' ? 'Engineer Dispatch Application' : view === 'login-manager' ? 'Local Node Telemetry Access' : 'Regional Load Dispatch Center (RLDC)'}
                </p>
                {view === 'login-admin' && selectedState && <div className="inline-block px-3 py-1 bg-[#1c1b1b] text-neutral-300 font-medium tracking-widest uppercase text-[11px] rounded-sm">Target: {selectedState.name}</div>}
              </div>

              <form onSubmit={(e) => executeLogin(e, view === 'login-engineer' ? 'engineer-portal' : view === 'login-manager' ? 'manager-portal' : 'dashboard')} className="space-y-6 bg-[#1c1b1b] p-10 rounded-sm shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
                {(view === 'login-engineer' || view === 'login-manager') ? (
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">{view === 'login-engineer' ? 'Assigned Region' : 'Operating Region'}</label>
                    <select value={loginStateId} onChange={(e) => setLoginStateId(e.target.value)} className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none text-white appearance-none cursor-pointer">
                       {mapData?.map((s: StateData) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">Govt Admin ID</label>
                    <input type="text" required placeholder="ADM-7734" className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none transition-all font-mono text-white placeholder:text-neutral-600" />
                  </div>
                )}

                {(view === 'login-engineer' || view === 'login-manager') ? (
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">{view === 'login-engineer' ? 'Technician Badge' : 'Station Master ID'}</label>
                    <input type="text" required placeholder={view === 'login-engineer' ? "ENG-884" : "MGR-102"} className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none transition-all font-mono text-white placeholder:text-neutral-600" />
                  </div>
                ) : null}

                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">{view === 'login-engineer' ? 'Auth PIN' : 'Security Clearance Key'}</label>
                  <input type="password" required placeholder="••••••••" className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none transition-all text-white placeholder:text-neutral-600" />
                </div>
                
                <button type="submit" className="w-full text-[#1a1c1c] font-bold py-4 rounded-sm bg-white hover:bg-neutral-200 transition-all tracking-tight uppercase mt-6">
                  {view === 'login-engineer' ? 'Clock In' : view === 'login-manager' ? 'Access Terminal' : 'Initiate Session'}
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {/* --- REGIONAL ADMIN DASHBOARD VIEW --- */}
        {view === 'dashboard' && (
          <motion.div 
            key="dashboard-view"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
            className="min-h-screen bg-[#131313] flex"
          >
            <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.1, ease: SMOOTH_EASE }} className="w-20 lg:w-72 bg-[#1c1b1b] flex flex-col p-8 shrink-0 z-20">
              <div className="flex items-center gap-6 mb-16">
                <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_12px_#ffffff] shrink-0" />
                <div className="hidden lg:block">
                  <span className="font-bold text-xl tracking-tighter text-white block">RLDC Admin</span>
                  <span className="text-[11px] text-neutral-500 font-medium tracking-widest uppercase mt-1 block">{selectedState?.name}</span>
                </div>
              </div>
              <nav className="flex-1 space-y-4">
                <button className="flex items-center gap-4 text-white font-bold text-sm tracking-tight uppercase w-full"><span className="w-1.5 h-1.5 bg-white rounded-full" /> Geographic Mapping</button>
                <button className="flex items-center gap-4 text-neutral-500 hover:text-white transition-colors font-medium text-sm tracking-tight uppercase w-full pl-5.5">Load Analytics</button>
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
                    <span className="text-[11px] font-medium tracking-widest uppercase text-neutral-400">Uplink Secured</span>
                  </div>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 shrink-0">
                <div className="bg-[#1c1b1b] p-8 rounded-sm"><p className="text-[11px] text-neutral-500 mb-4 font-medium uppercase tracking-widest">Regional Load</p><h4 className="text-4xl font-bold tracking-tighter text-white mb-6">{selectedState?.load}%</h4><div className="h-1 w-full bg-[#0e0e0e] rounded-sm overflow-hidden"><div className="h-full bg-white w-[65%]" /></div></div>
                <div className="bg-[#1c1b1b] p-8 rounded-sm"><p className="text-[11px] text-neutral-500 mb-4 font-medium uppercase tracking-widest">Active Nodes</p><h4 className="text-4xl font-bold tracking-tighter text-white mb-6">{substations.length}</h4><div className="h-1 w-full bg-[#0e0e0e] rounded-sm overflow-hidden"><div className="h-full bg-white w-full" /></div></div>
                <div className="bg-[#1c1b1b] p-8 rounded-sm"><p className="text-[11px] text-neutral-500 mb-4 font-medium uppercase tracking-widest">Warnings</p><h4 className={`text-4xl font-bold tracking-tighter mb-6 ${substations.some((s:any) => s.status === 'warning' || s.status === 'critical') ? 'text-red-500' : 'text-white'}`}>{substations.filter((s:any) => s.status === 'warning' || s.status === 'critical').length.toString().padStart(2, '0')}</h4><div className="h-1 w-full bg-[#0e0e0e] rounded-sm overflow-hidden"><div className={`h-full ${substations.some((s:any) => s.status === 'warning' || s.status === 'critical') ? 'bg-red-500 w-full' : 'bg-white w-[5%]'}`} /></div></div>
              </div>

              <div className="flex-1 min-h-125 grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 bg-[#0e0e0e] rounded-sm flex flex-col relative overflow-hidden min-h-125 p-1 border border-[#474747]/15">
                  <div className="absolute top-6 left-6 z-20 pointer-events-none"><h3 className="text-[11px] font-medium tracking-widest uppercase text-neutral-400">Tactical GIS Mapping</h3></div>
                  {leafletReady && selectedState ? <LeafletMap selectedState={selectedState} substations={substations} selectedSubstationId={selectedSubstationId} onSelectSubstation={setSelectedSubstationId} /> : <div className="w-full h-full flex items-center justify-center text-neutral-500"><Activity className="w-6 h-6 animate-spin text-neutral-600"/></div>}
                </div>
                <div className="xl:col-span-1 flex flex-col h-full bg-[#1c1b1b] rounded-sm overflow-hidden relative">
                  <AnimatePresence mode="wait">
                    {selectedSubstation ? (
                      <motion.div key={selectedSubstation.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col p-8 overflow-y-auto">
                        <div className="flex items-start justify-between mb-8 shrink-0">
                          <div>
                            <div className="text-[11px] text-neutral-500 tracking-widest uppercase mb-2">Selected Node</div>
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
                          <div className="flex justify-between text-[11px] mb-4 font-medium text-neutral-400 uppercase tracking-widest"><span>Output Load</span><span className={`${selectedSubstation.status === 'critical' ? 'text-red-500' : 'text-white'}`}>{selectedSubstation.currentLoadMW} MW</span></div>
                          <div className="h-1 bg-[#1c1b1b] rounded-sm overflow-hidden relative"><div className="absolute top-0 bottom-0 left-[85%] w-px bg-[#474747] z-10"></div><motion.div animate={{ width: `${Math.min((selectedSubstation.currentLoadMW / selectedSubstation.maxCapacityMW) * 100, 100)}%` }} className={`h-full ${selectedSubstation.status === 'critical' ? 'bg-red-500' : 'bg-white'}`} /></div>
                        </div>
                        <div className="bg-[#0e0e0e] p-6 rounded-sm shrink-0 mb-6">
                            <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-widest mb-4">Safe Capacity Limit</h4>
                            <input type="range" min="50" max="500" step="10" value={selectedSubstation.maxCapacityMW} onChange={(e) => updateSubstationCapacity(selectedSubstation.id, parseInt(e.target.value))} className="w-full h-1 bg-[#1c1b1b] rounded-sm appearance-none cursor-pointer accent-white" />
                            <div className="flex justify-between text-xs text-neutral-500 font-mono mt-4"><span>50 MW</span><span className="text-white">{selectedSubstation.maxCapacityMW} MW</span><span>500 MW</span></div>
                        </div>
                        <div className="bg-[#0e0e0e] p-6 rounded-sm flex-1 flex flex-col min-h-50">
                            <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-widest mb-4">Terminal Logs</h4>
                            <div className="space-y-4 overflow-y-auto pr-2 flex-1">
                                {selectedSubstation.logs.map((log:any) => (
                                    <div key={log.id} className="flex flex-col"><p className={`text-sm leading-relaxed mb-1 ${log.type === 'critical' ? 'text-red-400 font-medium' : log.type === 'success' ? 'text-white' : 'text-neutral-400'}`}>{log.message}</p><span className="text-neutral-600 font-mono text-[10px]">{log.timestamp.toLocaleTimeString()}</span></div>
                                ))}
                            </div>
                        </div>
                      </motion.div>
                    ) : <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-500 p-8"><p className="text-[11px] uppercase tracking-widest font-medium">Select a node</p></div>}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* --- MANAGER PORTAL VIEW --- */}
        {view === 'manager-portal' && (
          <motion.div 
            key="manager-portal-view"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
            className="min-h-screen bg-[#131313] flex"
          >
            <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.1, ease: SMOOTH_EASE }} className="w-20 lg:w-72 bg-[#1c1b1b] flex flex-col p-8 shrink-0 z-20">
              <div className="flex items-center gap-6 mb-16">
                <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_12px_#ffffff] shrink-0" />
                <div className="hidden lg:block"><span className="font-bold text-xl tracking-tighter text-white block">Substation Mgr</span><span className="text-[11px] text-neutral-500 font-medium tracking-widest uppercase mt-1 block">Local Control</span></div>
              </div>
              <nav className="flex-1 space-y-4">
                <button onClick={() => setManagerTab('overview')} className={`flex items-center gap-4 font-bold text-sm tracking-tight uppercase w-full ${managerTab === 'overview' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-5.5'}`}>{managerTab === 'overview' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />} Overview</button>
                <button onClick={() => setManagerTab('meters')} className={`flex items-center gap-4 font-bold text-sm tracking-tight uppercase w-full ${managerTab === 'meters' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-5.5'}`}>{managerTab === 'meters' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />} Meter Telemetry</button>
                <button onClick={() => setManagerTab('leave-approvals')} className={`flex items-center justify-between font-bold text-sm tracking-tight uppercase w-full ${managerTab === 'leave-approvals' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-5.5'}`}>
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
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_#ffffff]"></div>
                    <span className="text-[11px] font-medium tracking-widest uppercase text-neutral-400">Uplink Secured</span>
                  </div>
                </div>
              </header>

              {managerTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                   <div className="bg-[#1c1b1b] rounded-sm p-8"><p className="text-[11px] text-neutral-500 font-medium uppercase tracking-widest mb-4">Node Health</p><div className="text-4xl font-bold tracking-tighter text-white mb-2">{substations[0]?.currentLoadMW || 0} <span className="text-xl text-neutral-500 tracking-normal">MW</span></div></div>
                   <div className="bg-[#1c1b1b] rounded-sm p-8"><p className="text-[11px] text-neutral-500 font-medium uppercase tracking-widest mb-4">Connected Smart Meters</p><div className="text-4xl font-bold tracking-tighter text-white mb-2">{smartMeters.length} <span className="text-xl text-neutral-500 tracking-normal">Units</span></div></div>
                </div>
              )}

              {managerTab === 'overview' && (
                <div className="flex-1 min-h-125 grid grid-cols-1 xl:grid-cols-3 gap-8">
                  <div className="xl:col-span-2 bg-[#0e0e0e] rounded-sm flex flex-col relative overflow-hidden min-h-125 p-1 border border-[#474747]/15">
                    <div className="absolute top-6 left-6 z-20 pointer-events-none"><h3 className="text-[11px] font-medium tracking-widest uppercase text-neutral-400">Tactical GIS Mapping</h3></div>
                    {leafletReady && selectedState ? <LeafletMap selectedState={selectedState} substations={substations} selectedSubstationId={selectedSubstationId} onSelectSubstation={setSelectedSubstationId} /> : <div className="w-full h-full flex items-center justify-center text-neutral-500"><Activity className="w-6 h-6 animate-spin"/></div>}
                  </div>
                  <div className="xl:col-span-1 flex flex-col h-full bg-[#1c1b1b] rounded-sm overflow-hidden relative">
                    <AnimatePresence mode="wait">
                      {selectedSubstation ? (
                        <motion.div key={selectedSubstation.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col p-8 overflow-y-auto">
                          <div className="flex items-start justify-between mb-8 shrink-0">
                            <div>
                              <div className="text-[11px] text-neutral-500 tracking-widest uppercase mb-2">Selected Node</div>
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
                            <div className="flex justify-between text-[11px] mb-4 font-medium text-neutral-400 uppercase tracking-widest"><span>Output Load</span><span className={`${selectedSubstation.status === 'critical' ? 'text-red-500' : 'text-white'}`}>{selectedSubstation.currentLoadMW} MW</span></div>
                            <div className="h-1 bg-[#1c1b1b] rounded-sm overflow-hidden relative"><div className="absolute top-0 bottom-0 left-[85%] w-px bg-[#474747] z-10"></div><motion.div animate={{ width: `${Math.min((selectedSubstation.currentLoadMW / selectedSubstation.maxCapacityMW) * 100, 100)}%` }} className={`h-full ${selectedSubstation.status === 'critical' ? 'bg-red-500' : 'bg-white'}`} /></div>
                          </div>
                          <div className="bg-[#0e0e0e] p-6 rounded-sm shrink-0 mb-6">
                              <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-widest mb-4">Safe Capacity Limit</h4>
                              <input type="range" min="50" max="500" step="10" value={selectedSubstation.maxCapacityMW} onChange={(e) => updateSubstationCapacity(selectedSubstation.id, parseInt(e.target.value))} className="w-full h-1 bg-[#1c1b1b] rounded-sm appearance-none cursor-pointer accent-white" />
                              <div className="flex justify-between text-xs text-neutral-500 font-mono mt-4"><span>50 MW</span><span className="text-white">{selectedSubstation.maxCapacityMW} MW</span><span>500 MW</span></div>
                          </div>
                        </motion.div>
                      ) : <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-500 p-8"><p className="text-[11px] uppercase tracking-widest font-medium">Select a node</p></div>}
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
                        <tr className="text-neutral-500 text-[11px] font-medium uppercase tracking-widest">
                          <th className="p-4 font-normal">Meter ID</th><th className="p-4 font-normal">Address</th><th className="p-4 font-normal">Voltage</th><th className="p-4 font-normal">Status</th><th className="p-4 font-normal text-right">Last Ping</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {smartMeters.map((meter:any, index:number) => (
                          <tr key={meter.id} className={index % 2 === 0 ? 'bg-[#0e0e0e]' : 'bg-[#131313]'}>
                            <td className="p-4 font-mono text-neutral-300">{meter.id}</td><td className="p-4 text-neutral-400">{meter.houseAddress}</td>
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

              {managerTab === 'leave-approvals' && (
                <div className="bg-[#1c1b1b] rounded-sm p-8">
                  <h3 className="text-2xl font-bold tracking-tighter text-white mb-8">Pending Leave Approvals</h3>
                  <div className="space-y-6">
                    {leaveRequests.length === 0 ? <p className="text-neutral-500 text-sm">No leave requests currently in system.</p> : leaveRequests.map((req:any) => (
                        <div key={req.id} className="bg-[#0e0e0e] p-8 rounded-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                          <div>
                            <div className="flex items-center gap-4 mb-3"><h4 className="text-white font-bold text-lg">{req.engineerName}</h4><span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">{req.status}</span></div>
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
        )}

        {/* --- ENGINEER PORTAL VIEW --- */}
        {view === 'engineer-portal' && (
          <motion.div 
            key="engineer-portal-view"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
            className="min-h-screen bg-[#131313] flex"
          >
            <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.1, ease: SMOOTH_EASE }} className="w-20 lg:w-72 bg-[#1c1b1b] flex flex-col p-8 shrink-0 z-20">
              <div className="flex items-center gap-6 mb-16">
                <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_12px_#ffffff] shrink-0" />
                <div className="hidden lg:block"><span className="font-bold text-xl tracking-tighter text-white block">Field Ops</span><span className="text-[11px] text-neutral-500 font-medium tracking-widest uppercase mt-1 block">Engineer Portal</span></div>
              </div>
              <nav className="flex-1 space-y-4">
                <button onClick={() => setEngTab('inbox')} className={`flex justify-between items-center font-bold text-sm tracking-tight uppercase w-full ${engTab === 'inbox' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-5.5'}`}>
                  <div className="flex items-center gap-4">{engTab === 'inbox' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />} Fault Inbox</div>
                  {engTasks.filter((t:any) => t.status === 'pending').length > 0 && <span className="text-[10px] bg-white text-black px-2 py-0.5 rounded-sm">{engTasks.filter((t:any) => t.status === 'pending').length}</span>}
                </button>
                <button onClick={() => setEngTab('profile')} className={`flex items-center gap-4 font-bold text-sm tracking-tight uppercase w-full ${engTab === 'profile' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-5.5'}`}>{engTab === 'profile' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />} My Profile</button>
                <button onClick={() => setEngTab('leave')} className={`flex items-center gap-4 font-bold text-sm tracking-tight uppercase w-full ${engTab === 'leave' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-5.5'}`}>{engTab === 'leave' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />} Leave Application</button>
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
                      <div><h2 className="text-4xl font-bold tracking-tighter text-white mb-2">Ramesh Kumar</h2><p className="text-neutral-500 font-mono text-sm mb-4">ENG-ID: 884-XTR-9</p><span className="text-white text-[11px] font-bold uppercase tracking-widest">Level 3 Technician</span></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-[#474747]/15 pt-12">
                      <div className="space-y-6">
                        <div><p className="text-[11px] text-neutral-500 font-medium tracking-widest uppercase mb-1">Department</p><p className="text-white text-sm">High Voltage Transmissions</p></div>
                        <div><p className="text-[11px] text-neutral-500 font-medium tracking-widest uppercase mb-1">Base Station</p><p className="text-white text-sm">{selectedState?.name || 'Local'} Grid</p></div>
                      </div>
                      <div className="space-y-6">
                         <div className="bg-[#0e0e0e] p-6 rounded-sm"><span className="block text-[11px] text-neutral-500 font-medium tracking-widest uppercase mb-2">Faults Resolved</span><span className="text-3xl font-bold tracking-tighter text-white">142</span></div>
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
                        <div><label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-2">Start Date</label><input type="date" required value={leaveForm.start} onChange={e=>setLeaveForm({...leaveForm, start: e.target.value})} className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 text-white outline-none" /></div>
                        <div><label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-2">End Date</label><input type="date" required value={leaveForm.end} onChange={e=>setLeaveForm({...leaveForm, end: e.target.value})} className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 text-white outline-none" /></div>
                      </div>
                      <div><label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-2">Reason</label><textarea required rows={4} value={leaveForm.reason} onChange={e=>setLeaveForm({...leaveForm, reason: e.target.value})} className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 text-white outline-none resize-none"></textarea></div>
                      <button type="submit" className="w-full bg-white hover:bg-neutral-200 text-[#1a1c1c] font-bold py-4 rounded-sm transition-all tracking-tight uppercase mt-4">Submit Request</button>
                    </form>
                  </div>
                  <div className="bg-[#1c1b1b] rounded-sm p-10 flex flex-col">
                    <h3 className="text-2xl font-bold tracking-tighter text-white mb-8 border-b border-[#474747]/15 pb-6">Leave History</h3>
                    <div className="space-y-6 overflow-y-auto flex-1 pr-2">
                      {leaveRequests.map((leave:any) => (
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
        )}
      </AnimatePresence>
    </div>
  );
}