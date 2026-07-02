-- Performance indexes + Realtime enable for live updates

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'media_uploads') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE media_uploads;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'votes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE votes;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_core_users_event_id ON core_users(event_id);

CREATE INDEX IF NOT EXISTS idx_core_auth_tokens_token ON core_auth_tokens(token);
CREATE INDEX IF NOT EXISTS idx_core_auth_tokens_event_expires ON core_auth_tokens(event_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_tier ON events(tier);

CREATE INDEX IF NOT EXISTS idx_sub_events_event_id ON sub_events(event_id);

CREATE INDEX IF NOT EXISTS idx_event_windows_event_id ON event_windows(event_id);

CREATE INDEX IF NOT EXISTS idx_media_uploads_event_id ON media_uploads(event_id);
CREATE INDEX IF NOT EXISTS idx_media_uploads_uploaded_by ON media_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_uploads_event_created ON media_uploads(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_uploads_drive_sync ON media_uploads(drive_sync_status) WHERE drive_sync_status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_votes_event_category ON votes(event_id, category_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_id ON votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_votes_media_id ON votes(media_id);

CREATE INDEX IF NOT EXISTS idx_video_messages_event_id ON video_messages(event_id);

CREATE INDEX IF NOT EXISTS idx_upload_queue_event_status ON upload_queue(event_id, status);
CREATE INDEX IF NOT EXISTS idx_upload_queue_status ON upload_queue(status);

CREATE INDEX IF NOT EXISTS idx_concierge_messages_event_user ON concierge_messages(event_id, user_id);

CREATE INDEX IF NOT EXISTS idx_social_shares_event_id ON social_shares(event_id);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_event_id ON quiz_questions(event_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_event_id ON quiz_answers(event_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question_id ON quiz_answers(question_id);

CREATE INDEX IF NOT EXISTS idx_face_tags_user_id ON face_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_face_tags_media_id ON face_tags(media_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_suppliers_category ON marketplace_suppliers(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_suppliers_approved ON marketplace_suppliers(approved) WHERE approved = true;

CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_supplier_id ON marketplace_reviews(supplier_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_event_id ON marketplace_reviews(event_id);

CREATE INDEX IF NOT EXISTS idx_b2b_reports_tenant_id ON b2b_reports(tenant_id);

CREATE INDEX IF NOT EXISTS idx_notification_log_event_id ON notification_log(event_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_status ON notification_log(status);
