"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ShieldCheck, Server, HardHat, ChevronRight, User as UserIcon, Lock } from 'lucide-react';
import { StateData } from '../types';

const SMOOTH_EASE = [0.22, 1, 0.36, 1];

export default function AuthLoginScreen({ view, executeLogin, handleBack, mapData, loginStateId, setLoginStateId, selectedState }: any) {
  const isEng = view === 'login-engineer';
  const isMgr = view === 'login-manager';
  
  return (
    <motion.div key={view} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, filter: 'blur(4px)' }} transition={{ duration: 0.6, ease: SMOOTH_EASE }} className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#131313]">
      <button onClick={handleBack} className="absolute top-10 left-10 flex items-center gap-4 text-neutral-500 hover:text-white transition-colors font-medium tracking-[0.1em] uppercase text-[11px]"><ArrowLeft className="w-4 h-4"/> Abort Protocol</button>
      <div className="w-full max-w-md">
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-white mb-4 tracking-tighter">{isEng ? 'Field Ops Login' : isMgr ? 'Substation Terminal' : 'Admin Dispatch'}</h2>
          <p className="text-neutral-400 font-medium text-sm mb-4">{isEng ? 'Engineer Dispatch Application' : isMgr ? 'Local Node Telemetry Access' : 'Regional Load Dispatch Center (RLDC)'}</p>
          {!isEng && !isMgr && selectedState && <div className="inline-block px-3 py-1 bg-[#1c1b1b] text-neutral-300 font-medium tracking-[0.1em] uppercase text-[11px] rounded-sm">Target: {selectedState.name}</div>}
        </div>
        <form onSubmit={(e) => executeLogin(e, isEng ? 'engineer-portal' : isMgr ? 'manager-portal' : 'dashboard')} className="space-y-6 bg-[#1c1b1b] p-10 rounded-sm">
          {(isEng || isMgr) ? (
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-[0.1em] mb-3">{isEng ? 'Assigned Region' : 'Operating Region'}</label>
              <select value={loginStateId} onChange={(e) => setLoginStateId(e.target.value)} className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none text-white appearance-none cursor-pointer">
                 {mapData?.map((s: StateData) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-[0.1em] mb-3">Govt Admin ID</label>
              <input type="text" required placeholder="ADM-7734" className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none transition-all font-mono text-white placeholder:text-neutral-600" />
            </div>
          )}
          {isEng || isMgr ? (
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-[0.1em] mb-3">{isEng ? 'Technician Badge' : 'Station Master ID'}</label>
              <input type="text" required placeholder={isEng ? "ENG-884" : "MGR-102"} className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none transition-all font-mono text-white placeholder:text-neutral-600" />
            </div>
          ) : null}
          <div>
            <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-[0.1em] mb-3">{isEng ? 'Auth PIN' : 'Security Clearance Key'}</label>
            <input type="password" required placeholder="••••••••" className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none transition-all text-white placeholder:text-neutral-600" />
          </div>
          <button type="submit" className="w-full text-[#1a1c1c] font-bold py-4 rounded-sm bg-white hover:bg-neutral-200 transition-all tracking-tight uppercase mt-6">
            {isEng ? 'Clock In' : isMgr ? 'Access Terminal' : 'Initiate Session'}
          </button>
        </form>
      </div>
    </motion.div>
  );
}
