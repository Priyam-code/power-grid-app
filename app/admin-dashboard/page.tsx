"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

export interface StateData {
  id: number; name: string; color: string; path: string; load: number;
  centerX: number; centerY: number; minLat: number; maxLat: number; minLon: number; maxLon: number;
}
export interface LogEntry { id: string; timestamp: Date; message: string; type: 'info' | 'warning' | 'critical' | 'success'; }
export interface Substation {
  id: string; name: string; lat: number; lon: number; location: string;
  currentLoadMW: number; maxCapacityMW: number; status: 'stable' | 'warning' | 'critical'; voltage: number; logs: LogEntry[];
}
export interface AppAlert { id: string; message: string; type: 'critical' | 'success' | 'info'; }

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

const LeafletMap = ({ selectedState, substations, selectedSubstationId, onSelectSubstation, isAddMode = false, onMapClick, tempMarkerPos }: any) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersLayer = useRef<any>(null); 
  const tempMarkerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false); 

  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    if (mapInstance.current) return; 

    const map = window.L.map(mapRef.current, { zoomControl: false }).fitBounds([
      [selectedState.minLat, selectedState.minLon],
      [selectedState.maxLat, selectedState.maxLon]
    ]);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);
    markersLayer.current = window.L.layerGroup().addTo(map);
    mapInstance.current = map;
    setMapReady(true);

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
    if (!mapInstance.current || !mapReady) return;
    if (!isAddMode || !onMapClick) return;

    const handler = (e: any) => onMapClick([e.latlng.lat, e.latlng.lng]);
    mapInstance.current.on('click', handler);

    return () => {
      mapInstance.current?.off('click', handler);
    };
  }, [isAddMode, onMapClick, mapReady]);

  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current || !window.L || !mapReady) return;

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

    if (selectedSubstationId && !isAddMode) {
       const sub = substations.find((s: Substation) => s.id === selectedSubstationId);
       if (sub) mapInstance.current.flyTo([sub.lat, sub.lon], Math.max(mapInstance.current.getZoom(), 8), { animate: true, duration: 1 });
    }
  }, [substations, selectedSubstationId, onSelectSubstation, mapReady, isAddMode]);

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
};


// --- Main Application ---
export default function App() {
  const [view, setView] = useState<ViewState>('map');
  const [selectedState, setSelectedState] = useState<StateData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [mapData, setMapData] = useState<StateData[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [leafletReady, setLeafletReady] = useState(false);
  
  const [loginStateId, setLoginStateId] = useState<string>('');
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [selectedSubstationId, setSelectedSubstationId] = useState<string | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<AppAlert[]>([]);
  const [subStationChanges, setSubstationChanges] = useState<Map<string, Partial<Substation>>>(new Map());
  const [isLoadingSubstations, setIsLoadingSubstations] = useState(false); 

  const [showAddSubstationModal, setShowAddSubstationModal] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [tempMarkerPos, setTempMarkerPos] = useState<[number, number] | null>(null);
  const [addFormData, setAddFormData] = useState({
    name: '', location: '', lat: '', lon: '', currentLoadMw: '50', maxCapacityMw: '150', voltage: '132'
  });

  const [newSubstationCreds, setNewSubstationCreds] = useState<{id: string, passcode: string, name: string} | null>(null);
  const [adminTab, setAdminTab] = useState<'mapping' | 'analytics'>('mapping');

  const [showEngineerModal, setShowEngineerModal] = useState(false);
  const [engineerFormData, setEngineerFormData] = useState({
    name: '', email: '', region: ''
  });
  const [isSubmittingEngineer, setIsSubmittingEngineer] = useState(false);

  const pushAlert = useCallback((message: string, type: 'critical' | 'success' | 'info') => {
    const id = Math.random().toString();
    setActiveAlerts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setActiveAlerts(prev => prev.filter(a => a.id !== id));
    }, 5000);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css'; link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      
      const script = document.createElement('script');
      script.id = 'leaflet-js'; script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
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
          
          let path = ""; let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;

          const processCoord = (c: [number, number]) => {
            const [lon, lat] = c;
            if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
            if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
            const [x, y] = project(c);
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            return `${x},${y}`;
          };

          if (f.geometry.type === "Polygon") {
            path = "M" + f.geometry.coordinates[0].map(processCoord).join("L") + "Z";
          } else if (f.geometry.type === "MultiPolygon") {
            path = f.geometry.coordinates.map((poly: any) => "M" + poly[0].map(processCoord).join("L") + "Z").join(" ");
          }

          return { id: i, name, color: '', path, load, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, minLat, maxLat, minLon, maxLon };
        });
        
        features.sort((a, b) => a.name.localeCompare(b.name));
        setMapData(features);
        setLoginStateId(features[0].id.toString()); 
      })
      .catch(err => console.error("Map Data Error:", err));
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      if (!auth) { setUser({ uid: 'local-dev-user' } as User); setLoading(false); return; }
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        setUser({ uid: 'local-dev-user' } as User); setLoading(false);
      }
    };
    initAuth();
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (u) => { if (u) setUser(u); setLoading(false); });
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    const fetchSubstations = async () => {
      if (view === 'dashboard' && selectedState) {
        setIsLoadingSubstations(true);
        try {
          const response = await fetch(`/api/substations?state=${selectedState.name}`);
          if (response.ok) {
            const result = await response.json();
            const substationsData = result.data || [];
            const mappedSubs = substationsData.map((sub: any) => ({
              ...sub,
              logs: [{ id: `init-${sub.id}`, timestamp: new Date(sub.createdAt), message: 'Telemetry Sync Established', type: 'info' as const }]
            }));
            setSubstations(mappedSubs);
            if (mappedSubs.length > 0) setSelectedSubstationId(mappedSubs[0].id);
            setSubstationChanges(new Map()); 
          }
        } catch (err) {
          console.error('Failed to fetch substations:', err);
          pushAlert('Warning: Using local substation data', 'info');
        } finally {
          setIsLoadingSubstations(false);
        }
      }
    };
    fetchSubstations();
  }, [view, selectedState, pushAlert]);

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
              newLogs.unshift({ id: Math.random().toString(), timestamp: new Date(), message: `CRITICAL: Load exceeded safe threshold (${loadPercentage.toFixed(1)}%)`, type: 'critical' });
              newlyTriggeredAlerts.push({ id: Math.random().toString(), message: `CRITICAL ALERT: ${sub.name} overloaded!`, type: 'critical' });


              fetch('/api/tasks/auto-assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  location: sub.name,
                  description: `SUBSTATION OVERLOAD: ${sub.name} is at ${loadPercentage.toFixed(1)}% capacity (${newLoad}MW). Immediate balancing required.`,
                  severity: 'CRITICAL',
                  state: selectedState?.name || 'Delhi'
                })
              }).then(r => r.json()).then(data => {
                if(data.success) {
                  pushAlert(`Auto-Dispatch: Eng. ${data.assignedTo} routed to ${sub.name}`, 'success');
                } else {
                  console.warn('Dispatch failed', data.error);
                }
              }).catch(e => console.error('Dispatch error', e));


              
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
    }, 3000);

    return () => clearInterval(interval);
  }, [view, substations.length]);

  const handleMapClick = useCallback((coords: [number, number]) => {
    if (!selectedState) return;
    const [lat, lon] = coords;
    const inside = lat >= selectedState.minLat && lat <= selectedState.maxLat && lon >= selectedState.minLon && lon <= selectedState.maxLon;
    if (inside) {
      setTempMarkerPos(coords);
      setAddFormData(prev => ({ ...prev, lat: lat.toFixed(6), lon: lon.toFixed(6) }));
    } else {
      pushAlert('Location is outside the selected state.', 'info');
    }
  }, [selectedState, pushAlert]);

  const closeAddSubstationModal = () => {
    setShowAddSubstationModal(false); setIsAddMode(false); setTempMarkerPos(null);
    setAddFormData({ name: '', location: '', lat: '', lon: '', currentLoadMw: '50', maxCapacityMw: '150', voltage: '132' });
  };

  const closeEngineerModal = () => {
    setShowEngineerModal(false); setEngineerFormData({ name: '', email: '', region: '' });
  };

  const handleAddEngineer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!engineerFormData.name || !engineerFormData.email || !engineerFormData.region) { pushAlert('All fields are required', 'info'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(engineerFormData.email)) { pushAlert('Please enter a valid email address', 'info'); return; }

    setIsSubmittingEngineer(true);
    try {
      const res = await fetch('/api/engineers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(engineerFormData)
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Failed to add engineer'); }
      await res.json();
      pushAlert(`Engineer ${engineerFormData.name} created and credentials sent to ${engineerFormData.email}`, 'success');
      closeEngineerModal();
    } catch (err) {
      pushAlert(`Failed to add engineer: ${err instanceof Error ? err.message : 'Unknown error'}`, 'info');
    } finally {
      setIsSubmittingEngineer(false);
    }
  };

  const handleAddSubstationSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const lat = parseFloat(addFormData.lat); const lon = parseFloat(addFormData.lon);

    if (!addFormData.name || !addFormData.location) { pushAlert('Name and location are required.', 'info'); return; }
    if (isNaN(lat) || isNaN(lon)) { pushAlert('Invalid coordinates.', 'info'); return; }
    if (!selectedState) { pushAlert('No state selected.', 'info'); return; }

    const validLat = lat >= selectedState.minLat && lat <= selectedState.maxLat;
    const validLon = lon >= selectedState.minLon && lon <= selectedState.maxLon;
    if (!validLat || !validLon) { pushAlert('Location is outside the selected state.', 'info'); return; }

    const stateCode = selectedState.name.substring(0, 2).toUpperCase();
    const newStationId = `SUB-${stateCode}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPasscode = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      const res = await fetch('/api/substations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addFormData.name, state: selectedState.name, location: addFormData.location,
          lat, lon, currentLoadMw: parseInt(addFormData.currentLoadMw), maxCapacityMw: parseInt(addFormData.maxCapacityMw),
          voltage: parseInt(addFormData.voltage), status: 'stable', station_id: newStationId, passcode: newPasscode
        })
      });
      if (!res.ok) throw new Error();
      const payload = await res.json();
      setSubstations(prev => [...prev, { ...payload.data, logs: [] }]);
      setSelectedSubstationId(payload.data.id);
      closeAddSubstationModal();
      setNewSubstationCreds({ id: newStationId, passcode: newPasscode, name: addFormData.name });
      pushAlert('Substation added successfully.', 'success');
    } catch (err) {
      pushAlert('Failed to add substation.', 'info');
    }
  };

  const updateSubstationCapacity = (id: string, newCapacity: number) => {
      setSubstations(prev => prev.map(sub => {
          if (sub.id === id) {
              const newLogs = [{ id: Math.random().toString(), timestamp: new Date(), message: `CONFIG: Max Capacity adjusted to ${newCapacity} MW`, type: 'info' as const }, ...sub.logs].slice(0, 15);
              setSubstationChanges(prevM => {
                const existing = prevM.get(id) || {};
                const updated = new Map(prevM);
                updated.set(id, { ...existing, maxCapacityMW: newCapacity });
                return updated;
              });
              return { ...sub, maxCapacityMW: newCapacity, logs: newLogs };
          }
          return sub;
      }));
  };

  const handleMapStateClick = (state: StateData) => { setSelectedState(state); setView('login-admin'); };

  const executeLogin = async (e: React.FormEvent<HTMLFormElement>, targetView: ViewState) => {
    e.preventDefault();
    if (targetView !== 'dashboard' && mapData) {
      const selected = mapData.find(s => s.id.toString() === loginStateId);
      if (selected) setSelectedState(selected);
    }
    if (user && db) { 
      try {
        const logRef = collection(db, 'artifacts', appId, 'users', user.uid, 'logs');
        await addDoc(logRef, { action: `Login successful to ${targetView}`, timestamp: serverTimestamp() });
      } catch (err) {}
    }
    setView(targetView);
  };

  const syncChangesToDatabase = async () => {
    if (subStationChanges.size === 0) return;
    const keyMap: Record<string, string> = { maxCapacityMW: 'maxCapacityMw', status: 'status' };
    const translateKeys = (changes: Partial<Substation>): Record<string, any> => {
      const translated: Record<string, any> = {};
      for (const [key, value] of Object.entries(changes)) {
        const mappedKey = keyMap[key];
        if (mappedKey !== undefined) translated[mappedKey] = value;
      }
      return translated;
    };

    try {
      const syncPromises: Array<Promise<{ substationId: string; success: boolean; response: Response | null }>> = [];
      subStationChanges.forEach((changes, substationId) => {
        const translatedChanges = translateKeys(changes);
        if (Object.keys(translatedChanges).length === 0) return;
        syncPromises.push(
          fetch('/api/substations', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: substationId, ...translatedChanges }),
          }).then(response => ({ substationId, success: response.ok, response }))
            .catch(err => { return { substationId, success: false, response: null }; })
        );
      });

      if (syncPromises.length === 0) return;
      const results = await Promise.all(syncPromises);
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      if (failureCount === 0 && successCount > 0) {
        pushAlert('All changes synced successfully', 'success');
        setSubstationChanges(new Map());
      } else if (successCount > 0) {
        pushAlert(`Partial sync: ${successCount} succeeded, ${failureCount} failed`, 'info');
      } else {
        pushAlert('Failed to sync changes. Check console for details.', 'info');
      }
    } catch (err) {
      pushAlert(`Error syncing: ${err instanceof Error ? err.message : 'Unknown error'}`, 'info');
    }
  };

  const handleBack = async () => {
    await syncChangesToDatabase();
    setView('map'); setSelectedState(null); setSubstations([]); setSelectedSubstationId(null); setSubstationChanges(new Map());
  };

  const handleGenerateReport = () => { pushAlert('Gathering grid telemetry... Report generation initiated.', 'info'); };

  const handlePrevSubstation = () => {
    if (!substations.length) return;
    const currentIndex = substations.findIndex(s => s.id === selectedSubstationId);
    setSelectedSubstationId(substations[(currentIndex - 1 + substations.length) % substations.length].id);
  };

  const handleNextSubstation = () => {
    if (!substations.length) return;
    const currentIndex = substations.findIndex(s => s.id === selectedSubstationId);
    setSelectedSubstationId(substations[(currentIndex + 1) % substations.length].id);
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
      
      <style dangerouslySetInnerHTML={{__html: `
        .state-path { fill: #1c1b1b; stroke: rgba(255,255,255,0.05); stroke-width: 1px; transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), fill 0.2s ease, stroke 0.2s ease, filter 0.2s ease; will-change: transform, fill, stroke, filter; }
        .state-path:hover { fill: #201f1f; stroke: #ffffff; stroke-width: 2px; transform: scale(1.01) translateZ(0); filter: drop-shadow(0 0 15px rgba(255,255,255,0.15)); z-index: 100; }
        .leaflet-container { background: #0e0e0e !important; font-family: inherit; }
        .leaflet-tooltip { background: #1c1b1b; border: none; color: white; border-radius: 2px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .leaflet-tooltip-top:before { border-top-color: #1c1b1b; }
      `}} />

      <div className="fixed top-8 right-8 z-[200] flex flex-col gap-4 pointer-events-none">
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

      <AnimatePresence>
        {newSubstationCreds && (
          <motion.div
            key="creds-modal"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-[#1c1b1b] border border-[#474747]/30 p-10 rounded-sm w-full max-w-md shadow-[0_30px_60px_rgba(0,0,0,0.9)]"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-6">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tighter mb-2">Node Initialized</h3>
              <p className="text-neutral-400 text-sm mb-8 leading-relaxed">
                Substation <strong className="text-white">{newSubstationCreds.name}</strong> is online. Provide these secure credentials to the local operator. They will not be displayed again.
              </p>
              <div className="space-y-4 mb-8">
                <div className="bg-[#0e0e0e] p-4 rounded-sm relative group">
                  <label className="block text-[10px] text-neutral-500 font-medium uppercase tracking-[0.1em] mb-1">Station Login ID</label>
                  <div className="text-xl font-mono text-white select-all tracking-wider">{newSubstationCreds.id}</div>
                </div>
                <div className="bg-[#0e0e0e] p-4 rounded-sm relative group">
                  <label className="block text-[10px] text-neutral-500 font-medium uppercase tracking-[0.1em] mb-1">Secure Passcode</label>
                  <div className="text-xl font-mono text-white select-all tracking-[0.2em]">{newSubstationCreds.passcode}</div>
                </div>
              </div>
              <button onClick={() => setNewSubstationCreds(null)} className="w-full bg-white hover:bg-neutral-200 text-[#1a1c1c] font-bold py-4 rounded-sm uppercase tracking-tight text-xs transition-colors">
                Secure & Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        
        {view === 'map' && (
          <motion.div key="map-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: 'blur(4px)' }} transition={{ duration: 0.8, ease: SMOOTH_EASE }} className="relative flex flex-col items-center justify-center h-screen p-8 overflow-hidden bg-[#131313]">
            <div className="absolute top-10 left-10 z-10 flex items-start gap-6">
              <div className="p-4 bg-white text-[#1a1c1c] rounded-sm"><Activity className="w-6 h-6" /></div>
              <div><h1 className="text-4xl font-bold tracking-tighter text-white uppercase leading-none">National Grid</h1><p className="text-neutral-400 text-[11px] tracking-widest uppercase mt-2">Central Command Overview</p></div>
            </div>
            <div className="relative w-full max-w-4xl lg:max-w-5xl aspect-square flex items-center justify-center mt-16">
              {mapData ? (
                <svg viewBox="0 0 800 900" className="w-full h-full overflow-visible relative z-10">
                  <g>
                    {mapData.map((state) => (
                      <g key={`group-${state.id}`}>
                        <path d={state.path} className="state-path" style={{ transformOrigin: `${state.centerX}px ${state.centerY}px` }} onClick={() => handleMapStateClick(state)} />
                        <text x={state.centerX} y={state.centerY} textAnchor="middle" fill="#ffffff" fontSize="11" className="pointer-events-none font-medium opacity-40 tracking-wider uppercase">{state.name}</text>
                      </g>
                    ))}
                  </g>
                </svg>
              ) : (
                <div className="flex flex-col items-center text-neutral-500 gap-6"><div className="w-6 h-6 rounded-full border-2 border-t-white border-white/20 animate-spin" /></div>
              )}
            </div>
            <div className="absolute bottom-10 left-10 text-neutral-500 flex items-center gap-4 z-10">
              <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_#5d5f5f] animate-pulse" />
              <span className="text-[11px] tracking-widest uppercase">Select Region to Authorize Admin Panel</span>
            </div>
          </motion.div>
        )}

        {view.includes('login') && (
          <motion.div key="login" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, filter: 'blur(4px)' }} transition={{ duration: 0.6, ease: SMOOTH_EASE }} className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#131313]">
            <button onClick={handleBack} className="absolute top-10 left-10 flex items-center gap-4 text-neutral-500 hover:text-white transition-colors font-medium tracking-widest uppercase text-[11px]"><ArrowLeft className="w-4 h-4"/> Abort Protocol</button>
            <div className="w-full max-w-md">
              <div className="mb-12">
                <h2 className="text-4xl font-bold text-white mb-4 tracking-tighter">Admin Dispatch</h2>
                <p className="text-neutral-400 font-medium text-sm mb-4">Regional Load Dispatch Center (RLDC)</p>
                {selectedState && <div className="inline-block px-3 py-1 bg-[#1c1b1b] text-neutral-300 font-medium tracking-widest uppercase text-[11px] rounded-sm">Target: {selectedState.name}</div>}
              </div>
              <form onSubmit={(e) => executeLogin(e, 'dashboard')} className="space-y-6 bg-[#1c1b1b] p-10 rounded-sm shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">Govt Admin ID</label>
                  <input type="text" required placeholder="ADM-7734" className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none transition-all font-mono text-white placeholder:text-neutral-600" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">Security Clearance Key</label>
                  <input type="password" required id="credential" name="credential" placeholder="••••••••" className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none transition-all text-white placeholder:text-neutral-600" />
                </div>
                <button type="submit" className="w-full text-[#1a1c1c] font-bold py-4 rounded-sm bg-white hover:bg-neutral-200 transition-all tracking-tight uppercase mt-6">Initiate Session</button>
              </form>
            </div>
          </motion.div>
        )}

        {view === 'dashboard' && (
          <motion.div key="dashboard-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="min-h-screen bg-[#131313] flex">
            <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.1, ease: SMOOTH_EASE }} className="w-20 lg:w-72 bg-[#1c1b1b] flex flex-col p-8 shrink-0 z-20">
              <div className="flex items-center gap-6 mb-16">
                <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_12px_#ffffff] shrink-0" />
                <div className="hidden lg:block">
                  <span className="font-bold text-xl tracking-tighter text-white block">RLDC Admin</span>
                  <span className="text-[11px] text-neutral-500 font-medium tracking-widest uppercase mt-1 block">{selectedState?.name}</span>
                </div>
              </div>
              <nav className="flex-1 space-y-4">
                <button onClick={() => setAdminTab('mapping')} className={`flex items-center gap-4 font-bold text-sm tracking-tight uppercase w-full ${adminTab === 'mapping' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-[22px]'}`}>
                  {adminTab === 'mapping' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />} Geographic Mapping
                </button>
                <button onClick={() => setAdminTab('analytics')} className={`flex items-center gap-4 font-bold text-sm tracking-tight uppercase w-full ${adminTab === 'analytics' ? 'text-white' : 'text-neutral-500 hover:text-white transition-colors pl-[22px]'}`}>
                  {adminTab === 'analytics' && <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />} Load Analytics
                </button>
              </nav>
              <button onClick={handleBack} className="mt-auto flex items-center gap-4 text-neutral-500 hover:text-white transition-all w-full group"><LogOut className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" /><span className="hidden lg:block font-bold uppercase tracking-tight text-sm">Terminate Session</span></button>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.2, ease: SMOOTH_EASE }} className="flex-1 overflow-y-auto p-4 lg:p-12 flex flex-col">
              <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 mb-12 shrink-0">
                <div><h2 className="text-4xl font-bold tracking-tighter text-white">Regional Telemetry</h2><p className="text-neutral-400 text-sm mt-2">Live grid data stream.</p></div>
                <div className="flex flex-col md:flex-row items-end md:items-center gap-6">
                  <div className="flex flex-wrap items-center gap-4">
                    <button onClick={() => { setShowAddSubstationModal(true); setIsAddMode(true); }} className="bg-[#2a2a2a] hover:bg-[#353534] text-white px-6 py-3 rounded-sm text-xs font-bold uppercase tracking-tight flex items-center gap-3 transition-colors"><PlusCircle className="w-4 h-4" /> Add Station</button>
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

              {adminTab === 'mapping' && (
                <div className="flex-1 min-h-[600px] grid grid-cols-1 xl:grid-cols-3 gap-8">
                  <div className="xl:col-span-2 bg-[#0e0e0e] rounded-sm flex flex-col relative overflow-hidden min-h-[500px] p-1 border border-[#474747]/15">
                    <div className="absolute top-6 left-6 z-20 pointer-events-none"><h3 className="text-[11px] font-medium tracking-widest uppercase text-neutral-400">Tactical GIS Mapping</h3></div>
                    {leafletReady && selectedState ? <LeafletMap selectedState={selectedState} substations={substations} selectedSubstationId={selectedSubstationId} onSelectSubstation={setSelectedSubstationId} isAddMode={isAddMode} onMapClick={handleMapClick} tempMarkerPos={tempMarkerPos} /> : <div className="w-full h-full flex items-center justify-center text-neutral-500"><Activity className="w-6 h-6 animate-spin text-neutral-600"/></div>}
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
                          <div className="bg-[#0e0e0e] p-6 rounded-sm flex-1 flex flex-col min-h-[200px]">
                              <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-[0.1em] mb-4">Terminal Logs</h4>
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
              )}

              {adminTab === 'analytics' && (
                <div className="bg-[#1c1b1b] rounded-sm p-8 flex-1 flex flex-col min-h-[600px]">
                  <h3 className="text-2xl font-bold tracking-tighter text-white mb-8">Regional Load Distribution</h3>
                  <div className="bg-[#0e0e0e] rounded-sm overflow-x-auto p-4 flex-1">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-neutral-500 text-[11px] font-medium uppercase tracking-[0.1em] border-b border-[#474747]/15">
                          <th className="p-4 font-normal">Substation</th>
                          <th className="p-4 font-normal">Location</th>
                          <th className="p-4 font-normal text-right">Voltage</th>
                          <th className="p-4 font-normal text-right">Load (MW)</th>
                          <th className="p-4 font-normal text-right">Capacity (MW)</th>
                          <th className="p-4 font-normal text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {substations.length === 0 ? (
                          <tr><td colSpan={6} className="p-8 text-center text-neutral-500 font-medium tracking-widest uppercase text-[11px]">No substations registered in this region.</td></tr>
                        ) : substations.map((sub, index) => {
                          const loadPercent = ((sub.currentLoadMW / sub.maxCapacityMW) * 100).toFixed(1);
                          return (
                            <tr key={sub.id} className={`border-b border-[#474747]/10 ${index % 2 === 0 ? 'bg-[#0e0e0e]' : 'bg-[#131313]'}`}>
                              <td className="p-4">
                                <div className="font-bold text-white">{sub.name}</div>
                                <div className="font-mono text-[10px] text-neutral-500 mt-1">{sub.id.split('-').slice(0,2).join('-').toUpperCase() || sub.id}</div>
                              </td>
                              <td className="p-4 text-neutral-400">{sub.location}</td>
                              <td className="p-4 font-mono text-right text-neutral-300">{sub.voltage} kV</td>
                              <td className="p-4 font-mono text-right text-sky-400">{sub.currentLoadMW}</td>
                              <td className="p-4 font-mono text-right text-neutral-300">{sub.maxCapacityMW}</td>
                              <td className="p-4">
                                <div className="flex items-center justify-center gap-3">
                                  <div className="w-16 h-1.5 bg-[#1c1b1b] rounded-full overflow-hidden hidden sm:block">
                                    <div className={`h-full ${sub.status === 'critical' ? 'bg-red-500' : sub.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(Number(loadPercent), 100)}%` }} />
                                  </div>
                                  <span className={`text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-1 rounded-sm border ${
                                    sub.status === 'critical' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                    sub.status === 'warning' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                                    'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                  }`}>
                                    {sub.status}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>

      <AnimatePresence>
        {showAddSubstationModal && (
            <motion.div key="add-substation-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-[#131313] flex">
              
              {/* Form pane (Moved to Left) */}
              <motion.div initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full md:w-96 bg-[#1c1b1b] border-r border-[#474747]/15 flex flex-col p-6 z-10 shadow-[20px_0_40px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between mb-6 shrink-0">
                  <h3 className="text-xl font-bold text-white tracking-tighter">Add Substation</h3>
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
                        <input type="text" required placeholder={placeholder} value={addFormData[key as keyof typeof addFormData]} onChange={(e) => setAddFormData({ ...addFormData, [key]: e.target.value })} className="w-full bg-[#353534] focus:bg-[#393939] focus:outline-none transition-all py-2 px-3 text-white placeholder:text-neutral-600 rounded-sm text-sm" />
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
                          <input type="number" required step="0.000001" placeholder={placeholder} value={addFormData[key as keyof typeof addFormData]} onChange={(e) => setAddFormData({ ...addFormData, [key]: e.target.value })} className="w-full bg-[#353534] focus:bg-[#393939] focus:outline-none transition-all py-2 px-3 text-white placeholder:text-neutral-600 rounded-sm text-xs font-mono" />
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
                        <input type="number" required min="0" placeholder={placeholder} value={addFormData[key as keyof typeof addFormData]} onChange={(e) => setAddFormData({ ...addFormData, [key]: e.target.value })} className="w-full bg-[#353534] focus:bg-[#393939] focus:outline-none transition-all py-2 px-3 text-white placeholder:text-neutral-600 rounded-sm text-sm font-mono" />
                      </div>
                    ))}
                  </div>
                  <div className="bg-[#0e0e0e] p-3 rounded-sm border border-[#474747]/30 text-xs text-neutral-400 space-y-1 mt-4">
                    <p className="font-semibold text-neutral-300">Automatic Credential Generation:</p>
                    <p>✓ Station ID will be auto-generated (SUB-XXX)</p>
                    <p>✓ Secure Passcode will be auto-generated</p>
                  </div>
                  <div className="flex gap-3 mt-auto pt-4 border-t border-[#474747]/15 shrink-0">
                    <button type="button" onClick={closeAddSubstationModal} className="flex-1 bg-[#2a2a2a] hover:bg-[#353534] text-white py-2 px-3 rounded-sm transition-all tracking-tight uppercase text-xs font-bold">Cancel</button>
                    <button type="submit" className="flex-1 bg-white hover:bg-neutral-100 text-[#1a1c1c] font-bold py-2 px-3 rounded-sm transition-all tracking-tight uppercase text-xs">Create</button>
                  </div>
                </form>
              </motion.div>

              {/* Map pane (Moved to Right) */}
              <motion.div initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} className="flex-1 hidden md:flex flex-col relative z-0">
                {leafletReady && selectedState ? (
                  <LeafletMap selectedState={selectedState} substations={substations} selectedSubstationId={selectedSubstationId} onSelectSubstation={setSelectedSubstationId} isAddMode={true} onMapClick={handleMapClick} tempMarkerPos={tempMarkerPos} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-500"><Activity className="w-6 h-6 animate-spin" /></div>
                )}
                <div className="absolute top-6 right-6 z-20 pointer-events-none"><h3 className="text-[11px] font-medium tracking-widest uppercase text-neutral-400 bg-black/50 px-3 py-2 rounded">Click map to select location</h3></div>
              </motion.div>

            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEngineerModal && (
          <motion.div key="add-engineer-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#1c1b1b] border border-[#474747]/15 rounded-sm p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white tracking-tighter">Add Engineer</h3>
                <button onClick={closeEngineerModal} className="text-neutral-500 hover:text-white transition-colors text-lg">✕</button>
              </div>
              <form onSubmit={handleAddEngineer} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-2">Engineer Name</label>
                  <input type="text" required placeholder="e.g., Rajesh Kumar" value={engineerFormData.name} onChange={(e) => setEngineerFormData({ ...engineerFormData, name: e.target.value })} className="w-full bg-[#353534] focus:bg-[#393939] focus:outline-none transition-all py-2 px-3 text-white placeholder:text-neutral-600 rounded-sm text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-2">Email Address</label>
                  <input type="email" required placeholder="e.g., rajesh@example.com" value={engineerFormData.email} onChange={(e) => setEngineerFormData({ ...engineerFormData, email: e.target.value })} className="w-full bg-[#353534] focus:bg-[#393939] focus:outline-none transition-all py-2 px-3 text-white placeholder:text-neutral-600 rounded-sm text-sm" />
                  <p className="text-[11px] text-neutral-500 mt-2">Credentials will be sent to this email</p>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-2">Assigned Region</label>
                  <select required value={engineerFormData.region} onChange={(e) => setEngineerFormData({ ...engineerFormData, region: e.target.value })} className="w-full bg-[#353534] focus:bg-[#393939] focus:outline-none transition-all py-2 px-3 text-white rounded-sm text-sm appearance-none cursor-pointer">
                    <option value="">Select a region</option>
                    {mapData?.map((state) => (
                      <option key={state.id} value={state.name}>{state.name}</option>
                    ))}
                  </select>
                </div>
                <div className="bg-[#0e0e0e] p-3 rounded-sm border border-[#474747]/30 text-xs text-neutral-400 space-y-1 mt-4">
                  <p className="font-semibold text-neutral-300">Automatic Credential Generation:</p>
                  <p>✓ Badge ID will be auto-generated (ENG-XXX)</p>
                  <p>✓ Auth PIN will be auto-generated (6 digits)</p>
                  <p>✓ Credentials sent via email</p>
                </div>
                <div className="flex gap-3 mt-6 pt-4 border-t border-[#474747]/15">
                  <button type="button" onClick={closeEngineerModal} className="flex-1 bg-[#2a2a2a] hover:bg-[#353534] text-white py-2 px-3 rounded-sm transition-all tracking-tight uppercase text-xs font-bold">Cancel</button>
                  <button type="submit" disabled={isSubmittingEngineer} className="flex-1 bg-white hover:bg-neutral-100 disabled:bg-neutral-500 text-[#1a1c1c] font-bold py-2 px-3 rounded-sm transition-all tracking-tight uppercase text-xs">{isSubmittingEngineer ? 'Creating...' : 'Create & Send'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}