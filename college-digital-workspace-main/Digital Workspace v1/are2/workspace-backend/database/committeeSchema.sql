-- ============================================
-- committeeSchema.sql — Committee Database Schema
-- ============================================
-- Applied IDENTICALLY to workspace_dlle, workspace_gyk, workspace_nss.
-- NO committee_id column anywhere — the database IS one committee.
-- User ID fields (created_by, uploaded_by, etc.) are plain UUIDs
-- referencing workspace_master.users — NOT foreign keys.
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════
--  FOLDERS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    created_by UUID NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1',
    is_starred BOOLEAN DEFAULT FALSE,
    is_trashed BOOLEAN DEFAULT FALSE,
    trashed_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════
--  FILES
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) DEFAULT 'application/octet-stream',
    size BIGINT DEFAULT 0,
    storage_path VARCHAR(500) NOT NULL,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    uploaded_by UUID NOT NULL,
    description TEXT DEFAULT '',
    tags TEXT[] DEFAULT '{}',
    version INTEGER DEFAULT 1,
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with UUID[] DEFAULT '{}',
    share_link VARCHAR(255) DEFAULT NULL,
    share_token VARCHAR(100) UNIQUE DEFAULT NULL,
    is_starred BOOLEAN DEFAULT FALSE,
    is_trashed BOOLEAN DEFAULT FALSE,
    trashed_at TIMESTAMP DEFAULT NULL,
    checksum VARCHAR(64) DEFAULT NULL,
    last_accessed_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════
--  TASKS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'inprogress', 'complete')),
    priority VARCHAR(10) DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    created_by UUID NOT NULL,
    assigned_to UUID DEFAULT NULL,
    due_date TIMESTAMP DEFAULT NULL,
    completed_at TIMESTAMP DEFAULT NULL,
    attachments JSONB DEFAULT '[]',
    labels TEXT[] DEFAULT '{}',
    is_starred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════
--  CHAT ROOMS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    type VARCHAR(20) DEFAULT 'group'
        CHECK (type IN ('general', 'group', 'direct', 'announcement')),
    created_by UUID NOT NULL,
    members UUID[] DEFAULT '{}',
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════
--  MESSAGES
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'text'
        CHECK (type IN ('text', 'file', 'image', 'system')),
    file_url VARCHAR(500) DEFAULT NULL,
    file_name VARCHAR(255) DEFAULT NULL,
    file_size BIGINT DEFAULT NULL,
    reply_to UUID REFERENCES messages(id) DEFAULT NULL,
    reactions JSONB DEFAULT '{}',
    read_by UUID[] DEFAULT '{}',
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════
--  MEETINGS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    is_all_day BOOLEAN DEFAULT FALSE,
    location VARCHAR(255) DEFAULT '',
    meeting_link VARCHAR(500) DEFAULT NULL,
    created_by UUID NOT NULL,
    attendees UUID[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule VARCHAR(255) DEFAULT NULL,
    minutes TEXT DEFAULT '',
    attachments JSONB DEFAULT '[]',
    color VARCHAR(7) DEFAULT '#6366f1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════
--  ANNOUNCEMENTS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_by UUID NOT NULL,
    priority VARCHAR(10) DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_pinned BOOLEAN DEFAULT FALSE,
    target_roles TEXT[] DEFAULT '{}',
    attachments JSONB DEFAULT '[]',
    expires_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════
--  ACTIVITY LOG
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID DEFAULT NULL,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════
--  NOTIFICATIONS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT DEFAULT '',
    link VARCHAR(500) DEFAULT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════
--  INDEXES
-- ═══════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_creator ON folders(created_by);
CREATE INDEX IF NOT EXISTS idx_folders_trashed ON folders(is_trashed);

CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_uploader ON files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_files_trashed ON files(is_trashed);
CREATE INDEX IF NOT EXISTS idx_files_starred ON files(is_starred) WHERE is_starred = true;

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meetings_time ON meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_meetings_creator ON meetings(created_by);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);

CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(is_pinned, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ═══════════════════════════════════════════════
--  DEFAULT GENERAL CHAT ROOM
-- ═══════════════════════════════════════════════
INSERT INTO chat_rooms (name, description, type, created_by)
SELECT 'General', 'General discussion for all committee members', 'general', '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM chat_rooms WHERE type = 'general' AND name = 'General');
