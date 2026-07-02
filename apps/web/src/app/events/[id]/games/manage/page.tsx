'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getEventFeatures, setEventFeature, seedDefaultQuizQuestions, getQuizQuestions, AVAILABLE_FEATURES } from '@fotosposi/games';
import type { EventFeature } from '@fotosposi/games';
import { getEventTier, hasFeature } from '@fotosposi/core';
import type { Tier } from '@fotosposi/core';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function ManageGamesPage() {
  const params = useParams();
  const eventId = params.id as string;
  const t = useTranslations('games');
  const c = useTranslations('common');

  const [features, setFeatures] = useState<EventFeature[]>([]);
  const [tier, setTier] = useState<Tier | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [quizCount, setQuizCount] = useState(0);

  useEffect(() => {
    if (!eventId) return;
    loadFeatures();
    getQuizQuestions(eventId).then((r) => { if (r.questions) setQuizCount(r.questions.length); });
    getEventTier(eventId).then((r) => { if (r.tier) setTier(r.tier); });
  }, [eventId]);

  const loadFeatures = async () => {
    const r = await getEventFeatures(eventId);
    if (r.features) setFeatures(r.features);
  };

  const toggle = async (key: string, enabled: boolean) => {
    setToggling(key);
    await setEventFeature({ event_id: eventId, feature_key: key, enabled });
    await loadFeatures();
    setToggling(null);
  };

  const seedQuiz = async () => {
    setSeeding(true);
    const r = await seedDefaultQuizQuestions(eventId);
    if (r.count && r.count > 0) setQuizCount(r.count);
    setSeeding(false);
  };

  const featureMap = new Map(features.map((f) => [f.feature_key, f]));

  const tierBadge = (ft: string) => {
    const colors: Record<string, string> = { free: '#e0e0e0', premium: '#d4a574', deluxe: '#f0c040' };
    return { background: colors[ft] || '#e0e0e0', color: ft === 'free' ? '#666' : '#fff' };
  };

  return (
    <main style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <Link href={`/events/${eventId}/games`} style={{ color: '#d4a574', display: 'block', marginBottom: '1rem' }}>
        ← {c('back')}
      </Link>
      <h1 style={{ marginBottom: '0.5rem' }}>{t('manage_title')}</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>{t('manage_subtitle')}</p>

      {tier && (
        <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: '#f5f5f5', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem' }}>Tier attuale: <strong style={{ textTransform: 'uppercase' }}>{tier}</strong></span>
          {tier === 'free' && (
            <Link href={`/events/${eventId}/upgrade`} style={{ padding: '0.4rem 1rem', background: '#d4a574', color: '#fff', textDecoration: 'none', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600 }}>Upgrade</Link>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {AVAILABLE_FEATURES.map((af) => {
          const ef = featureMap.get(af.key);
          const enabled = ef?.enabled ?? false;
          const locked = tier ? !hasFeature(tier, af.key) : true;
          const badge = tierBadge(af.tier);
          return (
            <Card key={af.key} style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', opacity: locked ? 0.5 : 1 }}>
              <div style={{ fontSize: '1.5rem', width: 40, textAlign: 'center', flexShrink: 0 }}>
                {af.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <strong>{af.label}</strong>
                  {af.requires_setup && <span style={{ fontSize: '0.75rem', color: '#d4a574', fontWeight: 500 }}>{c('requires_setup')}</span>}
                  <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: 8, ...badge, fontWeight: 600, textTransform: 'uppercase' }}>{af.tier}</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#666', margin: '0.25rem 0 0' }}>{af.description}</p>
                {locked && (
                  <p style={{ fontSize: '0.8rem', color: '#d4a574', margin: '0.25rem 0 0', fontWeight: 500 }}>Passa a {af.tier === 'premium' ? 'Premium' : 'Deluxe'} per sbloccare</p>
                )}
                {af.key === 'quiz' && enabled && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', color: '#999' }}>
                      {quizCount > 0 ? `${quizCount} ${c('questions')}` : c('no_questions')}
                    </span>
                    <Link href={`/events/${eventId}/games/quiz/admin`}>
                      <Button variant="outline" size="sm">{c('manage')}</Button>
                    </Link>
                    {quizCount === 0 && (
                      <Button variant="outline" size="sm" onClick={seedQuiz} disabled={seeding}>
                        {seeding ? c('loading') : t('load_suggestions')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {!locked && (
                <label style={{ position: 'relative', display: 'inline-block', width: 48, height: 26, flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => toggle(af.key, e.target.checked)}
                    disabled={toggling === af.key}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', cursor: 'pointer', inset: 0,
                    backgroundColor: enabled ? '#d4a574' : '#ccc',
                    borderRadius: 26, transition: '0.3s',
                  }}>
                    <span style={{
                      position: 'absolute', height: 20, width: 20, left: enabled ? 24 : 3, bottom: 3,
                      backgroundColor: '#fff', borderRadius: '50%', transition: '0.3s',
                    }} />
                  </span>
                </label>
              )}
            </Card>
          );
        })}
      </div>
    </main>
  );
}
