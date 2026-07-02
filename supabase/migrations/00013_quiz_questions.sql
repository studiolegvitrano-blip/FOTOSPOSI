CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_index INT,
  theme_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  guest_token TEXT NOT NULL,
  guest_name TEXT,
  selected_index INT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz_questions_select" ON quiz_questions FOR SELECT USING (true);
CREATE POLICY "quiz_questions_insert" ON quiz_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "quiz_questions_update" ON quiz_questions FOR UPDATE USING (true);
CREATE POLICY "quiz_questions_delete" ON quiz_questions FOR DELETE USING (true);

CREATE POLICY "quiz_answers_select" ON quiz_answers FOR SELECT USING (true);
CREATE POLICY "quiz_answers_insert" ON quiz_answers FOR INSERT WITH CHECK (true);
