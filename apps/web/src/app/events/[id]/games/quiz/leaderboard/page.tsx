'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getQuizLeaderboard } from '@fotosposi/games';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function QuizLeaderboardPage() {
  const params = useParams();
  const eventId = params.id as string;
  const t = useTranslations('quiz');
  const c = useTranslations('common');

  const [leaderboard, setLeaderboard] = useState<{ guest_name: string; score: number; total: number }[]>([]);

  useEffect(() => {
    if (!eventId) return;
    getQuizLeaderboard(eventId).then((r) => {
      if (r.leaderboard) setLeaderboard(r.leaderboard);
    });
  }, [eventId]);

  return (
    <main style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem' }}>
      <Link href={`/events/${eventId}/games/quiz`} style={{ color: '#d4a574', display: 'block', marginBottom: '1rem' }}>
        ← {c('back')}
      </Link>
      <h1>{t('leaderboard')}</h1>
      {leaderboard.length === 0 ? (
        <p style={{ color: '#999' }}>{c('no_results')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {leaderboard.map((entry, idx) => (
            <Card key={idx} style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 700, marginRight: '0.75rem', color: '#d4a574' }}>#{idx + 1}</span>
                <span>{entry.guest_name}</span>
              </div>
              <span style={{ fontWeight: 600 }}>{entry.score}/{entry.total}</span>
            </Card>
          ))}
        </div>
      )}
      <div style={{ marginTop: '1.5rem' }}>
        <Link href={`/events/${eventId}/games/quiz`}>
          <Button style={{ background: '#d4a574' }}>{t('back_to_quiz')}</Button>
        </Link>
      </div>
    </main>
  );
}
