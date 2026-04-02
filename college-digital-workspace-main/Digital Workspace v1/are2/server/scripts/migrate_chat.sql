-- ============================================
-- migrate_chat.sql — Chat System Fix Migration
-- ============================================
-- Run on ALL committee databases:
--   workspace_dlle, workspace_gyk, workspace_nss
-- ============================================

-- STEP 1: Ensure user_name allows NULL
ALTER TABLE messages ALTER COLUMN user_name DROP NOT NULL;

-- STEP 2: Add participants column to channels if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channels' AND column_name = 'participants'
  ) THEN
    ALTER TABLE channels ADD COLUMN participants UUID[] DEFAULT '{}';
  END IF;
END $$;

-- STEP 3: Update channels type constraint to include 'dm'
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_type_check;
ALTER TABLE channels ADD CONSTRAINT channels_type_check
  CHECK (type IN ('text', 'announcement', 'dm'));

-- STEP 4: Performance indexes

-- Message fetching by channel (most critical for speed)
CREATE INDEX IF NOT EXISTS idx_messages_channel_created
  ON messages(channel_id, created_at ASC);

-- Incremental polling: find non-deleted messages after a timestamp
CREATE INDEX IF NOT EXISTS idx_messages_channel_created_desc
  ON messages(channel_id, created_at DESC)
  WHERE is_deleted = false;

-- DM channel lookup: find existing DM between two users (GIN on participants array)
CREATE INDEX IF NOT EXISTS idx_channels_type_participants
  ON channels USING GIN (participants)
  WHERE type = 'dm';

-- User lookup for name enrichment
CREATE INDEX IF NOT EXISTS idx_messages_user_id
  ON messages(user_id);

-- STEP 5: Seed default channels if they don't exist
INSERT INTO channels (name, slug, type, is_default, created_by)
SELECT 'general', 'general', 'text', true, '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE slug = 'general');

INSERT INTO channels (name, slug, type, is_default, created_by)
SELECT 'announcements', 'announcements', 'announcement', true, '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE slug = 'announcements');

-- Done!
-- Run the one-time DM cleanup after deploying the backend fix:
--   POST /api/chat/admin/cleanup-duplicate-dms
