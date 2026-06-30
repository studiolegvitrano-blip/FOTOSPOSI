'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getCategories, castVote, getLeaderboard } from '@fotosposi/games';
import { getMediaByEvent } from '@fotosposi/media';
import { getCurrentUser } from '@fotosposi/core';
import type { GameCategory } from '@fotosposi/games';
import type { MediaUpload } from '@fotosposi/media';

export default function VotePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const eventId = params.id as string;
  const categoryId = searchParams.get('category');

  const [categories, setCategories] = useState<GameCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(categoryId || '');
  const [media, setMedia] = useState<MediaUpload[]>([]);
  const [votedMediaId, setVotedMediaId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getCurrentUser().then(({ user }) => { if (user) setUserId(user.id); });
    getCategories(eventId).then((r) => { if (r.categories) setCategories(r.categories); });
    getMediaByEvent(eventId).then((r) => {
      if (r.media) setMedia(r.media.filter((m) => m.type === 'photo'));
    });
  }, [eventId]);

  const handleVote = async (mediaId: string) => {
    if (!userId || !selectedCategory) return;
    setError('');
    const { error: err } = await castVote({
      event_id: eventId,
      category_id: selectedCategory,
      media_id: mediaId,
      voter_id: userId,
    });
    if (err) {
      setError(err);
    } else {
      setVotedMediaId(mediaId);
    }
  };

  const photos = media.filter((m) => m.type === 'photo');

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Vota le foto</h1>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Categoria</label>
        <select
          value={selectedCategory}
          onChange={(e) => { setSelectedCategory(e.target.value); setVotedMediaId(null); }}
          style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', maxWidth: 400 }}
        >
          <option value="">Seleziona una categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}

      {votedMediaId && (
        <p style={{ color: '#090', marginBottom: '1rem', padding: '0.5rem', background: '#e8f5e9', borderRadius: 6 }}>
          Voto registrato!
        </p>
      )}

      {selectedCategory && (
        <div>
          {photos.length === 0 ? (
            <p style={{ color: '#666' }}>Nessuna foto disponibile per votare</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {photos.map((photo) => (
                <div key={photo.id} style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
                  <img src={photo.url} alt="" style={{ width: '100%', height: 180, objectFit: 'cover' }} />
                  <div style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <button
                      onClick={() => handleVote(photo.id)}
                      disabled={votedMediaId !== null}
                      style={{
                        padding: '0.4rem 1rem',
                        background: votedMediaId === photo.id ? '#4caf50' : '#d4a574',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: votedMediaId !== null ? 'default' : 'pointer',
                        width: '100%',
                      }}
                    >
                      {votedMediaId === photo.id ? 'Votato!' : 'Vota'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p style={{ marginTop: '2rem' }}>
        <Link href={`/events/${eventId}/games`} style={{ color: '#d4a574' }}>← Torna ai giochi</Link>
      </p>
    </main>
  );
}
