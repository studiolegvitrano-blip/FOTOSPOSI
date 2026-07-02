'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getQuizQuestions, createQuizQuestion, updateQuizQuestion, deleteQuizQuestion } from '@fotosposi/games';
import type { QuizQuestion } from '@fotosposi/games';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface QuestionForm {
  id?: string;
  question_text: string;
  options: string[];
  correct_index: number | null;
  theme_tags: string[][];
  sort_order: number;
  is_preference: boolean;
}

const emptyForm = (): QuestionForm => ({
  question_text: '',
  options: ['', ''],
  correct_index: null,
  theme_tags: [[], []],
  sort_order: 0,
  is_preference: false,
});

export default function QuizAdminPage() {
  const params = useParams();
  const eventId = params.id as string;
  const t = useTranslations('quiz');
  const c = useTranslations('common');

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [form, setForm] = useState<QuestionForm>(emptyForm());
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    if (!eventId) return;
    getQuizQuestions(eventId).then((r) => {
      if (r.questions) setQuestions(r.questions);
    });
  };

  useEffect(load, [eventId]);

  const addOption = () => {
    setForm((f) => ({
      ...f,
      options: [...f.options, ''],
      theme_tags: [...f.theme_tags, []],
    }));
  };

  const removeOption = (idx: number) => {
    if (form.options.length <= 2) return;
    setForm((f) => ({
      ...f,
      options: f.options.filter((_, i) => i !== idx),
      theme_tags: f.theme_tags.filter((_, i) => i !== idx),
      correct_index: f.correct_index === idx ? null
        : f.correct_index !== null && f.correct_index > idx ? f.correct_index - 1
        : f.correct_index,
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    const payload = {
      event_id: eventId,
      question_text: form.question_text,
      options: form.options,
      correct_index: form.is_preference ? null : form.correct_index,
      theme_tags: form.theme_tags,
      sort_order: form.sort_order,
    };
    const r = form.id
      ? await updateQuizQuestion({ id: form.id, ...payload })
      : await createQuizQuestion(payload);
    if (r.error) {
      setError(r.error);
    } else {
      setForm(emptyForm());
      setEditing(false);
      load();
    }
    setLoading(false);
  };

  const handleEdit = (q: QuizQuestion) => {
    setForm({
      id: q.id,
      question_text: q.question_text,
      options: [...q.options],
      correct_index: q.correct_index,
      theme_tags: q.theme_tags.map((t) => [...t]),
      sort_order: q.sort_order,
      is_preference: q.correct_index === null,
    });
    setEditing(true);
  };

  const handleDelete = async (id: string) => {
    await deleteQuizQuestion(id);
    load();
  };

  return (
    <main style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>{t('admin_title')}</h1>
      <Link href={`/events/${eventId}/games/quiz`} style={{ color: '#d4a574', display: 'block', marginBottom: '1.5rem' }}>
        ← {t('back_to_quiz')}
      </Link>

      <Card style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h2>{editing ? c('edit') : t('add_question')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>{t('question_label')}</label>
            <input
              value={form.question_text}
              onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))}
              placeholder={t('question_placeholder')}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_preference}
                onChange={(e) => setForm((f) => ({ ...f, is_preference: e.target.checked, correct_index: e.target.checked ? null : null }))}
              />
              {t('preference_question')}
            </label>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>{t('sort_order')}</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
              style={{ width: 80, padding: '0.5rem', border: '1px solid #ddd', borderRadius: 6 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>{c('options')}</label>
            {form.options.map((opt, idx) => (
              <div key={idx} style={{ marginBottom: '0.75rem', padding: '0.75rem', border: '1px solid #eee', borderRadius: 6 }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <input
                    value={opt}
                    onChange={(e) => {
                      const opts = [...form.options];
                      opts[idx] = e.target.value;
                      setForm((f) => ({ ...f, options: opts }));
                    }}
                    placeholder={t('option_label', { n: idx + 1 })}
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid #ddd', borderRadius: 6 }}
                  />
                  {!form.is_preference && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
                      <input
                        type="radio"
                        name="correct"
                        checked={form.correct_index === idx}
                        onChange={() => setForm((f) => ({ ...f, correct_index: idx }))}
                      />
                      {t('correct_answer')}
                    </label>
                  )}
                  <Button variant="outline" size="sm" onClick={() => removeOption(idx)} disabled={form.options.length <= 2}>
                    ✕
                  </Button>
                </div>
                {form.is_preference && (
                  <div>
                    <label style={{ fontSize: '0.875rem', color: '#666' }}>{t('theme_tags')}</label>
                    <input
                      value={form.theme_tags[idx]?.join(', ') ?? ''}
                      onChange={(e) => {
                        const tags = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                        const tt = [...form.theme_tags];
                        tt[idx] = tags;
                        setForm((f) => ({ ...f, theme_tags: tt }));
                      }}
                      placeholder={t('theme_tags_hint')}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: 6, marginTop: '0.25rem', boxSizing: 'border-box', fontSize: '0.875rem' }}
                    />
                  </div>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addOption}>{t('add_option')}</Button>
          </div>

          {error && <p style={{ color: 'red' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button onClick={handleSave} disabled={loading || !form.question_text} style={{ background: '#d4a574' }}>
              {loading ? c('loading') : t('save')}
            </Button>
            {editing && <Button variant="outline" onClick={() => { setForm(emptyForm()); setEditing(false); }}>{c('cancel')}</Button>}
          </div>
        </div>
      </Card>

      <h2>{c('list')}</h2>
      {questions.length === 0 ? (
        <p style={{ color: '#999' }}>{t('no_questions')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {questions.map((q) => (
            <Card key={q.id} style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <p style={{ fontWeight: 500 }}>{q.question_text}</p>
                  <p style={{ fontSize: '0.875rem', color: '#666' }}>
                    {(q.options as string[]).join(' | ')}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#999' }}>
                    {q.correct_index !== null ? `✓ Opzione ${q.correct_index + 1}` : `🎨 ${t('preference_question')}`}
                    {' — '}{t('sort_order')}: {q.sort_order}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(q)}>{c('edit')}</Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(q.id)} style={{ color: 'red' }}>{t('delete')}</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
