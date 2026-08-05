'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getEventFeatures, getQuizQuestions, AVAILABLE_FEATURES } from '@fotosposi/games';
import type { EventFeature } from '@fotosposi/games';
import { hasFeature } from '@fotosposi/core';
import type { Tier } from '@fotosposi/core';
import { Button } from '@/components/ui/button';

export default function GamesHubPage() {
  const params = useParams();
  const eventId = params.id as string;
  const [features, setFeatures] = useState<EventFeature[]>([]);
  const [tier, setTier] = useState<Tier | null>(null);
  const [quizCount, setQuizCount] = useState(0);
  const t = useTranslations('games');
  const c = useTranslations('common');

  useEffect(() => {
    if (!eventId) return;
    getEventFeatures(eventId).then((r) => { if (r.features) setFeatures(r.features); });
    getQuizQuestions(eventId).then((r) => { if (r.questions) setQuizCount(r.questions.length); });
    // getEventTier degrada all'anon key nel browser → RLS blocca la lettura di events.
    // La route server-side usa il service role.
    fetch(`/api/events/${eventId}/tier`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.tier) setTier(d.tier); })
      .catch(() => {});
  }, [eventId]);

  const isEnabled = (key: string) => features.find((f) => f.feature_key === key)?.enabled ?? false;
  const featureInfo = (key: string) => AVAILABLE_FEATURES.find((af) => af.key === key);
  const canUse = (key: string) => {
    const info = featureInfo(key);
    if (!info) return false;
    if (!tier) return false;
    return isEnabled(key) && hasFeature(tier, key);
  };
  const isLocked = (key: string) => {
    if (!tier) return true;
    return !hasFeature(tier, key);
  };
  const needsTier = (key: string) => {
    const info = featureInfo(key);
    return info && info.tier !== 'free' ? info.tier : null;
  };

  return (
    <main style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>{t('hub_title')}</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {tier && (
            <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', borderRadius: 12, background: tier === 'deluxe' ? '#f0c040' : tier === 'premium' ? '#d4a574' : '#e0e0e0', color: tier === 'free' ? '#666' : '#fff', fontWeight: 600 }}>
              {tier.toUpperCase()}
            </span>
          )}
          <Link href={`/events/${eventId}/games/manage`}>
            <Button variant="outline" size="sm">{t('manage_games')}</Button>
          </Link>
        </div>
      </div>

      {/* Vota le foto */}
      {canUse('photo_vote') && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
          <h2 style={{ margin: '0 0 0.5rem' }}>{t('vote_photo')}</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{featureInfo('photo_vote')?.description}</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link href={`/events/${eventId}/games/vote`} style={{ padding: '0.5rem 1rem', background: '#d4a574', color: '#fff', textDecoration: 'none', borderRadius: 6, fontSize: '0.9rem' }}>{t('vote_photo')}</Link>
            <Link href={`/events/${eventId}/games/leaderboard`} style={{ padding: '0.5rem 1rem', border: '2px solid #d4a574', color: '#d4a574', textDecoration: 'none', borderRadius: 6, fontSize: '0.9rem' }}>{t('leaderboard')}</Link>
            {canUse('wall') && (
              <Link href={`/events/${eventId}/games/wall`} style={{ padding: '0.5rem 1rem', border: '2px solid #d4a574', color: '#d4a574', textDecoration: 'none', borderRadius: 6, fontSize: '0.9rem' }}>Wall</Link>
            )}
          </div>
        </div>
      )}

      {/* Quiz sugli Sposi */}
      {canUse('quiz') && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
          <h2 style={{ margin: '0 0 0.5rem' }}>{t('quiz')}</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{featureInfo('quiz')?.description}</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {quizCount > 0 && (
              <Link href={`/events/${eventId}/games/quiz`} style={{ padding: '0.5rem 1rem', background: '#d4a574', color: '#fff', textDecoration: 'none', borderRadius: 6, fontSize: '0.9rem' }}>{t('quiz_play')}</Link>
            )}
            <Link href={`/events/${eventId}/games/quiz/admin`} style={{ padding: '0.5rem 1rem', border: '2px solid #d4a574', color: '#d4a574', textDecoration: 'none', borderRadius: 6, fontSize: '0.9rem' }}>{c('manage')}{quizCount > 0 ? ` (${quizCount})` : ''}</Link>
          </div>
        </div>
      )}

      {/* Caccia alla Foto */}
      {canUse('photo_hunt') && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
          <h2 style={{ margin: '0 0 0.5rem' }}>{t('photo_hunt')}</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{featureInfo('photo_hunt')?.description}</p>
          <Link href={`/events/${eventId}/games/photo-hunt`} style={{ padding: '0.5rem 1rem', background: '#d4a574', color: '#fff', textDecoration: 'none', borderRadius: 6, fontSize: '0.9rem' }}>{t('photo_hunt')}</Link>
        </div>
      )}

      {/* Vota il Vestito */}
      {canUse('dress_vote') && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
          <h2 style={{ margin: '0 0 0.5rem' }}>{t('dress_vote')}</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{featureInfo('dress_vote')?.description}</p>
          <Link href={`/events/${eventId}/games/dress-vote`} style={{ padding: '0.5rem 1rem', border: '2px solid #d4a574', color: '#d4a574', textDecoration: 'none', borderRadius: 6, fontSize: '0.9rem' }}>{t('dress_vote')}</Link>
        </div>
      )}

      {/* Video Guestbook */}
      {canUse('video_guestbook') && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
          <h2 style={{ margin: '0 0 0.5rem' }}>{t('video_guestbook') || 'Video Guestbook'}</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{featureInfo('video_guestbook')?.description}</p>
          <Link href={`/events/${eventId}/guestbook`} style={{ padding: '0.5rem 1rem', background: '#d4a574', color: '#fff', textDecoration: 'none', borderRadius: 6, fontSize: '0.9rem' }}>Registra</Link>
        </div>
      )}

      {/* Tavolo Selfie (Deluxe) */}
      {isLocked('kiosk') && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 8, opacity: 0.5 }}>
          <h2 style={{ margin: '0 0 0.5rem', color: '#999' }}>{featureInfo('kiosk')?.label || 'Tavolo Selfie'} 🔒</h2>
          <p style={{ color: '#999', fontSize: '0.9rem' }}>Disponibile in Deluxe</p>
        </div>
      )}
      {canUse('kiosk') && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
          <h2 style={{ margin: '0 0 0.5rem' }}>{featureInfo('kiosk')?.label || 'Tavolo Selfie'}</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{featureInfo('kiosk')?.description}</p>
          <Link href={`/kiosk/${eventId}`} style={{ padding: '0.5rem 1rem', background: '#d4a574', color: '#fff', textDecoration: 'none', borderRadius: 6, fontSize: '0.9rem' }}>Apri Kiosk</Link>
        </div>
      )}

      {/* Wow Walk (Deluxe) */}
      {isLocked('wow_walk') && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 8, opacity: 0.5 }}>
          <h2 style={{ margin: '0 0 0.5rem', color: '#999' }}>{featureInfo('wow_walk')?.label || 'Wow Walk'} 🔒</h2>
          <p style={{ color: '#999', fontSize: '0.9rem' }}>Disponibile in Deluxe</p>
        </div>
      )}
      {canUse('wow_walk') && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
          <h2 style={{ margin: '0 0 0.5rem' }}>{featureInfo('wow_walk')?.label}</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{featureInfo('wow_walk')?.description}</p>
          <Link href={`/events/${eventId}/wow-walk`} style={{ padding: '0.5rem 1rem', border: '2px solid #d4a574', color: '#d4a574', textDecoration: 'none', borderRadius: 6, fontSize: '0.9rem' }}>{featureInfo('wow_walk')?.label}</Link>
        </div>
      )}

      {/* Video Challenges (Deluxe) */}
      {isLocked('video_challenges') && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 8, opacity: 0.5 }}>
          <h2 style={{ margin: '0 0 0.5rem', color: '#999' }}>{featureInfo('video_challenges')?.label || 'Video Challenges'} 🔒</h2>
          <p style={{ color: '#999', fontSize: '0.9rem' }}>Disponibile in Deluxe</p>
        </div>
      )}
      {canUse('video_challenges') && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
          <h2 style={{ margin: '0 0 0.5rem' }}>{featureInfo('video_challenges')?.label}</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{featureInfo('video_challenges')?.description}</p>
          <Link href={`/events/${eventId}/video-challenges`} style={{ padding: '0.5rem 1rem', background: '#d4a574', color: '#fff', textDecoration: 'none', borderRadius: 6, fontSize: '0.9rem' }}>Sfide</Link>
        </div>
      )}

      {tier && tier === 'free' && (
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#fef3e2', borderRadius: 8, textAlign: 'center' }}>
          <h3>Passa a Premium o Deluxe</h3>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>Sblocca tutti i giochi, il video guestbook e molto altro</p>
          <Link href={`/events/${eventId}/upgrade`} style={{ padding: '0.75rem 2rem', background: '#d4a574', color: '#fff', textDecoration: 'none', borderRadius: 6, fontWeight: 600 }}>Scopri i piani</Link>
        </div>
      )}

      <p style={{ marginTop: '2rem' }}>
        <Link href={`/events/${eventId}`} style={{ color: '#d4a574' }}>← {c('back')}</Link>
      </p>
    </main>
  );
}
