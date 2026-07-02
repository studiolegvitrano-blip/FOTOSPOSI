'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@fotosposi/core';
import { getCategories, getLeaderboard } from '@fotosposi/games';
import type { GameCategory } from '@fotosposi/games';

function lbMediaUrl(item: { url: string; r2_key?: string | null; media_id_fk?: string }): string {
  return item.r2_key && item.media_id_fk ? `/api/media/${item.media_id_fk}/download` : item.url;
}

export default function LeaderboardPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [categories, setCategories] = useState<GameCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ media_id: string; url: string; r2_key: string | null; media_id_fk: string; votes: number }[]>([]);

  useEffect(() => {
    getCategories(eventId).then((r) => {
      if (r.categories && r.categories.length > 0) {
        setCategories(r.categories);
        setActiveCategory(r.categories[0]!.id);
      }
    });
  }, [eventId]);

  useEffect(() => {
    if (!activeCategory) return;
    const supabase = createClient();

    getLeaderboard(eventId, activeCategory).then((r) => {
      if (r.leaderboard) setLeaderboard(r.leaderboard);
    });

    const channel = supabase
      .channel(`leaderboard-${eventId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes', filter: `event_id=eq.${eventId}` },
        () => {
          getLeaderboard(eventId, activeCategory).then((r) => {
            if (r.leaderboard) setLeaderboard(r.leaderboard);
          });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, activeCategory]);

  const maxVotes = leaderboard.length > 0 ? leaderboard[0]!.votes : 1;

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Classifica live</h1>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            style={{
              padding: '0.5rem 1rem',
              background: activeCategory === c.id ? '#d4a574' : '#f5f5f5',
              color: activeCategory === c.id ? '#fff' : '#333',
              border: '1px solid #ddd',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {leaderboard.length === 0 ? (
        <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
          Nessun voto in questa categoria. Sii il primo a votare!
        </p>
      ) : (
        <div>
          {leaderboard.map((item, index) => (
            <div
              key={item.media_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.75rem',
                marginBottom: '0.5rem',
                background: '#fafafa',
                borderRadius: 8,
                border: index === 0 ? '2px solid #d4a574' : '1px solid #eee',
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', minWidth: 40, textAlign: 'center', color: index === 0 ? '#d4a574' : '#999' }}>
                {index + 1}
              </div>
              {item.url && (
                <img src={lbMediaUrl(item)} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }} loading="lazy" />
              )}
              <div style={{ flex: 1 }}>
                <div style={{
                  height: 30,
                  background: '#d4a574',
                  borderRadius: 4,
                  width: `${(item.votes / maxVotes) * 100}%`,
                  minWidth: 40,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: '0.5rem',
                  color: '#fff',
                  fontWeight: 'bold',
                  transition: 'width 0.5s ease',
                }}>
                  {item.votes} voto{item.votes !== 1 ? 'i' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ marginTop: '2rem', color: '#999', textAlign: 'center', fontSize: '0.9rem' }}>
        Classifica live — aggiornata in tempo reale
      </p>

      <p style={{ marginTop: '1rem' }}>
        <Link href={`/events/${eventId}/games`} style={{ color: '#d4a574' }}>← Torna ai giochi</Link>
      </p>
    </main>
  );
}
