'use client';

import { useEffect, useState } from 'react';

interface CountdownProps {
  targetDate: string;
  coupleName: string;
  onEnter?: () => void;
}

function calcDiff(target: Date): { days: number; hours: number; minutes: number; seconds: number } {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

export function Countdown({ targetDate, coupleName, onEnter }: CountdownProps) {
  const [diff, setDiff] = useState(() => calcDiff(new Date(targetDate)));

  useEffect(() => {
    const id = setInterval(() => setDiff(calcDiff(new Date(targetDate))), 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-brand/5 to-background text-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand/10 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 space-y-8">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-widest text-text-muted">Ci sposiamo tra</p>
          <h1 className="text-4xl sm:text-5xl font-bold">{coupleName}</h1>
        </div>

        <div className="grid grid-cols-4 gap-4 max-w-sm mx-auto">
          {[
            { value: diff.days, label: 'Giorni' },
            { value: diff.hours, label: 'Ore' },
            { value: diff.minutes, label: 'Minuti' },
            { value: diff.seconds, label: 'Secondi' },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center">
              <span className="text-3xl sm:text-4xl font-bold tabular-nums text-brand">{pad(value)}</span>
              <span className="text-xs text-text-muted uppercase tracking-wider mt-1">{label}</span>
            </div>
          ))}
        </div>

        {onEnter && (
          <button
            onClick={onEnter}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-brand text-white font-medium hover:opacity-90 transition-opacity shadow-lg"
          >
            Entra nell'app
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
          </button>
        )}
      </div>
    </div>
  );
}
