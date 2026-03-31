"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import EngineerLogin from '@/components/engineer/EngineerLogin';
import EngineerDashboard from '@/components/engineer/dashboard/EngineerDashboard';

type ViewState = 'login-engineer' | 'engineer-portal';

function EngineerPageContent() {
  const [view, setView] = useState<ViewState>('login-engineer');
  const [badgeId, setBadgeId] = useState('');
  const [credential, setCredential] = useState('');
  const [engineerName, setEngineerName] = useState('');
  const [engineerEmail, setEngineerEmail] = useState(''); // NEW
  const [region, setRegion] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const savedBadgeId = localStorage.getItem('engineerBadgeId') || '';
    const savedName = localStorage.getItem('engineerName') || '';
    const savedRegion = localStorage.getItem('engineerRegion') || '';
    const savedEmail = localStorage.getItem('engineerEmail') || ''; // NEW

    if (savedBadgeId && savedName && savedRegion && savedEmail) {
      setBadgeId(savedBadgeId);
      setEngineerName(savedName);
      setRegion(savedRegion);
      setEngineerEmail(savedEmail);
      setView('engineer-portal');
    }
    setIsHydrated(true);
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/engineers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badgeId, credential, region })
      });

      const result = await res.json();
      if (!res.ok) {
        alert(result.error || 'Invalid credentials');
        return;
      }

      const engineer = result.data;

      // --- THE FIX: Handle both snake_case and camelCase ---
      const email = engineer.email || engineer.engineer_email;
      const name = engineer.name || engineer.engineer_name;
      const bId = engineer.badgeId || engineer.badge_id;
      const reg = engineer.region;

      if (!email) {
        console.error("Login successful but no email returned from DB!");
      }

      // Save to localStorage
      localStorage.setItem('engineerBadgeId', bId);
      localStorage.setItem('engineerName', name);
      localStorage.setItem('engineerRegion', reg);
      localStorage.setItem('engineerEmail', email); 

      // Update State
      setBadgeId(bId);
      setEngineerName(name);
      setRegion(reg);
      setEngineerEmail(email); 
      
      setCredential('');
      setView('engineer-portal');
    } catch (err) {
      alert('Login failed');
    }
  };

 const handleClockOut = () => {
  // Use .clear() to be 100% sure everything is gone
  localStorage.clear(); 
  
  // Reset all states
  setBadgeId('');
  setEngineerName('');
  setEngineerEmail('');
  setRegion('');
  setView('login-engineer');
};
  if (!isHydrated) return null;

  return (
    <div className="min-h-screen bg-[#131313] text-neutral-200 font-sans">
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
            engineerEmail={engineerEmail} // PASS EMAIL HERE
            onClockOut={handleClockOut}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function EngineerPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EngineerPageContent />
    </Suspense>
  );
}