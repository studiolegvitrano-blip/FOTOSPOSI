'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createJoke, getJokes, deleteJoke } from '@fotosposi/games';
import { getCurrentUser } from '@fotosposi/core';
import type { JokeEntry } from '@fotosposi/games';

export default function JokesPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [revealDate, setRevealDate] = useState('');
  const [revealTime, setRevealTime] = useState('');
  const [revealed, setRevealed] = useState<JokeEntry[]>([]);
  const [pending, setPending] = useState<JokeEntry[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getCurrentUser().then(({ user }) => { if (user) setUserId(user.id); });
    loadJokes();
  }, [eventId]);

  const loadJokes = () => {
    getJokes(eventId, true).then((r) => { if (r.jokes) setRevealed(r.jokes); });
    getJokes(eventId, false).then((r) => { if (r.jokes) setPending(r.jokes); });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setError('');

    const revealAt = revealDate && revealTime
      ? new Date(`${revealDate}T${revealTime}`).toISOString()
      : new Date(Date.now() + 86400000).toISOString();

    const { error: err } = await createJoke({
      event_id: eventId,
      from_user: userId,
      content,
      reveal_at: revealAt,
    });

    if (err) {
      setError(err);
    } else {
      setContent('');
      loadJokes();
    }
  };

  const handleDelete = async (jokeId: string) => {
    await deleteJoke(jokeId);
    loadJokes();
  };

  return (
    <main style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Angolo scherzi</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        I contenuti qui inseriti restano nascosti fino al momento del reveal scelto
      </p>

      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
        <h2 style={{ marginBottom: '1rem' }}>Aggiungi scherzo</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Contenuto</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={3}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
            placeholder="Scrivi qui il tuo scherzo (testo, battuta, dedica...)"
          />
        </div>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Data reveal</label>
            <input type="date" value={revealDate} onChange={(e) => setRevealDate(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Ora reveal</label>
            <input type="time" value={revealTime} onChange={(e) => setRevealTime(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }} />
          </div>
        </div>
        {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}
        <button type="submit" style={{ padding: '0.5rem 2rem', background: '#d4a574', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Invia scherzo
        </button>
      </form>

      {pending.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2>In attesa di reveal ({pending.length})</h2>
          {pending.map((j) => (
            <div key={j.id} style={{ padding: '0.75rem', background: '#fff8e1', borderRadius: 6, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontStyle: 'italic', color: '#888' }}>Contenuto nascosto fino al {new Date(j.reveal_at).toLocaleString('it-IT')}</p>
              </div>
              <button onClick={() => handleDelete(j.id)} style={{ padding: '0.25rem 0.75rem', background: '#e57373', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                Elimina
              </button>
            </div>
          ))}
        </div>
      )}

      {revealed.length > 0 && (
        <div>
          <h2>Scherzi rivelati</h2>
          {revealed.map((j) => (
            <div key={j.id} style={{ padding: '0.75rem', background: '#f9f9f9', borderRadius: 6, marginBottom: '0.5rem' }}>
              <p>{j.content}</p>
              <small style={{ color: '#999' }}>Rivelato il {new Date(j.reveal_at).toLocaleDateString('it-IT')}</small>
            </div>
          ))}
        </div>
      )}

      <p style={{ marginTop: '2rem' }}>
        <Link href={`/events/${eventId}/games`} style={{ color: '#d4a574' }}>← Torna ai giochi</Link>
      </p>
    </main>
  );
}
