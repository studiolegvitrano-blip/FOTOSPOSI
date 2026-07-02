CREATE TABLE IF NOT EXISTS social_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES core_users(id),
  medium TEXT NOT NULL CHECK (medium IN ('whatsapp', 'instagram', 'facebook', 'twitter', 'copy_link', 'download', 'other')),
  content_type TEXT NOT NULL CHECK (content_type IN ('photo_overlay', 'wrapped_card', 'site_invite', 'guestbook', 'other')),
  clicked_back BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE marketplace_suppliers ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ;
ALTER TABLE marketplace_suppliers ADD COLUMN IF NOT EXISTS contacted_by UUID REFERENCES core_users(id);
ALTER TABLE marketplace_suppliers ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT false;
