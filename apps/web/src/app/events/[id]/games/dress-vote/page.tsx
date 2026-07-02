'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { castDressVote, getDressVoteStats, getMyDressVote } from '@fotosposi/games';
import { getCurrentUser } from '@fotosposi/core';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

export default function DressVotePage() {
  const params = useParams();
  const eventId = params.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [myVotes, setMyVotes] = useState<{ sposo?: number; sposa?: number }>({});
  const [stats, setStats] = useState<{ sposo?: { avg: number; count: number }; sposa?: { avg: number; count: number } }>({});
  const [ratingSposo, setRatingSposo] = useState(0);
  const [ratingSposa, setRatingSposa] = useState(0);
  const [voted, setVoted] = useState<'sposo' | 'sposa' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getCurrentUser().then(({ user }) => { if (user) setUserId(user.id); });
    loadData();
  }, [eventId]);

  const loadData = () => {
    getDressVoteStats(eventId).then(r => { if (r.sposo) setStats(r); });
    getCurrentUser().then(({ user }) => {
      if (user) {
        getMyDressVote(eventId, user.id).then(r => setMyVotes(r as any));
      }
    });
  };

  const handleVote = async () => {
    if (!userId || !voted) return;
    const rating = voted === 'sposo' ? ratingSposo : ratingSposa;
    if (rating < 1) { setError('Seleziona un voto'); return; }
    setError('');
    const { error: err } = await castDressVote({ event_id: eventId, voter_id: userId, vote_type: voted, rating });
    if (err) { setError(err); return; }
    loadData();
    if (voted === 'sposo') setMyVotes(prev => ({ ...prev, sposo: rating }));
    else setMyVotes(prev => ({ ...prev, sposa: rating }));
    setVoted(null);
  };

  const renderStars = (current: number, onChange: (n: number) => void, disabled = false) => (
    <div className="flex gap-1 text-2xl">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" disabled={disabled}
          onClick={() => onChange(n)}
          className={`${disabled ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform ${n <= current ? 'text-amber-400' : 'text-gray-300'}`}>
          {n <= current ? '★' : '☆'}
        </button>
      ))}
    </div>
  );

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vota il Vestito</h1>
        <Button variant="ghost" asChild><Link href={`/events/${eventId}/games`}>← Giochi</Link></Button>
      </div>
      <p className="text-text-muted">Vota il vestito dello sposo e della sposa! Da 1 a 5 stelle.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className={myVotes.sposo ? 'border-amber-400' : ''}>
          <CardHeader><CardTitle className="text-center">👔 Sposo</CardTitle></CardHeader>
          <CardContent className="text-center space-y-3">
            {stats.sposo && stats.sposo.count > 0 ? (
              <div>
                <div className="text-3xl text-amber-400">{'★'.repeat(Math.round(stats.sposo.avg))}</div>
                <p className="text-sm text-text-muted">{stats.sposo.avg.toFixed(1)} media ({stats.sposo.count} voti)</p>
              </div>
            ) : <p className="text-text-muted text-sm">Ancora nessun voto</p>}
            {myVotes.sposo ? (
              <div className="pt-2">
                <p className="text-sm text-green-600">Il tuo voto: {myVotes.sposo}/5</p>
                {renderStars(myVotes.sposo, () => {}, true)}
              </div>
            ) : (
              <div className="pt-2 space-y-2">
                {voted === 'sposo' ? (
                  <>
                    {renderStars(ratingSposo, setRatingSposo)}
                    <div className="flex gap-2 justify-center">
                      <Button size="sm" onClick={handleVote}>Conferma</Button>
                      <Button size="sm" variant="ghost" onClick={() => setVoted(null)}>Annulla</Button>
                    </div>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setVoted('sposo')}>Vota</Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={myVotes.sposa ? 'border-amber-400' : ''}>
          <CardHeader><CardTitle className="text-center">👰 Sposa</CardTitle></CardHeader>
          <CardContent className="text-center space-y-3">
            {stats.sposa && stats.sposa.count > 0 ? (
              <div>
                <div className="text-3xl text-amber-400">{'★'.repeat(Math.round(stats.sposa.avg))}</div>
                <p className="text-sm text-text-muted">{stats.sposa.avg.toFixed(1)} media ({stats.sposa.count} voti)</p>
              </div>
            ) : <p className="text-text-muted text-sm">Ancora nessun voto</p>}
            {myVotes.sposa ? (
              <div className="pt-2">
                <p className="text-sm text-green-600">Il tuo voto: {myVotes.sposa}/5</p>
                {renderStars(myVotes.sposa, () => {}, true)}
              </div>
            ) : (
              <div className="pt-2 space-y-2">
                {voted === 'sposa' ? (
                  <>
                    {renderStars(ratingSposa, setRatingSposa)}
                    <div className="flex gap-2 justify-center">
                      <Button size="sm" onClick={handleVote}>Conferma</Button>
                      <Button size="sm" variant="ghost" onClick={() => setVoted(null)}>Annulla</Button>
                    </div>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setVoted('sposa')}>Vota</Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-error text-center">{error}</p>}

      <Card>
        <CardHeader><CardTitle>Riepilogo voti</CardTitle></CardHeader>
        <CardContent>
          {stats.sposo && stats.sposa && stats.sposo.count + stats.sposa.count > 0 ? (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Sposo</span><span>{stats.sposo.avg.toFixed(1)} ({stats.sposo.count})</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${(stats.sposo.avg / 5) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Sposa</span><span>{stats.sposa.avg.toFixed(1)} ({stats.sposa.count})</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-pink-400 rounded-full transition-all" style={{ width: `${(stats.sposa.avg / 5) * 100}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-text-muted py-4">Nessun voto ancora</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
