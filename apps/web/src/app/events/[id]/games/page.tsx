'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getCategories, getJokes } from '@fotosposi/games';
import type { GameCategory, JokeEntry } from '@fotosposi/games';

export default function GamesHubPage() {
  const params = useParams();
  const eventId = params.id as string;
  const [categories, setCategories] = useState<GameCategory[]>([]);
  const [revealedJokes, setRevealedJokes] = useState<JokeEntry[]>([]);
  const [pendingJokes, setPendingJokes] = useState(0);

  useEffect(() => {
    if (!eventId) return;
    getCategories(eventId).then((r) => { if (r.categories) setCategories(r.categories); });
    getJokes(eventId, true).then((r) => { if (r.jokes) setRevealedJokes(r.jokes); });
    getJokes(eventId, false).then((r) => { if (r.jokes) setPendingJokes(r.jokes.length); });
  }, [eventId]);

  return (
    <main style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Giochi</h1>

      <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
        <h2>Votazione ({categories.length} categorie)</h2>
        <p style={{ color: '#666', marginBottom: '1rem' }}>Vota le foto nelle diverse categorie</p>
        {categories.length === 0 ? (
          <p style={{ color: '#999' }}>Nessuna categoria ancora creata</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {categories.map((c) => (
              <li key={c.id} style={{ marginBottom: '0.5rem' }}>
                <Link href={`/events/${eventId}/games/vote?category=${c.id}`}
                  style={{ color: '#d4a574', textDecoration: 'none' }}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          <Link href={`/events/${eventId}/games/leaderboard`}
            style={{ padding: '0.5rem 1rem', background: '#d4a574', color: '#fff', textDecoration: 'none', borderRadius: 6 }}>
            Classifica
          </Link>
          <Link href={`/events/${eventId}/games/wall`}
            style={{ padding: '0.5rem 1rem', border: '2px solid #d4a574', color: '#d4a574', textDecoration: 'none', borderRadius: 6 }}>
            Wall
          </Link>
        </div>
      </div>

      <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
        <h2>Angolo scherzi</h2>
        <p style={{ color: '#666', marginBottom: '1rem' }}>
          {pendingJokes > 0
            ? `${pendingJokes} scherzo/i in attesa di reveal`
            : 'Nessuno scherzo in attesa'}
        </p>
        {revealedJokes.length > 0 && (
          <div>
            <p style={{ fontWeight: 500 }}>Scherzi rivelati ({revealedJokes.length})</p>
            {revealedJokes.map((j) => (
              <div key={j.id} style={{ padding: '0.75rem', background: '#f9f9f9', borderRadius: 6, marginBottom: '0.5rem' }}>
                <p>{j.content}</p>
                <small style={{ color: '#999' }}>
                  Rivelato il {new Date(j.reveal_at).toLocaleDateString('it-IT')}
                </small>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: '1rem' }}>
          <Link href={`/events/${eventId}/games/jokes`}
            style={{ padding: '0.5rem 1rem', background: '#d4a574', color: '#fff', textDecoration: 'none', borderRadius: 6 }}>
            Vai all&apos;angolo scherzi
          </Link>
        </div>
      </div>

      <p style={{ marginTop: '2rem' }}>
        <Link href={`/events/${eventId}`} style={{ color: '#d4a574' }}>← Torna all'evento</Link>
      </p>
    </main>
  );
}
