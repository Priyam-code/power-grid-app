"use client";
import React, { useEffect, useRef } from 'react';
import { Substation } from '../types';

export default function LeafletMap({ selectedState, substations, selectedSubstationId, onSelectSubstation }: any) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});

  useEffect(() => {
    if (!mapRef.current || !window.L || mapInstance.current) return;
    const map = window.L.map(mapRef.current, { zoomControl: false }).fitBounds([
      [selectedState.minLat, selectedState.minLon], [selectedState.maxLat, selectedState.maxLon]
    ]);
    window.L.tileLayer('https://{s}[.basemaps.cartocdn.com/dark_all/](https://.basemaps.cartocdn.com/dark_all/){z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);
    mapInstance.current = map;
    return () => {
      if (mapInstance.current) mapInstance.current.remove();
      mapInstance.current = null;
      markersRef.current = {}; 
    };
  }, [selectedState]);

  useEffect(() => {
    if (!mapInstance.current || !window.L) return;
    substations.forEach((sub: Substation) => {
      const isCritical = sub.status === 'warning' || sub.status === 'critical';
      const color = isCritical ? '#ef4444' : '#ffffff'; 
      const glowColor = isCritical ? 'rgba(239,68,68,0.5)' : '#5d5f5f';
      const isSelected = sub.id === selectedSubstationId;
      const size = isSelected ? 24 : 12; 

      const html = `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; box-shadow: 0 0 15px ${glowColor}; opacity: ${isSelected ? 1 : 0.6}; transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1); cursor: pointer;"></div>`;
      const icon = window.L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });

      if (markersRef.current[sub.id]) {
        markersRef.current[sub.id].setIcon(icon);
      } else {
        const marker = window.L.marker([sub.lat, sub.lon], { icon }).addTo(mapInstance.current);
        marker.on('click', () => onSelectSubstation(sub.id));
        marker.bindTooltip(`<div class="font-sans text-[11px] tracking-[0.1em] uppercase">${sub.name} <br/> <span class="text-neutral-400">${sub.currentLoadMW} MW</span></div>`, { direction: 'top', offset: [0, -10] });
        markersRef.current[sub.id] = marker;
      }
    });

    if (selectedSubstationId && markersRef.current[selectedSubstationId]) {
       const sub = substations.find((s: Substation) => s.id === selectedSubstationId);
       if (sub) mapInstance.current.flyTo([sub.lat, sub.lon], Math.max(mapInstance.current.getZoom(), 8), { animate: true, duration: 1 });
    }
  }, [substations, selectedSubstationId, onSelectSubstation]);

  return <div ref={mapRef} className="w-full h-full z-0 bg-[#0e0e0e]" />;
}
