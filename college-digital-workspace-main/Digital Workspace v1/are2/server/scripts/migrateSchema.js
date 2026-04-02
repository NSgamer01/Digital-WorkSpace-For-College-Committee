// ============================================
// scripts/migrateSchema.js
// ============================================
// Adds all missing columns to committee databases
// to match what the backend routes expect.
//
// Run with: node scripts/migrateSchema.js
// ============================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const committeeDbManager = require('../config/committeeDbManager');

const MIGRATION_SQL = `
-- ═══════════════════════════════════════════════
-- TASKS: Add labels, attachments columns + expand status CHECK
-- ═══════════════════════════════════════════════

-- Add labels column (text array)
DO $$ BEGIN
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add attachments column (JSONB)
DO $$ BEGIN
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Expand tasks.status to include 'todo', 'review', 'done'
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('pending', 'todo', 'in_progress', 'review', 'done', 'completed', 'cancelled'));

-- ═══════════════════════════════════════════════
-- ANNOUNCEMENTS: Rename sender_id → created_by, add target_roles, attachments
-- ═══════════════════════════════════════════════

-- Rename sender_id to created_by if sender_id exists and created_by doesn't
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='sender_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='created_by')
    THEN
        ALTER TABLE announcements RENAME COLUMN sender_id TO created_by;
    END IF;
END $$;

-- Add created_by if it doesn't exist and sender_id also doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='created_by')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='sender_id')
    THEN
        ALTER TABLE announcements ADD COLUMN created_by UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
    END IF;
END $$;

-- Add target_roles column (text array for role-based targeting)
DO $$ BEGIN
    ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_roles TEXT[] DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add attachments column (JSONB)
DO $$ BEGIN
    ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ═══════════════════════════════════════════════
-- MEETINGS: Add attendees, status, minutes, attachments, color
-- ═══════════════════════════════════════════════

-- Add attendees (UUID array — replaces meeting_participants for simple cases)
DO $$ BEGIN
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS attendees UUID[] DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add status
DO $$ BEGIN
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'scheduled';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add minutes (text for meeting notes)
DO $$ BEGIN
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS minutes TEXT DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add attachments (JSONB)
DO $$ BEGIN
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ═══════════════════════════════════════════════
-- MESSAGES: Add file_url, file_name, file_size, read_by
-- ═══════════════════════════════════════════════

-- Add file_url (for Supabase/external file links)
DO $$ BEGIN
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_url TEXT DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add file_name
DO $$ BEGIN
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name VARCHAR(500) DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add file_size
DO $$ BEGIN
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add read_by (UUID array for read receipts)
DO $$ BEGIN
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ═══════════════════════════════════════════════
-- CHAT_ROOMS: Add is_archived, members
-- ═══════════════════════════════════════════════

-- Add is_archived
DO $$ BEGIN
    ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add members (UUID array — simplified member list)
DO $$ BEGIN
    ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS members UUID[] DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ═══════════════════════════════════════════════
-- NOTIFICATIONS: Add link
-- ═══════════════════════════════════════════════

-- Add link (URL/path for notification click)
DO $$ BEGIN
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link VARCHAR(500) DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ═══════════════════════════════════════════════
-- TASK_COMMENTS: Create if not exists
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL,
    content TEXT NOT NULL,
    reactions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_author ON task_comments(author_id);

-- Auto-update trigger for task_comments
DROP TRIGGER IF EXISTS trigger_update_task_comments_updated_at ON task_comments;
CREATE TRIGGER trigger_update_task_comments_updated_at
BEFORE UPDATE ON task_comments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

async function migrate() {
    console.log('');
    console.log('══════════════════════════════════════════');
    console.log('  🗄️  Schema Migration: Add Missing Columns');
    console.log('══════════════════════════════════════════');
    console.log('');

    const slugs = committeeDbManager.getRegisteredSlugs();

    if (slugs.length === 0) {
        console.log('  ⚠️  No committee databases registered.');
        console.log('  Make sure committeeDbManager is configured.');
        process.exit(1);
    }

    for (const slug of slugs) {
        try {
            await committeeDbManager.query(slug, MIGRATION_SQL);
            console.log(`  ✅ ${slug}: All missing columns added`);
        } catch (err) {
            console.error(`  ❌ ${slug}: ${err.message}`);
        }
    }

    console.log('');
    console.log('  Tables updated:');
    console.log('   • tasks           → +labels, +attachments, expanded status');
    console.log('   • announcements   → sender_id→created_by, +target_roles, +attachments');
    console.log('   • meetings        → +attendees, +status, +minutes, +attachments');
    console.log('   • messages        → +file_url, +file_name, +file_size, +read_by');
    console.log('   • chat_rooms      → +is_archived, +members');
    console.log('   • notifications   → +link');
    console.log('   • task_comments   → created (new table)');
    console.log('');
    console.log('══════════════════════════════════════════');
    console.log('  🎉  Migration complete!');
    console.log('══════════════════════════════════════════');
    console.log('');

    process.exit(0);
}

migrate();
