-- Media schema

CREATE TABLE media_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sub_event_id UUID REFERENCES sub_events(id),
  uploaded_by UUID NOT NULL REFERENCES core_users(id),
  type TEXT NOT NULL CHECK (type IN ('photo', 'video')),
  url TEXT NOT NULL,
  drive_file_id TEXT,
  drive_sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (drive_sync_status IN ('pending', 'synced', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;

CREATE TABLE video_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  from_user UUID NOT NULL REFERENCES core_users(id),
  type TEXT NOT NULL CHECK (type IN ('welcome', 'guestbook')),
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE video_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read media of their event" ON media_uploads
  FOR SELECT USING (
    event_id IN (SELECT event_id FROM core_users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert media to their event" ON media_uploads
  FOR INSERT WITH CHECK (
    event_id IN (SELECT event_id FROM core_users WHERE id = auth.uid())
  );

CREATE POLICY "Users can read video messages of their event" ON video_messages
  FOR SELECT USING (
    event_id IN (SELECT event_id FROM core_users WHERE id = auth.uid())
  );
