"use client";

import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import EngineerLogin from '@/components/engineer/EngineerLogin';
import EngineerDashboard from '@/components/engineer/dashboard/EngineerDashboard';

type ViewState = 'login-engineer' | 'engineer-portal';

export default function EngineerDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<ViewState>('login-engineer');
  const [engineerEmail, setEngineerEmail] = useState('');
  const [engineerName, setEngineerName] = useState('');
  const [region, setRegion] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);

  // On mount, restore credentials from localStorage and check URL params
  useEffect(() => {
    const savedEmail = localStorage.getItem('engineerEmail') || '';
    const savedName = localStorage.getItem('engineerName') || '';
    const savedRegion = localStorage.getItem('engineerRegion') || '';

    if (savedEmail && savedName && savedRegion) {
      setEngineerEmail(savedEmail);
      setEngineerName(savedName);
      setRegion(savedRegion);
      setView('engineer-portal');
    }

    setIsHydrated(true);
  }, []);

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!engineerEmail || !engineerName || !region) return;

    const trimmedEmail = engineerEmail.trim().toLowerCase();
    const trimmedName = engineerName.trim();

    localStorage.setItem('engineerEmail', trimmedEmail);
    localStorage.setItem('engineerName', trimmedName);
    localStorage.setItem('engineerRegion', region);

    setEngineerEmail(trimmedEmail);
    setEngineerName(trimmedName);
    setView('engineer-portal');
  };

  const handleClockOut = () => {
    localStorage.removeItem('engineerEmail');
    localStorage.removeItem('engineerName');
    localStorage.removeItem('engineerRegion');
    
    setEngineerEmail('');
    setEngineerName('');
    setRegion('');
    setView('login-engineer');
  };

  if (!isHydrated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#131313] text-neutral-200 overflow-hidden font-sans selection:bg-white/20">
      <AnimatePresence mode="wait">
        {view === 'login-engineer' && (
          <EngineerLogin
            region={region}
            engineerEmail={engineerEmail}
            engineerName={engineerName}
            onRegionChange={setRegion}
            onEmailChange={setEngineerEmail}
            onNameChange={setEngineerName}
            onSubmit={handleLogin}
          />
        )}
        {view === 'engineer-portal' && (
          <EngineerDashboard
            engineerEmail={engineerEmail}
            engineerName={engineerName}
            region={region}
            onClockOut={handleClockOut}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
