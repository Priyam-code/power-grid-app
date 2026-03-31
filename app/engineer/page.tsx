"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import EngineerLogin from '@/components/engineer/EngineerLogin';
import EngineerDashboard from '@/components/engineer/dashboard/EngineerDashboard';

type ViewState = 'login-engineer' | 'engineer-portal';

function EngineerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<ViewState>('login-engineer');
  const [badgeId, setBadgeId] = useState('');
  const [credential, setCredential] = useState('');
  const [engineerName, setEngineerName] = useState('');
  const [region, setRegion] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);

  // On mount, restore credentials from localStorage
  useEffect(() => {
    const savedBadgeId = localStorage.getItem('engineerBadgeId') || '';
    const savedName = localStorage.getItem('engineerName') || '';
    const savedRegion = localStorage.getItem('engineerRegion') || '';

    if (savedBadgeId && savedName && savedRegion) {
      setBadgeId(savedBadgeId);
      setEngineerName(savedName);
      setRegion(savedRegion);
      setView('engineer-portal');
    }

    setIsHydrated(true);
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!badgeId || !credential || !region) return;

    try {
      const res = await fetch('/api/engineers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badgeId, credential, region })
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Invalid credentials');
        return;
      }

      const result = await res.json();
      const engineer = result.data;

      localStorage.setItem('engineerBadgeId', engineer.badgeId);
      localStorage.setItem('engineerName', engineer.name);
      localStorage.setItem('engineerRegion', engineer.region);

      setBadgeId(engineer.badgeId);
      setEngineerName(engineer.name);
      setRegion(engineer.region);
      setCredential('');
      setView('engineer-portal');
    } catch (err) {
      console.error('Login error:', err);
      alert('Login failed, please try again');
    }
  };

  const handleClockOut = () => {
    localStorage.removeItem('engineerBadgeId');
    localStorage.removeItem('engineerName');
    localStorage.removeItem('engineerRegion');
    
    setBadgeId('');
    setCredential('');
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
            badgeId={badgeId}
            credential={credential}
            onRegionChange={setRegion}
            onBadgeIdChange={setBadgeId}
            onCredentialChange={setCredential}
            onSubmit={handleLogin}
          />
        )}
        {view === 'engineer-portal' && (
          <EngineerDashboard
            engineerName={engineerName}
            badgeId={badgeId}
            region={region}
            onClockOut={handleClockOut}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function EngineerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#131313] text-neutral-200 flex items-center justify-center">Loading...</div>}>
      <EngineerPageContent />
    </Suspense>
  );
}
