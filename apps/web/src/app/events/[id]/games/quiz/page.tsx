'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getQuizQuestions, submitQuizAnswers } from '@fotosposi/games';
import type { QuizQuestion, QuizResult } from '@fotosposi/games';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const t = useTranslations('quiz');
  const c = useTranslations('common');

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [guestName, setGuestName] = useState('');
  const [guestToken, setGuestToken] = useState('');
  const [result, setResult] = useState<QuizResult | null>(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let token = localStorage.getItem('quiz_guest_token');
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem('quiz_guest_token', token);
    }
    setGuestToken(token);
  }, []);

  useEffect(() => {
    if (!eventId) return;
    getQuizQuestions(eventId).then((r) => {
      if (r.questions) setQuestions(r.questions);
    });
  }, [eventId]);

  const selectAnswer = (questionId: string, index: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: index }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    const answerList = Object.entries(answers).map(([question_id, selected_index]) => ({
      question_id,
      selected_index,
    }));
    const r = await submitQuizAnswers({
      event_id: eventId,
      answers: answerList,
      guest_token: guestToken,
      guest_name: guestName || undefined,
    });
    if (r.error) {
      setError(r.error);
    } else if (r.result) {
      setResult(r.result);
    }
    setLoading(false);
  };

  if (result) {
    return (
      <main style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem' }}>
        <Card style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>{t('your_result')}</h1>
          {result.total > 0 && (
            <p style={{ fontSize: '2rem', fontWeight: 700, color: '#d4a574', margin: '1rem 0' }}>
              {t('correct', { score: result.score, total: result.total })}
            </p>
          )}
          {result.theme && (
            <div style={{ margin: '1.5rem 0', padding: '1rem', background: '#f9f9f9', borderRadius: 8 }}>
              <h2>{t('theme_recommendation')}</h2>
              <p style={{ fontSize: '1.25rem', fontWeight: 600, color: '#d4a574', textTransform: 'capitalize' }}>
                {result.theme}
              </p>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button onClick={() => router.refresh()} style={{ background: '#d4a574' }}>
              {t('start')}
            </Button>
            <Link href={`/events/${eventId}/games/quiz/leaderboard`}>
              <Button variant="outline">{t('leaderboard')}</Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  if (!started) {
    return (
      <main style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem' }}>
        <Card style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>{t('title')}</h1>
          <p style={{ color: '#666', margin: '1rem 0' }}>{t('subtitle')}</p>
          <input
            placeholder={t('enter_name')}
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }}
          />
          <Button onClick={() => setStarted(true)} style={{ background: '#d4a574' }} disabled={questions.length === 0}>
            {t('start')}
          </Button>
          {questions.length === 0 && <p style={{ color: '#999', marginTop: '0.5rem' }}>{t('no_questions')}</p>}
        </Card>
      </main>
    );
  }

  const q = questions[current];
  if (!q) return null;
  const progress = ((current + 1) / questions.length) * 100;

  return (
    <main style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ height: 4, background: '#eee', borderRadius: 2, marginBottom: '1.5rem' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: '#d4a574', borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <Card style={{ padding: '1.5rem' }}>
        <p style={{ color: '#999', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
          {t('question', { current: current + 1, total: questions.length })}
        </p>
        <h2 style={{ marginBottom: '1.5rem' }}>{q.question_text}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {(q.options as string[]).map((opt, idx) => (
            <button
              key={idx}
              onClick={() => selectAnswer(q.id, idx)}
              style={{
                padding: '1rem',
                border: answers[q.id] === idx ? '2px solid #d4a574' : '1px solid #ddd',
                borderRadius: 8,
                background: answers[q.id] === idx ? '#fef6ee' : '#fff',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '1rem',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
          <Button variant="outline" onClick={() => setCurrent((p) => Math.max(0, p - 1))} disabled={current === 0}>
            {c('back')}
          </Button>
          {current < questions.length - 1 ? (
            <Button onClick={() => setCurrent((p) => p + 1)} disabled={answers[q.id] === undefined} style={{ background: '#d4a574' }}>
              {t('next')}
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={Object.keys(answers).length < questions.length || loading} style={{ background: '#d4a574' }}>
              {loading ? c('loading') : t('finish')}
            </Button>
          )}
        </div>
      </Card>
      {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
    </main>
  );
}
