'use client';

import { useEffect, useState } from 'react';
import { getEventPhase, type EventPhase } from '@fotosposi/site-builder';

interface CountdownProps {
  targetDate: string;
  coupleName: string;
  /** Titolo di benvenuto custom (es. "Benvenuti al Matrimonio di Elena e Mario"). Se assente, usa coupleName. */
  welcomeTitle?: string;
  onEnter?: () => void;
  ceremonyTime?: string;
  receptionTime?: string;
  time?: string;
  ceremonyAddress?: string;
  receptionAddress?: string;
  /** Logo brand da mostrare nella fase ended sotto il messaggio (URL pubblico o data URI). */
  brandLogoDataUri?: string | null;
  /** Alt (testo del logo) per accessibilità. */
  brandLogoAlt?: string;
  /** Etichette i18n passate dal caller (per evitare dipendenze next-intl in packages/ui). */
  labels?: {
    countdown_intro: string;
    days: string;
    hours: string;
    minutes: string;
    seconds: string;
    enter_app: string;
    ceremony_title: string;
    ceremony_subtitle: string;
    reception_title: string;
    reception_subtitle: string;
    ended_title: string;
    ended_subtitle: string;
  };
  /** Render custom sotto al countdown card per iniettare AddToCalendarMenu (app level). */
  children?: React.ReactNode;
  /** Sfondo immagine (opzionale): mobile portrait + desktop wide. Se assenti, resta il gradiente. */
  backgroundImageMobile?: string;
  backgroundImageDesktop?: string;
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

const DEFAULT_LABELS = {
  countdown_intro: 'Ci sposiamo tra',
  days: 'Giorni',
  hours: 'Ore',
  minutes: 'Minuti',
  seconds: 'Secondi',
  enter_app: 'Entra nell\'app',
  ceremony_title: 'Benvenuti alla cerimonia!',
  ceremony_subtitle: 'Stiamo per dire il nostro Sì',
  reception_title: 'Benvenuti al ricevimento!',
  reception_subtitle: 'Che la festa abbia inizio',
  ended_title: 'Grazie di aver reso questo giorno ancora più bello',
  ended_subtitle: 'Con affetto, i vostri Sposi',
};

export function Countdown({
  targetDate,
  coupleName,
  welcomeTitle,
  onEnter,
  ceremonyTime,
  receptionTime,
  time,
  ceremonyAddress,
  receptionAddress,
  brandLogoDataUri,
  brandLogoAlt,
  labels: userLabels,
  children,
  backgroundImageMobile,
  backgroundImageDesktop,
}: CountdownProps) {
  const labels = { ...DEFAULT_LABELS, ...userLabels };
  const [phase, setPhase] = useState<EventPhase>(() =>
    getEventPhase({ date: targetDate, ceremonyTime, receptionTime, time }),
  );
  const [diff, setDiff] = useState(() => calcDiff(new Date(targetDate)));

  useEffect(() => {
    const tick = () => {
      setPhase(getEventPhase({ date: targetDate, ceremonyTime, receptionTime, time }));
      setDiff(calcDiff(new Date(targetDate)));
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate, ceremonyTime, receptionTime, time]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const hasBgImage = Boolean(backgroundImageMobile && backgroundImageDesktop);
  const mutedClass = hasBgImage ? 'text-white/80' : 'text-text-muted';
  const brandTextClass = hasBgImage ? 'text-white' : 'text-brand';
  const headingClass = hasBgImage ? 'text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]' : '';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-brand/5 to-background text-center px-4 relative overflow-hidden">
      {backgroundImageMobile && backgroundImageDesktop ? (
        <>
          <img
            src={backgroundImageMobile}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover md:hidden pointer-events-none"
          />
          <img
            src={backgroundImageDesktop}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover hidden md:block pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/55 to-black/85 pointer-events-none" />
          <div className="absolute inset-0 backdrop-blur-[2px] pointer-events-none" />
        </>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand/10 via-transparent to-transparent pointer-events-none" />
      )}

      <div className="relative z-10 space-y-8 max-w-2xl mx-auto">
        <div className="space-y-2">
          <h1 className={`text-4xl sm:text-5xl font-bold ${headingClass}`}>
            {welcomeTitle ?? coupleName}
          </h1>
        </div>

        {phase === 'countdown' && (
          <>
            <p className={`text-sm uppercase tracking-widest ${mutedClass}`}>
              {labels.countdown_intro}
            </p>
            <div className="grid grid-cols-4 gap-4 max-w-sm mx-auto">
              {[
                { value: diff.days, label: labels.days },
                { value: diff.hours, label: labels.hours },
                { value: diff.minutes, label: labels.minutes },
                { value: diff.seconds, label: labels.seconds },
              ].map(({ value, label }) => (
                <div key={label} className="flex flex-col items-center">
                  <span className={`text-3xl sm:text-4xl font-bold tabular-nums ${brandTextClass}`}>
                    {pad(value)}
                  </span>
                  <span className={`text-xs ${mutedClass} uppercase tracking-wider mt-1`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {phase === 'ceremony' && (
          <div className="space-y-3">
            <div className="text-5xl">💍</div>
            <h2 className={`text-2xl sm:text-3xl font-semibold ${brandTextClass}`}>
              {labels.ceremony_title}
            </h2>
            <p className={mutedClass}>{labels.ceremony_subtitle}</p>
            {ceremonyAddress && (
              <p className={`text-sm ${mutedClass} italic`}>{ceremonyAddress}</p>
            )}
          </div>
        )}

        {phase === 'reception' && (
          <div className="space-y-3">
            <div className="text-5xl">🥂</div>
            <h2 className={`text-2xl sm:text-3xl font-semibold ${brandTextClass}`}>
              {labels.reception_title}
            </h2>
            <p className={mutedClass}>{labels.reception_subtitle}</p>
            {receptionAddress && (
              <p className={`text-sm ${mutedClass} italic`}>{receptionAddress}</p>
            )}
          </div>
        )}

        {phase === 'ended' && (
          <div className="space-y-4">
            <div className="text-5xl">❤️</div>
            <h2 className={`text-2xl sm:text-3xl font-semibold ${headingClass}`}>{labels.ended_title}</h2>
            <p className={`text-base sm:text-lg ${mutedClass} max-w-md mx-auto leading-relaxed`}>{labels.ended_subtitle}</p>
            {brandLogoDataUri && (
              <img
                src={brandLogoDataUri}
                alt={brandLogoAlt ?? ''}
                className="h-10 sm:h-12 mx-auto mt-3"
                aria-hidden={!brandLogoAlt}
              />
            )}
          </div>
        )}

        {children && <div className="pt-2">{children}</div>}

        {onEnter && (
          <button
            onClick={onEnter}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-brand text-white font-medium hover:opacity-90 transition-opacity shadow-lg"
          >
            {labels.enter_app}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
