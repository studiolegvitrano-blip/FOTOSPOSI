import { createServiceClient } from '@fotosposi/core';
import type { GameCategory, Vote, JokeEntry, PhotoHuntRegistration, PhotoHuntTask, PhotoHuntSubmission, DressVote, QuizQuestion, QuizAnswer, QuizResult, EventFeature, AvailableFeature } from './index';
import { AVAILABLE_FEATURES } from './index';

export async function createCategory(params: {
  event_id: string;
  name: string;
}): Promise<{ category?: GameCategory; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('game_categories')
    .insert({ event_id: params.event_id, name: params.name })
    .select()
    .single();
  if (error) return { error: error.message };
  return { category: data };
}

export async function getCategories(eventId: string): Promise<{ categories?: GameCategory[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('game_categories')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) return { error: error.message };
  return { categories: data ?? [] };
}

export async function castVote(params: {
  event_id: string;
  category_id: string;
  media_id: string;
  voter_id: string;
}): Promise<{ vote?: Vote; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('votes')
    .upsert(
      { event_id: params.event_id, category_id: params.category_id, media_id: params.media_id, voter_id: params.voter_id },
      { onConflict: 'category_id, voter_id' },
    )
    .select()
    .single();
  if (error) return { error: error.message };
  return { vote: data };
}

export async function getLeaderboard(
  eventId: string,
  categoryId: string,
): Promise<{ leaderboard?: { media_id: string; url: string; votes: number }[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('votes')
    .select(`media_id, media_uploads!inner(url, type), count:media_id`)
    .eq('event_id', eventId)
    .eq('category_id', categoryId)
    .order('count', { ascending: false });
  if (error) return { error: error.message };
  const grouped = new Map<string, { media_id: string; url: string; votes: number }>();
  for (const row of data ?? []) {
    const mid = row.media_id as string;
    const current = grouped.get(mid) ?? { media_id: mid, url: '', votes: 0 };
    current.votes++;
    const media = row.media_uploads as unknown as { url: string };
    if (media?.url) current.url = media.url;
    grouped.set(mid, current);
  }
  return { leaderboard: Array.from(grouped.values()).sort((a, b) => b.votes - a.votes) };
}

export async function createJoke(params: {
  event_id: string;
  from_user: string;
  content: string;
  reveal_at: string;
}): Promise<{ joke?: JokeEntry; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('joke_entries').insert(params).select().single();
  if (error) return { error: error.message };
  return { joke: data };
}

export async function getJokes(eventId: string, revealed = true): Promise<{ jokes?: JokeEntry[]; error?: string }> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  let query = supabase.from('joke_entries').select('*').eq('event_id', eventId);
  if (revealed) query = query.lte('reveal_at', now);
  else query = query.gt('reveal_at', now);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { jokes: data ?? [] };
}

export async function deleteJoke(jokeId: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('joke_entries').delete().eq('id', jokeId);
  if (error) return { error: error.message };
  return {};
}

export async function ensureDefaultTasks(eventId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data } = await supabase.from('photo_hunt_tasks').select('id').eq('event_id', eventId).limit(1);
  if (data && data.length > 0) return;
  const defaults = [
    { title: 'Selfie con la sposa', description: 'Fatti un selfie insieme alla sposa!', points: 20 },
    { title: 'Selfie con lo sposo', description: 'Fatti un selfie insieme allo sposo!', points: 20 },
    { title: 'Foto con la zia', description: 'Trova e fotografa una zia', points: 15 },
    { title: 'Foto con la torta', description: 'Scatta una foto alla torta nuziale', points: 10 },
    { title: 'Padre della sposa', description: 'Cattura un momento con il padre della sposa', points: 15 },
    { title: 'Bacio degli sposi', description: 'Ferma il primo bacio in foto', points: 25 },
    { title: 'Lancio del bouquet', description: 'Fotografa il lancio del bouquet', points: 20 },
    { title: 'L\'uomo più elegante', description: 'Chi è l\'uomo meglio vestito?', points: 10 },
    { title: 'La damigella', description: 'Foto con una damigella', points: 15 },
    { title: 'Dettaglio', description: 'Scatta una foto creativa di un dettaglio', points: 10 },
  ];
  await supabase.from('photo_hunt_tasks').insert(defaults.map(t => ({ ...t, event_id: eventId })));
}

export async function registerForPhotoHunt(params: {
  event_id: string;
  guest_name: string;
  role: 'amico' | 'parente' | 'collega' | 'altro';
  guest_token: string;
}): Promise<{ registration?: PhotoHuntRegistration; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('photo_hunt_registrations').insert(params).select().single();
  if (error) return { error: error.message };
  return { registration: data };
}

export async function getPhotoHuntTasks(eventId: string): Promise<{ tasks?: PhotoHuntTask[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('photo_hunt_tasks').select('*').eq('event_id', eventId).order('points', { ascending: false });
  if (error) return { error: error.message };
  return { tasks: data ?? [] };
}

export async function submitPhotoTask(params: {
  event_id: string;
  task_id: string;
  registration_id: string;
  media_url: string;
}): Promise<{ submission?: PhotoHuntSubmission; error?: string }> {
  const supabase = createServiceClient();
  const task = await supabase.from('photo_hunt_tasks').select('points').eq('id', params.task_id).single();
  const points = task.data?.points ?? 10;
  const { data, error } = await supabase.from('photo_hunt_submissions').insert({
    event_id: params.event_id,
    task_id: params.task_id,
    registration_id: params.registration_id,
    media_url: params.media_url,
    points_awarded: points,
  }).select().single();
  if (error) return { error: error.message };
  const reg = await supabase.from('photo_hunt_registrations').select('score').eq('id', params.registration_id).single();
  const currentScore = reg.data?.score ?? 0;
  await supabase.from('photo_hunt_registrations').update({ score: currentScore + points }).eq('id', params.registration_id);
  return { submission: data };
}

export async function getPhotoHuntLeaderboard(eventId: string): Promise<{
  leaderboard?: { id: string; guest_name: string; role: string; score: number; tasks_done: number }[];
  error?: string;
}> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('photo_hunt_registrations')
    .select('id, guest_name, role, score')
    .eq('event_id', eventId)
    .order('score', { ascending: false });
  if (error) return { error: error.message };
  const withCounts = await Promise.all(
    (data ?? []).map(async (r: any) => {
      const { count } = await supabase
        .from('photo_hunt_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('registration_id', r.id);
      return { ...r, tasks_done: count ?? 0 };
    }),
  );
  return { leaderboard: withCounts };
}

export async function castDressVote(params: {
  event_id: string;
  voter_id: string;
  vote_type: 'sposo' | 'sposa';
  rating: number;
}): Promise<{ vote?: DressVote; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('dress_votes')
    .upsert(
      { event_id: params.event_id, voter_id: params.voter_id, vote_type: params.vote_type, rating: params.rating },
      { onConflict: 'event_id, voter_id, vote_type' },
    )
    .select()
    .single();
  if (error) return { error: error.message };
  return { vote: data };
}

export async function getDressVoteStats(eventId: string): Promise<{
  sposo?: { avg: number; count: number };
  sposa?: { avg: number; count: number };
  error?: string;
}> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('dress_votes').select('vote_type, rating').eq('event_id', eventId);
  if (error) return { error: error.message };
  const sposo = (data ?? []).filter((r: any) => r.vote_type === 'sposo');
  const sposa = (data ?? []).filter((r: any) => r.vote_type === 'sposa');
  const avg = (arr: any[]) => arr.length ? arr.reduce((a: number, r: any) => a + r.rating, 0) / arr.length : 0;
  return { sposo: { avg: avg(sposo), count: sposo.length }, sposa: { avg: avg(sposa), count: sposa.length } };
}

export async function getMyDressVote(eventId: string, voterId: string): Promise<{
  sposo?: number; sposa?: number;
}> {
  const supabase = createServiceClient();
  const { data } = await supabase.from('dress_votes').select('vote_type, rating').eq('event_id', eventId).eq('voter_id', voterId);
  const result: any = {};
  for (const r of data ?? []) result[r.vote_type as string] = r.rating;
  return result;
}

// --- Quiz sugli Sposi ---

export async function createQuizQuestion(params: {
  event_id: string;
  question_text: string;
  options: string[];
  correct_index: number | null;
  theme_tags: string[][];
  sort_order?: number;
}): Promise<{ question?: QuizQuestion; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('quiz_questions')
    .insert({
      event_id: params.event_id,
      question_text: params.question_text,
      options: params.options,
      correct_index: params.correct_index,
      theme_tags: params.theme_tags,
      sort_order: params.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  return { question: data };
}

export async function getQuizQuestions(eventId: string): Promise<{ questions?: QuizQuestion[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return { error: error.message };
  return { questions: data ?? [] };
}

export async function updateQuizQuestion(params: {
  id: string;
  question_text?: string;
  options?: string[];
  correct_index?: number | null;
  theme_tags?: string[][];
  sort_order?: number;
}): Promise<{ question?: QuizQuestion; error?: string }> {
  const supabase = createServiceClient();
  const updates: Record<string, unknown> = {};
  if (params.question_text !== undefined) updates.question_text = params.question_text;
  if (params.options !== undefined) updates.options = params.options;
  if (params.correct_index !== undefined) updates.correct_index = params.correct_index;
  if (params.theme_tags !== undefined) updates.theme_tags = params.theme_tags;
  if (params.sort_order !== undefined) updates.sort_order = params.sort_order;
  const { data, error } = await supabase.from('quiz_questions').update(updates).eq('id', params.id).select().single();
  if (error) return { error: error.message };
  return { question: data };
}

export async function deleteQuizQuestion(id: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('quiz_questions').delete().eq('id', id);
  if (error) return { error: error.message };
  return {};
}

export async function submitQuizAnswers(params: {
  event_id: string;
  answers: { question_id: string; selected_index: number }[];
  guest_token: string;
  guest_name?: string;
}): Promise<{ result?: QuizResult; error?: string }> {
  const supabase = createServiceClient();
  const { questions } = await getQuizQuestions(params.event_id);
  if (!questions || questions.length === 0) return { error: 'No questions found' };

  let totalScore = 0;
  const scoreByQuestion: Record<string, number> = {};

  for (const answer of params.answers) {
    const q = questions.find((qq) => qq.id === answer.question_id);
    if (!q) continue;
    const isCorrect = q.correct_index !== null && answer.selected_index === q.correct_index;
    const score = isCorrect ? 1 : 0;
    totalScore += score;
    scoreByQuestion[answer.question_id] = score;
  }

  const inserts = params.answers.map((a) => ({
    event_id: params.event_id,
    question_id: a.question_id,
    guest_token: params.guest_token,
    guest_name: params.guest_name ?? null,
    selected_index: a.selected_index,
    score: scoreByQuestion[a.question_id] ?? 0,
  }));

  const { data: saved, error } = await supabase.from('quiz_answers').insert(inserts).select();
  if (error) return { error: error.message };

  // Compute theme from preference questions
  const themeCounts: Record<string, number> = {};
  for (const answer of params.answers) {
    const q = questions.find((qq) => qq.id === answer.question_id);
    if (!q || q.correct_index !== null || !q.theme_tags || !q.theme_tags[answer.selected_index]) continue;
    const tags = q.theme_tags[answer.selected_index] as string[];
    for (const tag of tags) {
      themeCounts[tag] = (themeCounts[tag] ?? 0) + 1;
    }
  }
  const sorted = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]);
  const theme = sorted[0]?.[0] ?? null;

  return {
    result: {
      score: totalScore,
      total: questions.filter((q) => q.correct_index !== null).length,
      percentage: totalScore / Math.max(questions.filter((q) => q.correct_index !== null).length, 1),
      theme,
      answers: saved ?? [],
    },
  };
}

export async function getQuizLeaderboard(eventId: string): Promise<{
  leaderboard?: { guest_name: string; score: number; total: number }[];
  error?: string;
}> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('quiz_answers')
    .select('guest_name, score, guest_token')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) return { error: error.message };

  const guestScores = new Map<string, { guest_name: string; score: number; total: number; seen: Set<string> }>();
  for (const row of data ?? []) {
    const key = row.guest_token ?? row.guest_name ?? 'anon';
    const entry = guestScores.get(key) ?? { guest_name: row.guest_name ?? 'Anonimo', score: 0, total: 0, seen: new Set() };
    if (!entry.seen.has(row.guest_token + '_' + row.score)) {
      entry.score += row.score;
      entry.total += 1;
      entry.seen.add(row.guest_token + '_' + row.score);
    }
    guestScores.set(key, entry);
  }

  const leaderboard = Array.from(guestScores.values())
    .map(({ guest_name, score, total }) => ({ guest_name, score, total }))
    .sort((a, b) => b.score - a.score);
  return { leaderboard };
}

export async function getMyQuizResult(eventId: string, guestToken: string): Promise<{
  score: number; total: number; theme: string | null;
} | { error: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('quiz_answers')
    .select('score, question_id')
    .eq('event_id', eventId)
    .eq('guest_token', guestToken);
  if (error) return { error: error.message };
  const score = (data ?? []).reduce((a: number, r: any) => a + r.score, 0);
  const total = (data ?? []).length;
  const { questions } = await getQuizQuestions(eventId);
  const qs = questions ?? [];
  const scoredTotal = qs.filter((q) => q.correct_index !== null).length;
  return { score, total: scoredTotal || total, theme: null };
}

// --- Event Features (toggle giochi) ---

export async function getEventFeatures(eventId: string): Promise<{ features?: EventFeature[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('event_features')
    .select('*')
    .eq('event_id', eventId);
  if (error) return { error: error.message };

  const existing = data ?? [];
  const existingKeys = new Set(existing.map((f: EventFeature) => f.feature_key));

  const missing = AVAILABLE_FEATURES
    .filter((af) => !existingKeys.has(af.key))
    .map((af) => ({
      event_id: eventId,
      feature_key: af.key,
      enabled: false,
      settings: {},
    }));

  if (missing.length > 0) {
    const { error: insertError } = await supabase.from('event_features').insert(missing);
    if (insertError) return { error: insertError.message };
    const { data: all } = await supabase.from('event_features').select('*').eq('event_id', eventId);
    return { features: all ?? [] };
  }

  return { features: existing };
}

export async function setEventFeature(params: {
  event_id: string;
  feature_key: string;
  enabled: boolean;
}): Promise<{ feature?: EventFeature; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('event_features')
    .upsert(
      { event_id: params.event_id, feature_key: params.feature_key, enabled: params.enabled },
      { onConflict: 'event_id, feature_key' },
    )
    .select()
    .single();
  if (error) return { error: error.message };
  return { feature: data };
}

export async function seedDefaultQuizQuestions(eventId: string): Promise<{ count?: number; error?: string }> {
  const { questions } = await getQuizQuestions(eventId);
  if (questions && questions.length > 0) return { count: 0 };

  const defaults = [
    {
      question_text: 'Dove si sono conosciuti gli sposi?',
      options: ['Scuola/Università', 'Lavoro', 'Amici in comune', 'App/Online'],
      correct_index: 2,
      theme_tags: [['giovani', 'studio'], ['carriera', 'moderno'], ['amicizia', 'tradizione'], ['moderno', 'trendy']],
    },
    {
      question_text: 'Chi ha fatto la proposta di matrimonio?',
      options: ['Lo sposo', 'La sposa', 'Insieme', 'È stata una sorpresa'],
      correct_index: 0,
      theme_tags: [['tradizione', 'classico'], ['moderno', 'originale'], ['moderno', 'paritario'], ['romantico', 'sorpresa']],
    },
    {
      question_text: 'Qual è il piatto preferito degli sposi?',
      options: ['Pizza', 'Sushi', 'Pasta', 'Carne alla griglia'],
      correct_index: 2,
      theme_tags: [['informale', 'allegro'], ['trendy', 'internazionale'], ['italiano', 'tradizione'], ['rustico', 'campagna']],
    },
    {
      question_text: 'Dove vorrebbero vivere dopo il matrimonio?',
      options: ['In città', 'In campagna', 'All\'estero', 'In montagna'],
      correct_index: null,
      theme_tags: [['moderno', 'city'], ['rustico', 'natura'], ['trendy', 'viaggio'], ['inverno', 'montagna']],
    },
    {
      question_text: 'Che tipo di luna di miele sognano?',
      options: ['Tropicale/spiaggia', 'City break europeo', 'Avventura/zaino in spalla', 'Crociera'],
      correct_index: null,
      theme_tags: [['spiaggia', 'estate'], ['elegante', 'città'], ['avventura', 'originale'], ['classico', 'lusso']],
    },
    {
      question_text: 'Quale stile di abbigliamento preferiscono?',
      options: ['Elegante classico', 'Casuale chic', 'Bohémien', 'Minimal moderno'],
      correct_index: null,
      theme_tags: [['classico', 'elegante'], ['moderno', 'chic'], ['boho', 'romantico'], ['minimal', 'moderno']],
    },
    {
      question_text: 'Che atmosfera desiderano per il ricevimento?',
      options: ['Formale ed elegante', 'Rilassata e divertente', 'Romantica e intima', 'Grande festa con tutti'],
      correct_index: null,
      theme_tags: [['elegante', 'formale'], ['allegro', 'informale'], ['romantico', 'intimo'], ['grande', 'festa']],
    },
    {
      question_text: 'Quale colore preferiscono per il loro matrimonio?',
      options: ['Bianco e avorio', 'Pastelli romantici', 'Toni caldi/terra', 'Colori vivaci'],
      correct_index: null,
      theme_tags: [['classico', 'elegante'], ['romantico', 'pastello'], ['rustico', 'terra'], ['allegro', 'vivace']],
    },
  ];

  const supabase = createServiceClient();
  const inserts = defaults.map((d) => ({
    event_id: eventId,
    question_text: d.question_text,
    options: d.options,
    correct_index: d.correct_index,
    theme_tags: d.theme_tags,
    sort_order: 0,
  }));

  const { error } = await supabase.from('quiz_questions').insert(inserts);
  if (error) return { error: error.message };
  return { count: defaults.length };
}
