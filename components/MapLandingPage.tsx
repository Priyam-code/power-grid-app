"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Globe, MapPin } from 'lucide-react';
import { StateData } from '../types';

const SMOOTH_EASE = [0.22, 1, 0.36, 1];

export default function MapLandingPage({ mapData, setView, handleMapStateClick }: any) {
  return (
    <motion.div key="map-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: 'blur(4px)' }} transition={{ duration: 0.8, ease: SMOOTH_EASE }} className="relative flex flex-col items-center justify-center h-screen p-8 overflow-hidden bg-[#131313]">
      <div className="absolute top-10 left-10 z-10 flex items-start gap-6">
        <div className="p-4 bg-white text-[#1a1c1c] rounded-sm"><Activity className="w-6 h-6" /></div>
        <div>
          <h1 className="text-4xl font-bold tracking-tighter text-white uppercase leading-none">National Grid</h1>
          <p className="text-neutral-400 text-[11px] tracking-[0.1em] uppercase mt-2">Central Command Overview</p>
        </div>
      </div>
      <div className="absolute top-10 right-10 z-10 flex flex-col gap-4 items-end">
        <div className="text-[11px] text-neutral-500 font-medium tracking-[0.1em] uppercase mb-2">Access Protocol</div>
        <button onClick={() => setView('login-manager')} className="flex items-center gap-4 px-6 py-4 rounded-sm transition-all w-64 bg-[#1c1b1b] hover:bg-[#201f1f] border border-[#474747]/15 group">
          <div className="w-2 h-2 rounded-full bg-white opacity-40 group-hover:opacity-100 group-hover:shadow-[0_0_10px_#ffffff] transition-all" />
          <span className="font-bold tracking-tight text-sm uppercase text-neutral-300 group-hover:text-white">Substation Mgr</span>
        </button>
        <button onClick={() => setView('login-engineer')} className="flex items-center gap-4 px-6 py-4 rounded-sm transition-all w-64 bg-[#1c1b1b] hover:bg-[#201f1f] border border-[#474747]/15 group">
          <div className="w-2 h-2 rounded-full bg-white opacity-40 group-hover:opacity-100 group-hover:shadow-[0_0_10px_#ffffff] transition-all" />
          <span className="font-bold tracking-tight text-sm uppercase text-neutral-300 group-hover:text-white">Field Engineer</span>
        </button>
      </div>
      <div className="relative w-full max-w-4xl lg:max-w-5xl aspect-square flex items-center justify-center mt-16">
        {mapData ? (
          <svg viewBox="0 0 800 900" className="w-full h-full overflow-visible relative z-10">
            <g>
              {mapData.map((state: StateData) => <path key={`shadow-${state.id}`} d={state.path} fill="#090909" transform="translate(-6, 16)" className="pointer-events-none" />)}
              {mapData.map((state: StateData) => (
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
        <span className="text-[11px] tracking-[0.1em] uppercase">Select Region to Authorize Admin Panel</span>
      </div>
    </motion.div>
  );
}
