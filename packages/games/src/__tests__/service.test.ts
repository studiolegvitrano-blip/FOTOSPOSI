import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

function chain(val: any): any {
  const p = Promise.resolve({ data: val, error: null });
  (p as any).eq = vi.fn(() => chain(val));
  (p as any).in = vi.fn(() => chain(val));
  (p as any).single = vi.fn().mockResolvedValue({ data: val, error: null });
  (p as any).maybeSingle = vi.fn().mockResolvedValue({ data: val, error: null });
  (p as any).order = vi.fn(() => chain(val));
  (p as any).limit = vi.fn().mockResolvedValue({ data: val, error: null });
  (p as any).select = vi.fn(() => chain(val));
  return p;
}

function failChain(err: string): any {
  const p = Promise.resolve({ data: null, error: { message: err } });
  (p as any).eq = vi.fn(() => failChain(err));
  (p as any).in = vi.fn(() => failChain(err));
  (p as any).single = vi.fn().mockResolvedValue({ data: null, error: { message: err } });
  (p as any).maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: err } });
  (p as any).order = vi.fn(() => failChain(err));
  (p as any).limit = vi.fn().mockResolvedValue({ data: null, error: { message: err } });
  (p as any).select = vi.fn(() => failChain(err));
  return p;
}

function build(val: any) {
  return {
    select: () => chain(val),
    insert: (obj?: any) => chain(obj ?? val),
    upsert: () => chain(null),
    update: () => chain(val),
    delete: () => chain(val),
  };
}

function buildFail(err: string) {
  return {
    select: () => failChain(err),
    insert: () => failChain(err),
    upsert: () => failChain(err),
    update: () => failChain(err),
    delete: () => failChain(err),
  };
}

vi.mock('@fotosposi/core', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const {
  registerForPhotoHunt, getPhotoHuntTasks, ensureDefaultTasks,
  submitPhotoTask, getPhotoHuntLeaderboard,
  castDressVote, getDressVoteStats, getMyDressVote,
  createQuizQuestion, getQuizQuestions, updateQuizQuestion, deleteQuizQuestion,
  submitQuizAnswers, getQuizLeaderboard, getMyQuizResult,
} = await import('../service');

// --- photo_hunt ---

describe('registerForPhotoHunt', () => {
  const params = { event_id: 'evt1', guest_name: 'Marco', role: 'amico' as const, guest_token: 'tok123' };

  it('registers a guest for photo hunt', async () => {
    mockFrom.mockReturnValue(build({ id: 'r1', ...params, score: 0, created_at: '2026-01-01' }));
    const result = await registerForPhotoHunt(params);
    expect(result.registration?.guest_name).toBe('Marco');
    expect(result.registration?.role).toBe('amico');
    expect(result.error).toBeUndefined();
  });

  it('returns error on insert failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await registerForPhotoHunt(params);
    expect(result.registration).toBeUndefined();
    expect(result.error).toBe('DB error');
  });
});

describe('getPhotoHuntTasks', () => {
  it('returns tasks for an event', async () => {
    mockFrom.mockReturnValue(build([
      { id: 't1', event_id: 'evt1', title: 'Selfie con la sposa', points: 20 },
      { id: 't2', event_id: 'evt1', title: 'Foto con la torta', points: 10 },
    ]));
    const result = await getPhotoHuntTasks('evt1');
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks![0].title).toBe('Selfie con la sposa');
  });

  it('returns empty array when no tasks', async () => {
    mockFrom.mockReturnValue(build([]));
    const result = await getPhotoHuntTasks('evt1');
    expect(result.tasks).toEqual([]);
  });

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await getPhotoHuntTasks('evt1');
    expect(result.error).toBe('DB error');
  });
});

describe('ensureDefaultTasks', () => {
  it('does nothing if tasks already exist', async () => {
    mockFrom.mockReturnValue(build([{ id: 't1' }]));
    await ensureDefaultTasks('evt1');
    expect(mockFrom).toHaveBeenCalledWith('photo_hunt_tasks');
  });

  it('inserts default tasks when none exist', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return build([]);
      return build([{ id: 'new' }]);
    });
    await ensureDefaultTasks('evt1');
    expect(callCount).toBe(2);
  });
});

describe('submitPhotoTask', () => {
  const params = { event_id: 'evt1', task_id: 't1', registration_id: 'r1', media_url: 'https://img.com/p.jpg' };

  it('submits a photo and awards points', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'photo_hunt_tasks') return build({ id: 't1', points: 20 });
      if (table === 'photo_hunt_registrations') return build({ id: 'r1', score: 30 });
      return build({ id: 's1', ...params, points_awarded: 20 });
    });
    const result = await submitPhotoTask(params);
    expect(result.submission?.points_awarded).toBe(20);
    expect(result.error).toBeUndefined();
  });

  it('returns error on first DB failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await submitPhotoTask(params);
    expect(result.submission).toBeUndefined();
    expect(result.error).toBe('DB error');
  });
});

describe('getPhotoHuntLeaderboard', () => {
  it('returns leaderboard sorted by score', async () => {
    function chainWithCount(val: any, count: number): any {
      const p = Promise.resolve({ data: val, error: null, count });
      (p as any).eq = vi.fn(() => chainWithCount(val, count));
      (p as any).order = vi.fn(() => chainWithCount(val, count));
      (p as any).limit = vi.fn().mockResolvedValue({ data: val, error: null, count });
      return p;
    }
    mockFrom.mockImplementation((table: string) => {
      if (table === 'photo_hunt_registrations') return build([
        { id: 'r1', guest_name: 'Marco', role: 'amico', score: 40 },
        { id: 'r2', guest_name: 'Anna', role: 'parente', score: 25 },
      ]);
      return {
        select: () => chainWithCount(null, 5),
        insert: () => chain(null),
        upsert: () => chain(null),
        update: () => chain(null),
        delete: () => chain(null),
      };
    });
    const result = await getPhotoHuntLeaderboard('evt1');
    expect(result.leaderboard).toHaveLength(2);
    expect(result.leaderboard![0].guest_name).toBe('Marco');
    expect(result.leaderboard![0].tasks_done).toBe(5);
  });

  it('returns empty array when no registrations', async () => {
    mockFrom.mockReturnValue(build([]));
    const result = await getPhotoHuntLeaderboard('evt1');
    expect(result.leaderboard).toEqual([]);
  });

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await getPhotoHuntLeaderboard('evt1');
    expect(result.error).toBe('DB error');
  });
});

// --- dress_vote ---

describe('castDressVote', () => {
  function upsertBuild(val: any) {
    const ch = chain(val);
    return {
      select: () => ch,
      insert: () => chain(null),
      upsert: () => ({ select: () => ({ single: () => Promise.resolve({ data: val, error: null }) }) }),
      update: () => ch,
      delete: () => ch,
    };
  }

  it('upserts a vote for sposo', async () => {
    mockFrom.mockReturnValue(upsertBuild({ id: 'v1', event_id: 'evt1', voter_id: 'u1', vote_type: 'sposo', rating: 4 }));
    const result = await castDressVote({ event_id: 'evt1', voter_id: 'u1', vote_type: 'sposo', rating: 4 });
    expect(result.vote?.vote_type).toBe('sposo');
    expect(result.vote?.rating).toBe(4);
    expect(result.error).toBeUndefined();
  });

  it('upserts a vote for sposa', async () => {
    mockFrom.mockReturnValue(upsertBuild({ id: 'v2', event_id: 'evt1', voter_id: 'u1', vote_type: 'sposa', rating: 5 }));
    const result = await castDressVote({ event_id: 'evt1', voter_id: 'u1', vote_type: 'sposa', rating: 5 });
    expect(result.vote?.rating).toBe(5);
  });

  it('returns error on upsert failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await castDressVote({ event_id: 'evt1', voter_id: 'u1', vote_type: 'sposo', rating: 3 });
    expect(result.error).toBe('DB error');
  });
});

describe('getDressVoteStats', () => {
  it('returns avg and count for both sposo and sposa', async () => {
    mockFrom.mockReturnValue(build([
      { vote_type: 'sposo', rating: 4 },
      { vote_type: 'sposo', rating: 5 },
      { vote_type: 'sposo', rating: 3 },
      { vote_type: 'sposa', rating: 5 },
      { vote_type: 'sposa', rating: 4 },
    ]));
    const result = await getDressVoteStats('evt1');
    expect(result.sposo?.count).toBe(3);
    expect(result.sposo?.avg).toBe(4);
    expect(result.sposa?.count).toBe(2);
    expect(result.sposa?.avg).toBe(4.5);
  });

  it('returns zero stats when no votes', async () => {
    mockFrom.mockReturnValue(build([]));
    const result = await getDressVoteStats('evt1');
    expect(result.sposo?.count).toBe(0);
    expect(result.sposo?.avg).toBe(0);
    expect(result.sposa?.count).toBe(0);
    expect(result.sposa?.avg).toBe(0);
  });

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await getDressVoteStats('evt1');
    expect(result.error).toBe('DB error');
  });
});

describe('getMyDressVote', () => {
  it('returns my votes for both types', async () => {
    mockFrom.mockReturnValue(build([
      { vote_type: 'sposo', rating: 4 },
      { vote_type: 'sposa', rating: 5 },
    ]));
    const result = await getMyDressVote('evt1', 'u1');
    expect(result.sposo).toBe(4);
    expect(result.sposa).toBe(5);
  });

  it('returns partial votes', async () => {
    mockFrom.mockReturnValue(build([{ vote_type: 'sposo', rating: 3 }]));
    const result = await getMyDressVote('evt1', 'u1');
    expect(result.sposo).toBe(3);
    expect(result.sposa).toBeUndefined();
  });

  it('returns empty object when no votes', async () => {
    mockFrom.mockReturnValue(build([]));
    const result = await getMyDressVote('evt1', 'u1');
    expect(result.sposo).toBeUndefined();
    expect(result.sposa).toBeUndefined();
  });
});

// --- Quiz sugli Sposi ---

describe('createQuizQuestion', () => {
  const params = { event_id: 'evt1', question_text: 'Dove si sono conosciuti?', options: ['Scuola', 'Lavoro', 'Amici', 'Tinder'], correct_index: 0 as number | null, theme_tags: [['scuola'], ['lavoro'], ['amicizia'], ['moderno']] as string[][] };

  it('creates a quiz question', async () => {
    mockFrom.mockReturnValue(build({ id: 'q1', ...params, theme_tags: params.theme_tags, sort_order: 0, created_at: '2026-01-01' }));
    const result = await createQuizQuestion(params);
    expect(result.question?.question_text).toBe('Dove si sono conosciuti?');
    expect(result.error).toBeUndefined();
  });

  it('creates a preference question', async () => {
    const prefParams = { ...params, correct_index: null, question_text: 'Stile preferito?', options: ['Rustico', 'Elegante'], theme_tags: [['rustico', 'campagna'], ['elegante', 'classico']] };
    mockFrom.mockReturnValue(build({ id: 'q2', ...prefParams, theme_tags: prefParams.theme_tags, sort_order: 1, created_at: '2026-01-01' }));
    const result = await createQuizQuestion(prefParams);
    expect(result.question?.correct_index).toBeNull();
    expect(result.question?.theme_tags).toEqual([['rustico', 'campagna'], ['elegante', 'classico']]);
  });

  it('returns error on insert failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await createQuizQuestion(params);
    expect(result.error).toBe('DB error');
  });
});

describe('getQuizQuestions', () => {
  it('returns questions sorted by order', async () => {
    mockFrom.mockReturnValue(build([
      { id: 'q1', event_id: 'evt1', question_text: 'Q1', sort_order: 0 },
      { id: 'q2', event_id: 'evt1', question_text: 'Q2', sort_order: 1 },
    ]));
    const result = await getQuizQuestions('evt1');
    expect(result.questions).toHaveLength(2);
    expect(result.questions![0].question_text).toBe('Q1');
  });

  it('returns empty array when none exist', async () => {
    mockFrom.mockReturnValue(build([]));
    const result = await getQuizQuestions('evt1');
    expect(result.questions).toEqual([]);
  });

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await getQuizQuestions('evt1');
    expect(result.error).toBe('DB error');
  });
});

describe('updateQuizQuestion', () => {
  it('updates question text', async () => {
    mockFrom.mockReturnValue(build({ id: 'q1', question_text: 'Updated?' }));
    const result = await updateQuizQuestion({ id: 'q1', question_text: 'Updated?' });
    expect(result.question?.question_text).toBe('Updated?');
  });

  it('returns error on update failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await updateQuizQuestion({ id: 'q1', question_text: 'X' });
    expect(result.error).toBe('DB error');
  });
});

describe('deleteQuizQuestion', () => {
  it('deletes a question', async () => {
    mockFrom.mockReturnValue(build({ id: 'q1' }));
    const result = await deleteQuizQuestion('q1');
    expect(result.error).toBeUndefined();
  });

  it('returns error on delete failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await deleteQuizQuestion('q1');
    expect(result.error).toBe('DB error');
  });
});

describe('submitQuizAnswers', () => {
  const params = {
    event_id: 'evt1',
    guest_token: 'tok123',
    guest_name: 'Marco',
    answers: [
      { question_id: 'q1', selected_index: 0 },
      { question_id: 'q2', selected_index: 1 },
    ],
  };

  function buildWith(val: any): any {
    const ch = chain(val);
    return {
      select: () => ch,
      insert: (obj?: any) => chain(obj ?? val),
      upsert: () => chain(null),
      update: () => chain(val),
      delete: () => chain(val),
    };
  }

  it('submits answers and returns score + theme', async () => {
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      callCount++;
      if (table === 'quiz_questions') {
        return build([
          { id: 'q1', correct_index: 0, theme_tags: [['scuola'], ['lavoro'], ['amici'], ['app']] },
          { id: 'q2', correct_index: null, options: ['Rustico', 'Elegante'], theme_tags: [['rustico', 'campagna'], ['elegante', 'classico']] },
        ]);
      }
      if (table === 'quiz_answers') {
        return buildWith([
          { id: 'a1', question_id: 'q1', score: 1 },
          { id: 'a2', question_id: 'q2', score: 0 },
        ]);
      }
      return build(null);
    });
    const result = await submitQuizAnswers(params);
    expect(result.result?.score).toBe(1);
    expect(result.result?.total).toBe(1);
    expect(result.result?.theme).toBe('elegante');
    expect(result.result?.answers).toHaveLength(2);
  });

  it('returns error when no questions exist', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'quiz_questions') return build([]);
      return build(null);
    });
    const result = await submitQuizAnswers(params);
    expect(result.error).toBe('No questions found');
  });

  it('returns error on insert failure', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'quiz_questions') return build([{ id: 'q1', correct_index: 0, theme_tags: [[]] }]);
      if (table === 'quiz_answers') return buildFail('DB error');
      return build(null);
    });
    const result = await submitQuizAnswers(params);
    expect(result.error).toBe('DB error');
  });
});

describe('getQuizLeaderboard', () => {
  it('returns sorted leaderboard', async () => {
    mockFrom.mockReturnValue(build([
      { guest_name: 'Marco', score: 3, guest_token: 't1' },
      { guest_name: 'Anna', score: 5, guest_token: 't2' },
    ]));
    const result = await getQuizLeaderboard('evt1');
    expect(result.leaderboard).toHaveLength(2);
    expect(result.leaderboard![0].guest_name).toBe('Anna');
    expect(result.leaderboard![0].score).toBe(5);
  });

  it('returns empty when no answers', async () => {
    mockFrom.mockReturnValue(build([]));
    const result = await getQuizLeaderboard('evt1');
    expect(result.leaderboard).toEqual([]);
  });
});

describe('getMyQuizResult', () => {
  it('returns score for guest token', async () => {
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      callCount++;
      if (table === 'quiz_answers') return build([{ score: 1 }, { score: 1 }]);
      if (table === 'quiz_questions') return build([{ correct_index: 0 }, { correct_index: 2 }]);
      return build(null);
    });
    const result = await getMyQuizResult('evt1', 'tok123');
    if ('error' in result) return expect(result).toEqual({ error: expect.any(String) });
    expect(result.score).toBe(2);
  });

  it('returns error on failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await getMyQuizResult('evt1', 'tok123');
    expect('error' in result).toBe(true);
  });
});
