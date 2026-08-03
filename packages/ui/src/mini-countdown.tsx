'use client';

import { useEffect, useState } from 'react';

interface MiniCountdownProps {
  targetDate: string;
  /** Mostra il countdown solo nelle ultime 24 ore. Prima mostra solo i giorni. */
  detailedWithinHours?: number;
  labels?: {
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
  };
}

function calcDiff(target: Date): { days: number; hours: number; minutes: number; seconds: number; totalMs: number } {
  const totalMs = target.getTime() - Date.now();
  if (totalMs <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
  return {
    days: Math.floor(totalMs / 86400000),
    hours: Math.floor((totalMs % 86400000) / 3600000),
    minutes: Math.floor((totalMs % 3600000) / 60000),
    seconds: Math.floor((totalMs % 60000) / 1000),
    totalMs,
  };
}

const DEFAULT_LABELS = {
  days: 'Giorni',
  hours: 'Ore',
  minutes: 'Minuti',
  seconds: 'Secondi',
};

const ABBR: Record<string, string> = {
  days: 'g',
  hours: 'h',
  minutes: 'm',
  seconds: 's',
};

export function MiniCountdown({
  targetDate,
  detailedWithinHours = 24,
  labels: userLabels,
}: MiniCountdownProps) {
  const labels = { ...DEFAULT_LABELS, ...userLabels };
  const [diff, setDiff] = useState(() => calcDiff(new Date(targetDate)));

  useEffect(() => {
    const tick = () => setDiff(calcDiff(new Date(targetDate)));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (diff.totalMs <= 0) return null;

  const hoursRemaining = diff.totalMs / 3600000;
  const pad = (n: number) => String(n).padStart(2, '0');

  const abbr = ABBR;

  if (hoursRemaining > detailedWithinHours) {
    return (
      <span className="inline-flex items-baseline gap-1 tabular-nums text-muted-foreground text-sm">
        <span className="font-semibold">{diff.days} {abbr.days}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-baseline gap-1 tabular-nums text-muted-foreground text-sm">
      {diff.days > 0 && <span className="font-semibold">{diff.days} {abbr.days}</span>}
      <span className="font-semibold">{pad(diff.hours)}{abbr.hours}</span>
      <span className="font-semibold">{pad(diff.minutes)}{abbr.minutes}</span>
      <span className="font-semibold">{pad(diff.seconds)}{abbr.seconds}</span>
    </span>
  );
}
