"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  MapPin, 
  Lock, 
  ChevronRight, 
  ChevronLeft,
  Activity, 
  AlertCircle,
  Database,
  ArrowLeft,
  Settings,
  LogOut,
  User as UserIcon,
  Radio,
  Cpu,
  Landmark,
  BarChart3,
  Globe,
  SlidersHorizontal,
  TerminalSquare,
  Wrench,
  Mail,
  UserCheck,
  CalendarDays,
  CheckCircle,
  Clock,
  Briefcase,
  HardHat,
  PlusCircle,
  UserPlus,
  FileText,
  X,
  CheckCircle2,
  Info,
  Home,
  Zap,
  XSquare,
  Server
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';

// --- Global Type Declarations ---
declare global {
  var __firebase_config: string | undefined;
  var __app_id: string | undefined;
  var __initial_auth_token: string | undefined;
  interface Window {
    L: any; // Leaflet Global
  }
}

// --- Firebase Configuration ---
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
  console.warn("Firebase configuration not found. Running in local mock mode.");
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'india-power-grid-001';

// --- Types & Interfaces ---
type ViewState = 'map' | 'login-admin' | 'login-manager' | 'login-engineer' | 'dashboard' | 'manager-portal' | 'engineer-portal';

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

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'success';
}

interface Substation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  location: string;
  currentLoadMW: number;
  maxCapacityMW: number;
  status: 'stable' | 'warning';
  voltage: number;
  logs: LogEntry[];
}

interface EngineerTask {
  id: string;
  location: string;
  description: string;
  severity: 'low' | 'medium' | 'critical';
  status: 'pending' | 'completed';
  timestamp: Date;
}

interface LeaveRequest {
  id: string;
  engineerName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
}

interface AppAlert {
  id: string;
  message: string;
  type: 'critical' | 'success' | 'info';
}

interface SmartMeter {
  id: string;
  houseAddress: string;
  voltage: number;
  status: 'normal' | 'high' | 'low';
  lastUpdated: Date;
}

const SMOOTH_EASE = [0.22, 1, 0.36, 1];

// --- Leaflet Component (Actual Map Engine) ---
const LeafletMap = ({ selectedState, substations, selectedSubstationId, onSelectSubstation }: any) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});

  useEffect(() => {
    if (!mapRef.current || !window.L || mapInstance.current) return;

    const map = window.L.map(mapRef.current, { zoomControl: false }).fitBounds([
      [selectedState.minLat, selectedState.minLon],
      [selectedState.maxLat, selectedState.maxLon]
    ]);

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [selectedState]);

  useEffect(() => {
    if (!mapInstance.current || !window.L) return;

    substations.forEach((sub: Substation) => {
      const color = sub.status === 'warning' ? '#f59e0b' : '#3b82f6'; 
      const isSelected = sub.id === selectedSubstationId;
      const size = isSelected ? 36 : 24; 

      const html = `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px ${color}; opacity: ${isSelected ? 1 : 0.8}; transition: all 0.3s; cursor: pointer;"></div>`;

      const icon = window.L.divIcon({
        html,
        className: '', 
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });

      if (markersRef.current[sub.id]) {
        markersRef.current[sub.id].setIcon(icon);
      } else {
        const marker = window.L.marker([sub.lat, sub.lon], { icon }).addTo(mapInstance.current);
        marker.on('click', () => onSelectSubstation(sub.id));
        marker.bindTooltip(`<b>${sub.name}</b><br/>${sub.currentLoadMW} MW`, { direction: 'top', offset: [0, -10] });
        markersRef.current[sub.id] = marker;
      }
    });

    if (selectedSubstationId && markersRef.current[selectedSubstationId]) {
       const sub = substations.find(s => s.id === selectedSubstationId);
       if (sub) {
           mapInstance.current.flyTo([sub.lat, sub.lon], Math.max(mapInstance.current.getZoom(), 8), { animate: true, duration: 1 });
       }
    }
  }, [substations, selectedSubstationId, onSelectSubstation]);

  return <div ref={mapRef} className="w-full h-full z-0" />;
};


// --- Main Application ---
export default function App() {
  const [view, setView] = useState<ViewState>('map');
  const [selectedState, setSelectedState] = useState<StateData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [mapData, setMapData] = useState<StateData[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [leafletReady, setLeafletReady] = useState(false);
  
  // Independent Login State Selection
  const [loginStateId, setLoginStateId] = useState<string>('');

  // Portals Shared State
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [selectedSubstationId, setSelectedSubstationId] = useState<string | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<AppAlert[]>([]); 

  // Modals
  const [showStationModal, setShowStationModal] = useState(false);
  const [showEngineerModal, setShowEngineerModal] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [newStationCap, setNewStationCap] = useState('200');
  const [newEngName, setNewEngName] = useState('');

  // Shared Leave Requests (Between Engineer and Manager)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([
    { id: 'lv-001', engineerName: 'Ramesh Kumar', startDate: '2026-04-10', endDate: '2026-04-12', reason: 'Family medical emergency', status: 'pending', submittedAt: new Date(Date.now() - 86400000) }
  ]);

  // Engineer Portal Specific State
  const [engTab, setEngTab] = useState<'inbox' | 'profile' | 'leave'>('inbox');
  const [engTasks, setEngTasks] = useState<EngineerTask[]>([
    { id: 'tsk-001', location: 'Substation Alpha', description: 'Transformer Oil Temp Critical', severity: 'critical', status: 'pending', timestamp: new Date(Date.now() - 3600000) },
    { id: 'tsk-002', location: 'Sector 42 Relay', description: 'Phase B Voltage Drop', severity: 'medium', status: 'pending', timestamp: new Date(Date.now() - 7200000) },
  ]);
  const [leaveForm, setLeaveForm] = useState({ start: '', end: '', reason: '' });

  // Manager Portal Specific State
  const [managerTab, setManagerTab] = useState<'overview' | 'meters' | 'leave-approvals'>('overview');
  const [smartMeters, setSmartMeters] = useState<SmartMeter[]>([]);

  const pushAlert = (message: string, type: 'critical' | 'success' | 'info') => {
    const id = Math.random().toString();
    setActiveAlerts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setActiveAlerts(prev => prev.filter(a => a.id !== id));
    }, 5000);
  };

  // Dynamically Load Leaflet.js
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

  // Fetch Geographical Map Data
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
        
        // Sort alphabetically for dropdowns
        features.sort((a, b) => a.name.localeCompare(b.name));
        setMapData(features);
        setLoginStateId(features[0].id.toString()); // Default selected state
      })
      .catch(err => console.error("Map Data Error:", err));
  }, []);

  // Auth Initialization
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

  // Generate Substation Data once State is Selected
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

  // Generate Smart Meter Data for Manager Portal
  useEffect(() => {
    if (view === 'manager-portal') {
      const meters: SmartMeter[] = Array.from({ length: 15 }).map((_, i) => {
        const voltage = 210 + Math.floor(Math.random() * 50); // 210 to 260
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

  // Real-time Data Simulation for Substations & Smart Meters
  useEffect(() => {
    if (view.includes('login') || view === 'map') return;
    
    const interval = setInterval(() => {
      // Simulate Substation Load Fluctuation
      if (substations.length > 0) {
        let newlyTriggeredAlerts: AppAlert[] = [];
        setSubstations(prev => prev.map(sub => {
          const loadFluctuation = Math.floor((Math.random() - 0.5) * 8);
          let newLoad = Math.max(10, Math.min(sub.maxCapacityMW + 10, sub.currentLoadMW + loadFluctuation));
          
          const loadPercentage = (newLoad / sub.maxCapacityMW) * 100;
          let newStatus: 'stable' | 'warning' = sub.status;
          let newLogs = [...sub.logs];
          
          if (loadPercentage >= 85 && sub.status === 'stable') {
              newStatus = 'warning';
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
          } else if (loadPercentage < 80 && sub.status === 'warning') {
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

      // Simulate Smart Meter Voltage Fluctuation
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

  // Simulate Auto-Assignment of Faults to Engineer
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

    }, 15000); // New fault every 15 seconds for demonstration

    return () => clearInterval(interval);
  }, [view]);

  const updateSubstationCapacity = (id: string, newCapacity: number) => {
      setSubstations(prev => prev.map(sub => {
          if (sub.id === id) {
              const newLogs = [{
                  id: Math.random().toString(),
                  timestamp: new Date(),
                  message: `CONFIG: Max Capacity physically scaled to ${newCapacity} MW`,
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

  // Unified Login Handler for all 3 Portals
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
    pushAlert(`Engineer "${newEngName}" successfully assigned to region.`, 'success');
  };

  const handleGenerateReport = () => {
    pushAlert('Gathering grid telemetry... Report generation initiated.', 'info');
  };

  // Node Navigation Arrow Handlers
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
    <div className="flex items-center justify-center h-screen bg-[#020617] text-white">
      <div className="flex flex-col items-center gap-4">
        <Activity className="w-12 h-12 text-sky-500 animate-spin" />
        <p className="text-sky-500 text-sm tracking-widest uppercase font-bold">Initializing Grid Access</p>
      </div>
    </div>
  );

  const selectedSubstation = substations.find(s => s.id === selectedSubstationId) || null;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 overflow-hidden font-sans selection:bg-sky-500/30">
      
      {/* 120 FPS High-Performance Native CSS Styles for the Map */}
      <style dangerouslySetInnerHTML={{__html: `
        .state-path {
          fill: rgba(15, 23, 42, 0.7);
          stroke: #0284c7;
          stroke-width: 1px;
          transition: transform 0.15s ease-out, fill 0.15s ease-out, stroke 0.15s ease-out, stroke-width 0.15s ease-out;
          will-change: transform, fill, stroke;
        }
        .state-path:hover {
          fill: rgba(7, 89, 133, 0.8);
          stroke: #7dd3fc;
          stroke-width: 2.5px;
          /* translateZ(0) forces GPU Hardware Acceleration, eliminating all rendering lag */
          transform: scale(1.02) translateZ(0); 
        }
        .leaflet-container { background: #020617 !important; font-family: inherit; }
        .leaflet-tooltip { background: rgba(15,23,42,0.9); border: 1px solid #1e293b; color: white; border-radius: 8px; backdrop-filter: blur(4px); }
        .leaflet-tooltip-top:before { border-top-color: #1e293b; }
      `}} />

      {/* Global Alert Toast Container */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {activeAlerts.map(alert => {
            const isCritical = alert.type === 'critical';
            const isSuccess = alert.type === 'success';
            const Icon = isCritical ? AlertCircle : isSuccess ? CheckCircle2 : Info;
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, x: 20 }}
                className={`border backdrop-blur-md p-4 rounded-xl flex items-start gap-3 w-80 pointer-events-auto shadow-2xl ${
                  isCritical ? 'bg-red-950/90 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 
                  isSuccess ? 'bg-emerald-950/90 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 
                  'bg-sky-950/90 border-sky-500/50 shadow-[0_0_20px_rgba(14,165,233,0.4)]'
                }`}
              >
                <Icon className={`w-6 h-6 shrink-0 mt-0.5 ${
                  isCritical ? 'text-red-500' : isSuccess ? 'text-emerald-500' : 'text-sky-500'
                }`} />
                <div>
                  <h4 className={`font-bold text-sm tracking-wide uppercase ${
                    isCritical ? 'text-red-500' : isSuccess ? 'text-emerald-500' : 'text-sky-500'
                  }`}>
                    {isCritical ? 'Grid Alert' : isSuccess ? 'Success' : 'System Info'}
                  </h4>
                  <p className={`text-xs mt-1 leading-relaxed ${
                    isCritical ? 'text-red-200' : isSuccess ? 'text-emerald-200' : 'text-sky-200'
                  }`}>{alert.message}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* DASHBOARD MODALS (Admin) */}
      <AnimatePresence>
        {showStationModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-[#0f172a] border border-sky-900/50 p-8 rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2"><PlusCircle className="w-5 h-5 text-sky-500"/> Register Substation</h3>
                <button onClick={() => setShowStationModal(false)} className="text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
              </div>
              <form onSubmit={handleAddStation} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Station Designation Name</label>
                  <input type="text" required value={newStationName} onChange={(e) => setNewStationName(e.target.value)} placeholder="e.g. Sector 12 Hub" className="w-full bg-[#020617] border border-slate-700/50 rounded-xl py-3 px-4 focus:ring-2 focus:ring-sky-500 outline-none text-slate-200" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Max Safe Capacity (MW)</label>
                  <input type="number" required value={newStationCap} onChange={(e) => setNewStationCap(e.target.value)} placeholder="200" className="w-full bg-[#020617] border border-slate-700/50 rounded-xl py-3 px-4 focus:ring-2 focus:ring-sky-500 outline-none text-slate-200 font-mono" />
                </div>
                <button type="submit" className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(14,165,233,0.4)] mt-4 uppercase tracking-wide">Deploy Node</button>
              </form>
            </motion.div>
          </motion.div>
        )}
        {showEngineerModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-[#0f172a] border border-emerald-900/50 p-8 rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2"><UserPlus className="w-5 h-5 text-emerald-500"/> Assign Engineer</h3>
                <button onClick={() => setShowEngineerModal(false)} className="text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
              </div>
              <form onSubmit={handleAddEngineer} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Engineer Full Name</label>
                  <input type="text" required value={newEngName} onChange={(e) => setNewEngName(e.target.value)} placeholder="e.g. Ramesh Kumar" className="w-full bg-[#020617] border border-slate-700/50 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-200" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Role / Title</label>
                  <select className="w-full bg-[#020617] border border-slate-700/50 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-200">
                     <option>Level 1 Technician</option>
                     <option>Level 2 Technician</option>
                     <option>Grid Specialist</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] mt-4 uppercase tracking-wide">Register to Region</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        
        {/* --- MAP VIEW (HIGH-PERFORMANCE TACTICAL 2D MAP - 120 FPS) --- */}
        {view === 'map' && (
          <motion.div 
            key="map-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(8px)' }}
            transition={{ duration: 0.6, ease: SMOOTH_EASE }}
            className="relative flex flex-col items-center justify-center h-screen p-6 overflow-hidden bg-[#020617]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-900/20 via-[#020617] to-[#020617] pointer-events-none" />

            <div className="absolute top-8 left-8 z-10">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-sky-600/20 rounded-xl border border-sky-500/50 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.3)]">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight uppercase text-white">
                    National Power Grid
                  </h1>
                  <p className="text-sky-400 text-xs font-bold tracking-[0.2em] uppercase">Central Command Overview</p>
                </div>
              </div>
            </div>

            {/* Completely Separated Portal Access Buttons */}
            <div className="absolute top-8 right-8 z-10 flex gap-4">
              <button 
                onClick={() => setView('login-manager')}
                className="flex items-center gap-2 bg-[#0f172a] text-slate-300 hover:text-purple-400 px-5 py-3 rounded-xl shadow-lg border border-slate-700/50 hover:border-purple-500/50 transition-all group"
              >
                <Cpu className="w-4 h-4 text-purple-500" />
                <span className="font-bold tracking-wider text-xs uppercase">Substation Portal</span>
              </button>

              <button 
                onClick={() => setView('login-engineer')}
                className="flex items-center gap-2 bg-[#0f172a] text-slate-300 hover:text-amber-400 px-5 py-3 rounded-xl shadow-lg border border-slate-700/50 hover:border-amber-500/50 transition-all group"
              >
                <HardHat className="w-4 h-4 text-amber-500" />
                <span className="font-bold tracking-wider text-xs uppercase">Engineer Portal</span>
              </button>
            </div>

            <div className="relative w-full max-w-4xl lg:max-w-5xl aspect-square flex items-center justify-center mt-12">
              {mapData ? (
                <svg viewBox="0 0 800 900" className="w-full h-full overflow-visible relative z-10">
                  <g>
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
                          fill="#bae6fd"
                          fontSize="11"
                          className="pointer-events-none font-semibold opacity-60"
                        >
                          {state.name}
                        </text>
                      </g>
                    ))}
                  </g>
                </svg>
              ) : (
                <div className="flex flex-col items-center animate-pulse text-slate-500">
                  <Globe className="w-12 h-12 mb-4 text-sky-500" />
                  <p className="tracking-widest uppercase text-sm font-bold">Rendering Grid...</p>
                </div>
              )}
            </div>
            
            <div className="absolute bottom-8 text-slate-400 flex items-center gap-2 z-10 bg-[#0f172a]/80 px-5 py-3 rounded-full border border-slate-700/50 shadow-lg animate-bounce">
              <MapPin className="w-4 h-4 text-sky-500" />
              <span className="text-xs font-bold tracking-widest uppercase">Click Regional State to Authorize Admin Panel</span>
            </div>
          </motion.div>
        )}

        {/* --- 1. LOGIN VIEW: ADMIN DISPATCH (Map Click) --- */}
        {view === 'login-admin' && (
          <motion.div 
            key="login-admin"
            initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }} transition={{ duration: 0.6, ease: SMOOTH_EASE }}
            className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#020617]"
          >
            <button onClick={handleBack} className="absolute top-8 left-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-medium tracking-wide uppercase text-sm"><ArrowLeft className="w-5 h-5"/> Return</button>
            <div className="w-full max-w-md relative z-10">
              <div className="mb-10 text-center">
                <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-2xl border border-sky-400/30 bg-sky-900/50">
                  <ShieldCheck className="w-10 h-10 text-sky-400" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Admin Dispatch</h2>
                <p className="text-slate-400 font-medium text-sm">Regional Load Dispatch Center (RLDC)</p>
                {selectedState && <div className="mt-3 inline-block px-3 py-1 bg-slate-800 border border-slate-700 rounded-md text-slate-300 font-bold tracking-widest uppercase text-[10px]">REGION: {selectedState.name}</div>}
              </div>
              <form onSubmit={(e) => executeLogin(e, 'dashboard')} className="space-y-5 bg-[#0f172a] border border-slate-800 p-8 rounded-2xl shadow-2xl">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Govt Admin ID</label>
                  <div className="relative"><UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" /><input type="text" required placeholder="e.g. ADM-7734" className="w-full bg-[#020617] border border-slate-700/50 rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-sky-500 outline-none transition-all font-mono text-slate-200 placeholder:font-sans" /></div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Security Clearance Key</label>
                  <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" /><input type="password" required placeholder="••••••••" className="w-full bg-[#020617] border border-slate-700/50 rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-sky-500 outline-none transition-all font-medium text-slate-200" /></div>
                </div>
                <button type="submit" className="w-full text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] tracking-wide uppercase mt-4 shadow-lg bg-sky-600 hover:bg-sky-500 shadow-sky-600/20">Initiate Session <ChevronRight className="w-5 h-5" /></button>
              </form>
            </div>
          </motion.div>
        )}

        {/* --- 2. LOGIN VIEW: SUBSTATION MANAGER (Independent) --- */}
        {view === 'login-manager' && (
          <motion.div 
            key="login-manager"
            initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }} transition={{ duration: 0.6, ease: SMOOTH_EASE }}
            className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#020617]"
          >
            <button onClick={handleBack} className="absolute top-8 left-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-medium tracking-wide uppercase text-sm"><ArrowLeft className="w-5 h-5"/> Return</button>
            <div className="w-full max-w-md relative z-10">
              <div className="mb-10 text-center">
                <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-2xl border border-purple-400/30 bg-purple-900/50">
                  <Server className="w-10 h-10 text-purple-400" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Substation Terminal</h2>
                <p className="text-slate-400 font-medium text-sm">Local Node Telemetry Access</p>
              </div>
              <form onSubmit={(e) => executeLogin(e, 'manager-portal')} className="space-y-5 bg-[#0f172a] border border-purple-900/30 p-8 rounded-2xl shadow-[0_0_50px_rgba(147,51,234,0.05)]">
                <div>
                  <label className="block text-xs font-bold text-purple-400/80 uppercase tracking-widest mb-2">Operating Region</label>
                  <select value={loginStateId} onChange={(e) => setLoginStateId(e.target.value)} className="w-full bg-[#020617] border border-slate-700/50 rounded-xl py-3.5 px-4 focus:ring-2 focus:ring-purple-500 outline-none text-slate-200">
                     {mapData?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-400/80 uppercase tracking-widest mb-2">Station Master ID</label>
                  <div className="relative"><Cpu className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" /><input type="text" required placeholder="e.g. MGR-102" className="w-full bg-[#020617] border border-slate-700/50 rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-purple-500 outline-none transition-all font-mono text-slate-200 placeholder:font-sans" /></div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-400/80 uppercase tracking-widest mb-2">Access PIN</label>
                  <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" /><input type="password" required placeholder="••••••••" className="w-full bg-[#020617] border border-slate-700/50 rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-purple-500 outline-none transition-all font-medium text-slate-200" /></div>
                </div>
                <button type="submit" className="w-full text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] tracking-wide uppercase mt-4 shadow-lg bg-purple-700 hover:bg-purple-600 shadow-purple-600/20">Access Terminal <ChevronRight className="w-5 h-5" /></button>
              </form>
            </div>
          </motion.div>
        )}

        {/* --- 3. LOGIN VIEW: ENGINEER PORTAL (Independent) --- */}
        {view === 'login-engineer' && (
          <motion.div 
            key="login-engineer"
            initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }} transition={{ duration: 0.6, ease: SMOOTH_EASE }}
            className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#020617]"
          >
            <button onClick={handleBack} className="absolute top-8 left-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-medium tracking-wide uppercase text-sm"><ArrowLeft className="w-5 h-5"/> Return</button>
            <div className="w-full max-w-md relative z-10">
              <div className="mb-10 text-center">
                <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-2xl border border-amber-400/30 bg-amber-900/50">
                  <HardHat className="w-10 h-10 text-amber-400" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Field Ops Login</h2>
                <p className="text-slate-400 font-medium text-sm">Engineer Dispatch App</p>
              </div>
              <form onSubmit={(e) => executeLogin(e, 'engineer-portal')} className="space-y-5 bg-[#0f172a] border border-amber-900/30 p-8 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.05)]">
                <div>
                  <label className="block text-xs font-bold text-amber-500/80 uppercase tracking-widest mb-2">Assigned Region</label>
                  <select value={loginStateId} onChange={(e) => setLoginStateId(e.target.value)} className="w-full bg-[#020617] border border-slate-700/50 rounded-xl py-3.5 px-4 focus:ring-2 focus:ring-amber-500 outline-none text-slate-200">
                     {mapData?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-500/80 uppercase tracking-widest mb-2">Technician Badge #</label>
                  <div className="relative"><UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" /><input type="text" required placeholder="e.g. ENG-884" className="w-full bg-[#020617] border border-slate-700/50 rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-amber-500 outline-none transition-all font-mono text-slate-200 placeholder:font-sans" /></div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-500/80 uppercase tracking-widest mb-2">Auth PIN</label>
                  <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" /><input type="password" required placeholder="••••••••" className="w-full bg-[#020617] border border-slate-700/50 rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-amber-500 outline-none transition-all font-medium text-slate-200" /></div>
                </div>
                <button type="submit" className="w-full text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] tracking-wide uppercase mt-4 shadow-lg bg-amber-600 hover:bg-amber-500 shadow-amber-600/20">Clock In <ChevronRight className="w-5 h-5" /></button>
              </form>
            </div>
          </motion.div>
        )}

        {/* --- REGIONAL ADMIN DASHBOARD VIEW --- */}
        {view === 'dashboard' && (
          <motion.div 
            key="dashboard-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="min-h-screen bg-[#020617] flex"
          >
            {/* Sidebar */}
            <motion.div 
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1, ease: SMOOTH_EASE }}
              className="w-20 lg:w-72 bg-[#0f172a] border-r border-slate-800 flex flex-col p-5 shrink-0 z-20"
            >
              <div className="flex items-center gap-4 mb-10 px-2">
                <div className="p-2.5 bg-sky-600 rounded-lg shrink-0 shadow-[0_0_12px_rgba(14,165,233,0.5)]">
                  <Landmark className="w-5 h-5 text-white" />
                </div>
                <div className="hidden lg:block">
                  <span className="font-bold text-lg tracking-tight truncate block text-white">RLDC Admin</span>
                  <span className="text-[10px] text-sky-400 font-bold tracking-widest uppercase block">{selectedState?.name}</span>
                </div>
              </div>
              
              <nav className="flex-1 space-y-2">
                <NavItem icon={<Globe className="w-5 h-5" />} label="Geographic Mapping" active theme="sky" />
                <NavItem icon={<BarChart3 className="w-5 h-5" />} label="Load Analytics" theme="sky" />
                <NavItem icon={<Database className="w-5 h-5" />} label="System Logs" theme="sky" />
              </nav>

              <button 
                onClick={handleBack}
                className="mt-auto flex items-center gap-3 p-4 rounded-xl text-slate-400 hover:bg-red-950/40 hover:text-red-400 border border-transparent transition-all w-full group"
              >
                <LogOut className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
                <span className="hidden lg:block font-bold uppercase tracking-wider text-[10px]">Terminate Session</span>
              </button>
            </motion.div>

            {/* Main Content */}
            <motion.div 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2, ease: SMOOTH_EASE }}
              className="flex-1 overflow-y-auto p-4 lg:p-8 flex flex-col"
            >
              {/* Toolbar & Header */}
              <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-8 shrink-0 border-b border-slate-800 pb-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">Regional Telemetry</h2>
                  <p className="text-slate-400 text-sm font-medium mt-1">Live grid data stream.</p>
                </div>
                <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
                  
                  {/* Administrative Toolbar */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => setShowStationModal(true)} className="bg-sky-900/20 hover:bg-sky-600/40 text-sky-400 border border-sky-500/30 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all">
                      <PlusCircle className="w-4 h-4" /> Add Station
                    </button>
                    <button onClick={() => setShowEngineerModal(true)} className="bg-emerald-900/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all">
                      <UserPlus className="w-4 h-4" /> Add Engineer
                    </button>
                    <button onClick={handleGenerateReport} className="bg-purple-900/20 hover:bg-purple-600/40 text-purple-400 border border-purple-500/30 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all">
                      <FileText className="w-4 h-4" /> Reports
                    </button>
                  </div>

                  <div className="bg-[#0f172a] border border-slate-700/50 px-4 py-2 rounded-lg flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                    <span className="text-[10px] font-bold tracking-widest uppercase text-slate-300">Uplink Secured</span>
                  </div>
                </div>
              </header>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 shrink-0">
                <StatCard title="Regional Load" value={`${selectedState?.load}%`} trend="Nominal" color="#0ea5e9" icon={<Activity className="w-5 h-5" />} />
                <StatCard title="Active Nodes" value={substations.length.toString()} trend="100% Online" color="#10B981" icon={<Radio className="w-5 h-5" />} />
                <StatCard title="Warnings" value={substations.filter(s => s.status === 'warning').length.toString().padStart(2, '0')} trend={substations.some(s => s.status === 'warning') ? 'Attention' : 'Clear'} color={substations.some(s => s.status === 'warning') ? '#f59e0b' : '#10B981'} icon={<AlertCircle className="w-5 h-5" />} />
              </div>

              {/* State Map & Selected Node View */}
              <div className="flex-1 min-h-[600px] grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* INTERACTIVE LEAFLET GEOGRAPHICAL MAP */}
                <div className="xl:col-span-2 bg-[#0f172a] border border-slate-800 rounded-2xl flex flex-col relative overflow-hidden shadow-xl min-h-[500px]">
                  <div className="absolute top-0 left-0 right-0 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 z-20 flex justify-between items-start pointer-events-none">
                    <div>
                        <h3 className="text-sm font-bold tracking-wider uppercase text-white flex items-center gap-2">
                            <Globe className="w-4 h-4 text-sky-500" /> Tactical GIS Mapping
                        </h3>
                    </div>
                  </div>
                  {leafletReady && selectedState ? (
                      <LeafletMap selectedState={selectedState} substations={substations} selectedSubstationId={selectedSubstationId} onSelectSubstation={setSelectedSubstationId} />
                  ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500"><Activity className="w-6 h-6 animate-spin text-sky-500 mb-2"/></div>
                  )}
                </div>

                {/* Selected Node Details Panel */}
                <div className="xl:col-span-1 flex flex-col h-full bg-[#0f172a] border border-slate-800 rounded-2xl shadow-xl overflow-hidden relative">
                  <AnimatePresence mode="wait">
                    {selectedSubstation ? (
                      <motion.div key={selectedSubstation.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col p-6 overflow-y-auto">
                        <div className="flex items-start justify-between mb-6 pb-6 border-b border-slate-800 shrink-0">
                          <div>
                            <div className={`text-[10px] font-bold px-2 py-1 rounded mb-2 inline-block uppercase tracking-widest border ${selectedSubstation.status === 'warning' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                              {selectedSubstation.status === 'warning' ? 'Warning' : 'Stable'}
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">{selectedSubstation.name}</h3>
                            <p className="text-slate-500 text-xs font-mono">ID: {selectedSubstation.id}</p>
                          </div>
                          
                          <div className="flex flex-col items-end">
                            <div className="p-3 bg-[#020617] border border-slate-800 rounded-xl"><Cpu className="w-5 h-5 text-sky-500" /></div>
                            
                            {/* Left/Right Arrow Navigation */}
                            <div className="flex items-center gap-1 mt-3 bg-[#020617] border border-slate-800 rounded-lg p-1">
                              <button onClick={handlePrevSubstation} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Previous Node"><ChevronLeft className="w-4 h-4"/></button>
                              <span className="text-[10px] font-mono text-slate-500 px-1">
                                {substations.findIndex(s=>s.id===selectedSubstation.id) + 1}/{substations.length}
                              </span>
                              <button onClick={handleNextSubstation} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Next Node"><ChevronRight className="w-4 h-4"/></button>
                            </div>
                          </div>

                        </div>

                        {/* Telemetry Section */}
                        <div className="space-y-4 shrink-0 mb-6">
                          <div>
                            <div className="flex justify-between text-xs mb-2 font-bold text-slate-400 uppercase tracking-wider">
                              <span>Output Load</span>
                              <span className={`${selectedSubstation.status === 'warning' ? 'text-amber-500' : 'text-sky-400'}`}>{selectedSubstation.currentLoadMW} MW</span>
                            </div>
                            <div className="h-2 bg-[#020617] rounded-full overflow-hidden border border-slate-800 relative">
                              <div className="absolute top-0 bottom-0 left-[85%] w-px bg-red-500 z-10"></div>
                              <motion.div animate={{ width: `${Math.min((selectedSubstation.currentLoadMW / selectedSubstation.maxCapacityMW) * 100, 100)}%` }} className={`h-full rounded-full ${selectedSubstation.status === 'warning' ? 'bg-amber-500' : 'bg-sky-500'}`} />
                            </div>
                          </div>
                        </div>

                        {/* Configuration Panel */}
                        <div className="bg-[#020617] p-4 rounded-xl border border-slate-800 shrink-0 mb-6">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><SlidersHorizontal className="w-3 h-3 text-sky-500" /> Safe Capacity Limit</h4>
                            <input 
                                type="range" min="50" max="500" step="10" value={selectedSubstation.maxCapacityMW}
                                onChange={(e) => updateSubstationCapacity(selectedSubstation.id, parseInt(e.target.value))}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                            />
                            <div className="flex justify-between text-[10px] text-slate-600 font-mono mt-2"><span>50 MW</span><span className="text-sky-400">{selectedSubstation.maxCapacityMW} MW</span><span>500 MW</span></div>
                        </div>

                        {/* Alert Logs */}
                        <div className="bg-[#020617] rounded-xl border border-slate-800 p-4 flex-1 flex flex-col min-h-[150px]">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-800 pb-2">Terminal Logs</h4>
                            <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                                {selectedSubstation.logs.map((log) => (
                                    <div key={log.id} className="flex flex-col border-l-2 pl-2 py-0.5" style={{ borderColor: log.type === 'critical' ? '#ef4444' : log.type === 'success' ? '#10b981' : '#0ea5e9' }}>
                                      <p className={`text-[11px] ${log.type === 'critical' ? 'text-red-400 font-bold' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-400'}`}>{log.message}</p>
                                      <span className="text-slate-600 font-mono text-[9px]">{log.timestamp.toLocaleTimeString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 p-8"><Radio className="w-12 h-12 mb-4 opacity-20" /><p className="text-xs font-medium">Select a node</p></div>
                    )}
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
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="min-h-screen bg-[#020617] flex"
          >
            {/* Manager Sidebar */}
            <motion.div className="w-20 lg:w-72 bg-[#0f172a] border-r border-slate-800 flex flex-col p-5 shrink-0 z-20">
              <div className="flex items-center gap-4 mb-10 px-2">
                <div className="p-2.5 bg-purple-600 rounded-lg shrink-0 shadow-[0_0_12px_rgba(147,51,234,0.5)]"><Server className="w-5 h-5 text-white" /></div>
                <div className="hidden lg:block">
                  <span className="font-bold text-lg tracking-tight text-white block">Substation Manager</span>
                  <span className="text-[10px] text-purple-400 font-bold tracking-widest uppercase block">Local Control: {selectedState?.name}</span>
                </div>
              </div>
              <nav className="flex-1 space-y-2">
                <NavItem icon={<Home className="w-5 h-5" />} label="Overview" active={managerTab === 'overview'} theme="purple" onClick={() => setManagerTab('overview')} />
                <NavItem icon={<Zap className="w-5 h-5" />} label="Meter Telemetry" active={managerTab === 'meters'} theme="purple" onClick={() => setManagerTab('meters')} />
                <NavItem icon={<CalendarDays className="w-5 h-5" />} label="Personnel Leaves" active={managerTab === 'leave-approvals'} theme="purple" onClick={() => setManagerTab('leave-approvals')} badge={leaveRequests.filter(l => l.status === 'pending').length} />
              </nav>
              <button onClick={handleBack} className="mt-auto flex items-center gap-3 p-4 rounded-xl text-slate-400 hover:bg-red-950/40 hover:text-red-400 transition-all w-full group">
                <LogOut className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
                <span className="hidden lg:block font-bold uppercase tracking-wider text-[10px]">Logout</span>
              </button>
            </motion.div>

            {/* Manager Content */}
            <div className="flex-1 p-4 lg:p-8 overflow-y-auto">
              <header className="mb-8 border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Local Node Administration</h2>
                  <p className="text-slate-400 text-sm mt-1">Managing Substation Telemetry</p>
                </div>
                <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => setShowEngineerModal(true)} className="bg-emerald-900/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all">
                      <UserPlus className="w-4 h-4" /> Add Engineer
                    </button>
                    <button onClick={handleGenerateReport} className="bg-purple-900/20 hover:bg-purple-600/40 text-purple-400 border border-purple-500/30 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all">
                      <FileText className="w-4 h-4" /> Reports
                    </button>
                  </div>
                  <div className="bg-[#0f172a] border border-slate-700/50 px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-lg">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                    <span className="text-[10px] font-bold tracking-widest uppercase text-slate-300">Uplink Secured</span>
                  </div>
                </div>
              </header>

              {managerTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                   <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                      <Activity className="absolute right-[-20px] bottom-[-20px] w-32 h-32 text-emerald-500/10" />
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Node Health</h3>
                      <div className="text-4xl font-bold text-white mb-2">{substations[0]?.currentLoadMW || 0} <span className="text-lg text-slate-500">MW</span></div>
                      <p className="text-emerald-500 text-xs font-bold uppercase tracking-widest">Operating Normally</p>
                   </div>
                   <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                      <Zap className="absolute right-[-20px] bottom-[-20px] w-32 h-32 text-purple-500/10" />
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Connected Smart Meters</h3>
                      <div className="text-4xl font-bold text-white mb-2">{smartMeters.length} <span className="text-lg text-slate-500">Active Units</span></div>
                      <p className="text-purple-400 text-xs font-bold uppercase tracking-widest">Live Telemetry Pinging</p>
                   </div>
                </div>
              )}

              {managerTab === 'overview' && (
                <div className="flex-1 min-h-[600px] grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 bg-[#0f172a] border border-slate-800 rounded-2xl flex flex-col relative overflow-hidden shadow-xl min-h-[450px]">
                    <div className="absolute top-0 left-0 right-0 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 z-20 flex justify-between items-start pointer-events-none">
                      <div>
                          <h3 className="text-sm font-bold tracking-wider uppercase text-white flex items-center gap-2">
                              <Globe className="w-4 h-4 text-purple-500" /> Regional Node Map
                          </h3>
                      </div>
                    </div>
                    {leafletReady && selectedState ? (
                        <LeafletMap selectedState={selectedState} substations={substations} selectedSubstationId={selectedSubstationId} onSelectSubstation={setSelectedSubstationId} />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500"><Activity className="w-6 h-6 animate-spin text-purple-500 mb-2"/></div>
                    )}
                  </div>
                  
                  {/* Selected Node Details Panel - MANAGER View */}
                  <div className="xl:col-span-1 flex flex-col h-full bg-[#0f172a] border border-slate-800 rounded-2xl shadow-xl overflow-hidden relative">
                    <AnimatePresence mode="wait">
                      {selectedSubstation ? (
                        <motion.div key={selectedSubstation.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col p-6 overflow-y-auto">
                          <div className="flex items-start justify-between mb-6 pb-6 border-b border-slate-800 shrink-0">
                            <div>
                              <div className={`text-[10px] font-bold px-2 py-1 rounded mb-2 inline-block uppercase tracking-widest border ${selectedSubstation.status === 'warning' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                                {selectedSubstation.status === 'warning' ? 'Warning' : 'Stable'}
                              </div>
                              <h3 className="text-lg font-bold text-white mb-1">{selectedSubstation.name}</h3>
                              <p className="text-slate-500 text-xs font-mono">ID: {selectedSubstation.id}</p>
                            </div>
                            <div className="flex flex-col items-end">
                              <div className="p-3 bg-[#020617] border border-slate-800 rounded-xl"><Server className="w-5 h-5 text-purple-500" /></div>
                              <div className="flex items-center gap-1 mt-3 bg-[#020617] border border-slate-800 rounded-lg p-1">
                                <button onClick={handlePrevSubstation} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Previous Node"><ChevronLeft className="w-4 h-4"/></button>
                                <span className="text-[10px] font-mono text-slate-500 px-1">
                                  {substations.findIndex(s=>s.id===selectedSubstation.id) + 1}/{substations.length}
                               </span>
                                <button onClick={handleNextSubstation} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Next Node"><ChevronRight className="w-4 h-4"/></button>
                              </div>
                            </div>
                          </div>

                          {/* Telemetry Section */}
                          <div className="space-y-4 shrink-0 mb-6">
                            <div>
                              <div className="flex justify-between text-xs mb-2 font-bold text-slate-400 uppercase tracking-wider">
                                <span>Output Load</span>
                                <span className={`${selectedSubstation.status === 'warning' ? 'text-amber-500' : 'text-purple-400'}`}>{selectedSubstation.currentLoadMW} MW</span>
                              </div>
                              <div className="h-2 bg-[#020617] rounded-full overflow-hidden border border-slate-800 relative">
                                <div className="absolute top-0 bottom-0 left-[85%] w-px bg-red-500 z-10"></div>
                                <motion.div animate={{ width: `${Math.min((selectedSubstation.currentLoadMW / selectedSubstation.maxCapacityMW) * 100, 100)}%` }} className={`h-full rounded-full ${selectedSubstation.status === 'warning' ? 'bg-amber-500' : 'bg-purple-500'}`} />
                              </div>
                            </div>
                          </div>

                          {/* Configuration Panel */}
                          <div className="bg-[#020617] p-4 rounded-xl border border-slate-800 shrink-0 mb-6">
                              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><SlidersHorizontal className="w-3 h-3 text-purple-500" /> Safe Capacity Limit</h4>
                              <input 
                                  type="range" min="50" max="500" step="10" value={selectedSubstation.maxCapacityMW}
                                  onChange={(e) => updateSubstationCapacity(selectedSubstation.id, parseInt(e.target.value))}
                                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                              />
                              <div className="flex justify-between text-[10px] text-slate-600 font-mono mt-2"><span>50 MW</span><span className="text-purple-400">{selectedSubstation.maxCapacityMW} MW</span><span>500 MW</span></div>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 p-8"><Radio className="w-12 h-12 mb-4 opacity-20" /><p className="text-xs font-medium">Select a node</p></div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {managerTab === 'meters' && (
                <div className="bg-[#0f172a] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                  <div className="p-6 border-b border-slate-800">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Zap className="w-5 h-5 text-purple-500" /> Residential Smart Meter Telemetry</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#020617] text-slate-400 text-[10px] uppercase tracking-widest">
                          <th className="p-4 border-b border-slate-800">Meter ID</th>
                          <th className="p-4 border-b border-slate-800">Assigned Address</th>
                          <th className="p-4 border-b border-slate-800">Current Voltage</th>
                          <th className="p-4 border-b border-slate-800">Status</th>
                          <th className="p-4 border-b border-slate-800 text-right">Last Ping</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {smartMeters.map(meter => (
                          <tr key={meter.id} className="border-b border-slate-800/50 hover:bg-[#070b19] transition-colors">
                            <td className="p-4 font-mono text-slate-300">{meter.id}</td>
                            <td className="p-4 text-slate-400">{meter.houseAddress}</td>
                            <td className="p-4">
                              <span className={`font-mono font-bold ${meter.status === 'high' ? 'text-amber-500' : meter.status === 'low' ? 'text-blue-400' : 'text-emerald-400'}`}>
                                {meter.voltage} V
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${
                                meter.status === 'high' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                                meter.status === 'low' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                                'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              }`}>
                                {meter.status === 'high' ? 'Overvolt' : meter.status === 'low' ? 'Undervolt' : 'Nominal'}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-[10px] text-slate-500 text-right">{meter.lastUpdated.toLocaleTimeString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {managerTab === 'leave-approvals' && (
                <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-purple-500" /> Pending Leave Approvals</h3>
                  <div className="space-y-4">
                    {leaveRequests.length === 0 ? (
                      <p className="text-slate-500 text-sm">No leave requests currently in system.</p>
                    ) : (
                      leaveRequests.map(req => (
                        <div key={req.id} className="bg-[#020617] border border-slate-800 p-5 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-white font-bold">{req.engineerName}</h4>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
                                req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                req.status === 'rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              }`}>{req.status}</span>
                            </div>
                            <p className="text-slate-400 text-xs mb-1">Dates: {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}</p>
                            <p className="text-slate-500 text-xs italic">"{req.reason}"</p>
                          </div>
                          {req.status === 'pending' && (
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => handleLeaveAction(req.id, 'approved')} className="bg-emerald-900/30 hover:bg-emerald-600 text-emerald-500 hover:text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center gap-1 border border-emerald-500/30"><CheckCircle2 className="w-4 h-4"/> Approve</button>
                              <button onClick={() => handleLeaveAction(req.id, 'rejected')} className="bg-red-900/30 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center gap-1 border border-red-500/30"><XSquare className="w-4 h-4"/> Deny</button>
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

        {/* --- ENGINEER PORTAL VIEW --- */}
        {view === 'engineer-portal' && (
          <motion.div 
            key="engineer-portal-view"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="min-h-screen bg-[#020617] flex"
          >
            {/* Engineer Sidebar */}
            <motion.div className="w-20 lg:w-72 bg-[#0f172a] border-r border-slate-800 flex flex-col p-5 shrink-0 z-20">
              <div className="flex items-center gap-4 mb-10 px-2">
                <div className="p-2.5 bg-amber-600 rounded-lg shrink-0 shadow-[0_0_12px_rgba(217,119,6,0.6)]"><HardHat className="w-5 h-5 text-white" /></div>
                <div className="hidden lg:block">
                  <span className="font-bold text-lg tracking-tight text-white block">Field Ops</span>
                  <span className="text-[10px] text-amber-500 font-bold tracking-widest uppercase block">Engineer Portal: {selectedState?.name}</span>
                </div>
              </div>
              <nav className="flex-1 space-y-2">
                <NavItem icon={<Mail className="w-5 h-5" />} label="Fault Inbox" active={engTab === 'inbox'} theme="amber" onClick={() => setEngTab('inbox')} badge={engTasks.filter(t => t.status === 'pending').length} />
                <NavItem icon={<UserCheck className="w-5 h-5" />} label="My Profile" active={engTab === 'profile'} theme="amber" onClick={() => setEngTab('profile')} />
                <NavItem icon={<CalendarDays className="w-5 h-5" />} label="Leave Application" active={engTab === 'leave'} theme="amber" onClick={() => setEngTab('leave')} />
              </nav>
              <button onClick={handleBack} className="mt-auto flex items-center gap-3 p-4 rounded-xl text-slate-400 hover:bg-red-950/40 hover:text-red-400 transition-all w-full group">
                <LogOut className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
                <span className="hidden lg:block font-bold uppercase tracking-wider text-[10px]">Logout</span>
              </button>
            </motion.div>

            {/* Engineer Content */}
            <div className="flex-1 p-4 lg:p-8 overflow-y-auto">
              <header className="mb-8 border-b border-slate-800 pb-6">
                <h2 className="text-2xl font-bold text-white">Maintenance Directives</h2>
                <p className="text-slate-400 text-sm mt-1">Status: <span className="text-emerald-500 font-bold">On Duty</span></p>
              </header>

              {engTab === 'inbox' && (
                <div className="max-w-4xl space-y-4">
                  {engTasks.map((task) => (
                    <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`bg-[#0f172a] border rounded-2xl p-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center transition-all ${task.status === 'completed' ? 'border-emerald-900/50 opacity-60' : task.severity === 'critical' ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-amber-500/50'}`}>
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          {task.status === 'completed' ? <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold uppercase rounded">Resolved</span> : <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${task.severity === 'critical' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>{task.severity} Priority</span>}
                          <span className="text-slate-500 text-[10px] font-mono">{task.timestamp.toLocaleTimeString()}</span>
                        </div>
                        <h4 className={`text-lg font-bold ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-white'}`}>{task.description}</h4>
                        <div className="flex items-center gap-2 text-slate-400 text-sm"><MapPin className="w-4 h-4 text-sky-500" /> {task.location}</div>
                      </div>
                      {task.status === 'pending' ? (
                        <button onClick={() => handleResolveTask(task.id)} className="bg-sky-600 hover:bg-sky-500 text-white px-5 py-2.5 rounded-lg font-bold uppercase tracking-wider text-[10px] flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Mark Complete</button>
                      ) : <div className="flex items-center gap-2 text-emerald-500 font-bold uppercase tracking-wider text-[10px]"><CheckCircle className="w-4 h-4" /> Done</div>}
                    </motion.div>
                  ))}
                </div>
              )}

              {engTab === 'profile' && (
                <div className="max-w-3xl">
                  <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-8 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
                    
                    <div className="flex items-center gap-6 mb-8 relative z-10">
                      <div className="w-24 h-24 bg-slate-800 rounded-full border-4 border-slate-700 flex items-center justify-center overflow-hidden">
                        <UserIcon className="w-12 h-12 text-slate-500" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-bold text-white mb-1">Ramesh Kumar</h2>
                        <p className="text-amber-500 font-mono text-sm mb-2">ENG-ID: 884-XTR-9</p>
                        <span className="px-3 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-bold uppercase tracking-widest rounded-full">Level 3 Technician</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 border-t border-slate-800 pt-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-slate-300">
                          <Briefcase className="w-5 h-5 text-slate-500" />
                          <span className="text-sm font-medium">Department: <span className="text-white">High Voltage Transmissions</span></span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-300">
                          <MapPin className="w-5 h-5 text-slate-500" />
                          <span className="text-sm font-medium">Base Station: <span className="text-white">{selectedState?.name || 'Local'} Grid</span></span>
                        </div>
                      </div>
                      <div className="space-y-4">
                         <div className="bg-[#070b19] border border-slate-800 p-4 rounded-xl flex justify-between items-center">
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Faults Resolved</span>
                           <span className="text-2xl font-bold text-emerald-500 font-mono">142</span>
                         </div>
                         <div className="bg-[#070b19] border border-slate-800 p-4 rounded-xl flex justify-between items-center">
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Duty Hours (Mo)</span>
                           <span className="text-2xl font-bold text-sky-500 font-mono">164h</span>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {engTab === 'leave' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-5xl">
                  <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-amber-500" /> New Leave Request</h3>
                    <form onSubmit={handleLeaveSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Start Date</label><input type="date" required value={leaveForm.start} onChange={e=>setLeaveForm({...leaveForm, start: e.target.value})} className="w-full bg-[#020617] border border-slate-700/50 rounded-xl py-3 px-4 text-slate-200 outline-none focus:ring-1 focus:ring-amber-500" /></div>
                        <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">End Date</label><input type="date" required value={leaveForm.end} onChange={e=>setLeaveForm({...leaveForm, end: e.target.value})} className="w-full bg-[#020617] border border-slate-700/50 rounded-xl py-3 px-4 text-slate-200 outline-none focus:ring-1 focus:ring-amber-500" /></div>
                      </div>
                      <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Reason</label><textarea required rows={4} value={leaveForm.reason} onChange={e=>setLeaveForm({...leaveForm, reason: e.target.value})} className="w-full bg-[#020617] border border-slate-700/50 rounded-xl py-3 px-4 text-slate-200 outline-none focus:ring-1 focus:ring-amber-500 resize-none"></textarea></div>
                      <button type="submit" className="w-full bg-amber-600 text-white font-bold py-3.5 rounded-xl uppercase text-[10px] tracking-wide">Submit Request</button>
                    </form>
                  </div>
                  <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-6 border-b border-slate-800 pb-4">Leave History</h3>
                    <div className="space-y-4 overflow-y-auto pr-2">
                      {leaveRequests.map(leave => (
                        <div key={leave.id} className="bg-[#020617] border border-slate-800 p-4 rounded-xl">
                          <div className="flex justify-between mb-2">
                             <div className="text-sm font-bold text-white">{new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}</div>
                             <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${leave.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : leave.status==='rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>{leave.status}</span>
                          </div>
                          <p className="text-slate-400 text-xs">{leave.reason}</p>
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

// --- Subcomponents ---

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  theme: 'sky' | 'amber' | 'purple';
  onClick?: () => void;
  badge?: number;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active = false, theme, onClick, badge }) => {
  const activeClass = theme === 'sky' ? 'bg-sky-600 text-white shadow-[0_0_15px_rgba(14,165,233,0.4)]' : 
                      theme === 'amber' ? 'bg-amber-600 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)]' : 
                      'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]';
  return (
    <button onClick={onClick} className={`flex justify-between items-center p-3.5 rounded-xl transition-all w-full font-bold text-[10px] uppercase tracking-wider ${active ? activeClass : 'text-slate-400 hover:bg-[#020617] hover:text-slate-200'}`}>
      <div className="flex items-center gap-4">
        {icon}
        <span className="hidden lg:block">{label}</span>
      </div>
      {!!badge && badge > 0 && <span className="hidden lg:flex w-5 h-5 bg-red-500 text-white rounded-full items-center justify-center text-[10px]">{badge}</span>}
    </button>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  trend: string;
  color: string;
  icon: React.ReactElement;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, trend, color, icon }) => (
  <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-2xl relative overflow-hidden group shadow-lg">
    <div className="absolute top-0 right-0 w-28 h-28 -mr-10 -mt-10 opacity-5 group-hover:opacity-10 transition-opacity duration-500" style={{ color }}>
      {React.cloneElement(icon, { size: 112 })}
    </div>
    <p className="text-[10px] text-slate-400 mb-2 font-bold uppercase tracking-widest">{title}</p>
    <div className="flex items-baseline gap-3">
      <h4 className="text-4xl font-bold tracking-tight text-white">{value}</h4>
      <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border ${
        trend.includes('Attention') ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      }`}>
        {trend}
      </span>
    </div>
  </div>
);