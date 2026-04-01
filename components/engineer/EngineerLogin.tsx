"use client";

import React from 'react';
import { motion, cubicBezier } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

const SMOOTH_EASE = cubicBezier(0.22, 1, 0.36, 1);

const STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
];

interface EngineerLoginProps {
  region: string;
  badgeId: string;
  credential: string;
  onRegionChange: (value: string) => void;
  onBadgeIdChange: (value: string) => void;
  onCredentialChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export default function EngineerLogin({
  region,
  badgeId,
  credential,
  onRegionChange,
  onBadgeIdChange,
  onCredentialChange,
  onSubmit
}: EngineerLoginProps) {
  const router = useRouter();

  return (
    <motion.div
      key="login"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, filter: 'blur(4px)' }}
      transition={{ duration: 0.6, ease: SMOOTH_EASE }}
      className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#131313]"
    >
      <button
        onClick={() => router.push('/')}
        className="absolute top-10 left-10 flex items-center gap-4 text-neutral-500 hover:text-white transition-colors font-medium tracking-widest uppercase text-[11px]"
      >
        <ArrowLeft className="w-4 h-4" />
        Abort Protocol
      </button>
      <div className="w-full max-w-md">
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-white mb-4 tracking-tighter">Urja Setu Login</h2>
          <p className="text-neutral-400 font-medium text-sm mb-4">Engineer Dispatch Application</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6 bg-[#1c1b1b] p-10 rounded-sm shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
          <div>
            <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">Assigned Region</label>
            <select
              required
              value={region}
              onChange={(e) => onRegionChange(e.target.value)}
              className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none transition-all text-white"
            >
              <option value="">Select a state...</option>
              {STATES.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">Technician Badge</label>
            <input
              type="text"
              required
              name="badgeId"
              value={badgeId}
              onChange={(e) => onBadgeIdChange(e.target.value)}
              placeholder="ENG-884"
              className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none transition-all font-mono text-white placeholder:text-neutral-600"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-neutral-500 uppercase tracking-widest mb-3">Auth PIN</label>
            <input
              type="password"
              required
              name="credential"
              value={credential}
              onChange={(e) => onCredentialChange(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#353534] border border-transparent focus:bg-[#393939] focus:border-white/20 rounded-sm py-4 px-4 outline-none transition-all text-white placeholder:text-neutral-600"
            />
          </div>

          <button type="submit" className="w-full text-[#1a1c1c] font-bold py-4 rounded-sm bg-white hover:bg-neutral-200 transition-all tracking-tight uppercase mt-6">
            Login
          </button>
        </form>
      </div>
    </motion.div>
  );
}
