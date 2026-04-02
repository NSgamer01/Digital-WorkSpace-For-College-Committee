-- ============================================
-- College Workspace — PostgreSQL Schema
-- ============================================
-- Complete database schema with tables, indexes,
-- views, triggers, and seed data.
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════
--  TABLE 1: USERS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    avatar VARCHAR(500) DEFAULT NULL,
    role VARCHAR(20) DEFAULT 'student'
        CHECK (role IN ('student', 'teacher', 'admin', 'head', 'volunteer', 'member')),
    department VARCHAR(100) DEFAULT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    bio TEXT DEFAULT NULL,
    storage_used BIGINT DEFAULT 0,
    storage_limit BIGINT DEFAULT 5368709120,     -- 5 GB
    is_active BOOLEAN DEFAULT TRUE,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ═══════════════════════════════════════════════
--  TABLE 2: FOLDERS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    parent_id UUID DEFAULT NULL REFERENCES folders(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    path TEXT DEFAULT '/',
    color VARCHAR(7) DEFAULT '#6366f1',
    icon VARCHAR(10) DEFAULT '📁',
    description TEXT DEFAULT '',
    is_starred BOOLEAN DEFAULT FALSE,
    is_trashed BOOLEAN DEFAULT FALSE,
    trashed_at TIMESTAMP DEFAULT NULL,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_owner ON folders(created_by);
CREATE INDEX IF NOT EXISTS idx_folders_trashed ON folders(is_trashed);
CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path);

-- ═══════════════════════════════════════════════
--  TABLE 2B: FOLDER_SHARES
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS folder_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES users(id),
    shared_with UUID NOT NULL REFERENCES users(id),
    permission VARCHAR(10) DEFAULT 'view'
        CHECK (permission IN ('view', 'edit')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(folder_id, shared_with)
);

CREATE INDEX IF NOT EXISTS idx_folder_shares_folder ON folder_shares(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_shares_user ON folder_shares(shared_with);

-- ═══════════════════════════════════════════════
--  TABLE 3: FILES
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(500) NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    extension VARCHAR(20) DEFAULT '',
    size BIGINT DEFAULT 0,
    storage_path TEXT NOT NULL,
    folder_id UUID DEFAULT NULL REFERENCES folders(id) ON DELETE SET NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    description TEXT DEFAULT '',
    tags TEXT[] DEFAULT '{}',
    is_starred BOOLEAN DEFAULT FALSE,
    is_trashed BOOLEAN DEFAULT FALSE,
    is_shared BOOLEAN DEFAULT FALSE,
    trashed_at TIMESTAMP DEFAULT NULL,
    download_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP DEFAULT NULL,
    version INTEGER DEFAULT 1,
    checksum VARCHAR(64) DEFAULT NULL,
    share_token VARCHAR(32) UNIQUE DEFAULT NULL,
    share_expires_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_files_trashed ON files(is_trashed);
CREATE INDEX IF NOT EXISTS idx_files_starred ON files(is_starred);
CREATE INDEX IF NOT EXISTS idx_files_shared ON files(is_shared);
CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
CREATE INDEX IF NOT EXISTS idx_files_mime ON files(mime_type);
CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_files_checksum ON files(checksum);
CREATE INDEX IF NOT EXISTS idx_files_share_token ON files(share_token);

-- Full-text search index on file name
CREATE INDEX IF NOT EXISTS idx_files_name_search ON files USING gin(to_tsvector('english', name));

-- ═══════════════════════════════════════════════
--  TABLE 4: FILE_SHARES
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS file_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES users(id),
    shared_with UUID DEFAULT NULL REFERENCES users(id),
    share_link VARCHAR(32) UNIQUE DEFAULT NULL,
    permission VARCHAR(10) DEFAULT 'view'
        CHECK (permission IN ('view', 'download', 'edit', 'admin')),
    password VARCHAR(255) DEFAULT NULL,
    expires_at TIMESTAMP DEFAULT NULL,
    access_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shares_file ON file_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_shares_with ON file_shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_shares_link ON file_shares(share_link);

-- ═══════════════════════════════════════════════
--  TABLE 5: FILE_VERSIONS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS file_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    size BIGINT DEFAULT 0,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    change_notes TEXT DEFAULT '',
    checksum VARCHAR(64) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════
--  TABLE 6: FILE_COMMENTS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS file_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    comment TEXT NOT NULL,
    parent_comment_id UUID DEFAULT NULL REFERENCES file_comments(id) ON DELETE CASCADE,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════
--  TABLE 7: TAGS & FILE_TAGS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS file_tags (
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (file_id, tag_id)
);

-- ═══════════════════════════════════════════════
--  TABLE 8: ACTIVITY_LOG
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    entity_name VARCHAR(500) DEFAULT '',
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45) DEFAULT '',
    user_agent TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);

-- ═══════════════════════════════════════════════
--  TABLE 9: STORAGE_ANALYTICS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS storage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    total_files INTEGER DEFAULT 0,
    total_size BIGINT DEFAULT 0,
    files_by_type JSONB DEFAULT '{}',
    size_by_type JSONB DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_storage_user ON storage_analytics(user_id);

-- ═══════════════════════════════════════════════
--  TABLE 10: TASKS & TASK_ATTACHMENTS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'todo', 'in_progress', 'review', 'done', 'completed', 'cancelled')),
    priority VARCHAR(10) DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID DEFAULT NULL REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    due_date TIMESTAMP DEFAULT NULL,
    completed_at TIMESTAMP DEFAULT NULL,
    labels TEXT[] DEFAULT '{}',
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);

CREATE TABLE IF NOT EXISTS task_attachments (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, file_id)
);

-- ═══════════════════════════════════════════════
--  TABLE 10B: TASK_COMMENTS
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

-- ═══════════════════════════════════════════════
--  TABLE 11: CHAT SYSTEM
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) DEFAULT NULL,
    type VARCHAR(20) DEFAULT 'general'
        CHECK (type IN ('general', 'direct', 'announcement', 'group')),
    description TEXT DEFAULT '',
    avatar VARCHAR(500) DEFAULT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    is_archived BOOLEAN DEFAULT FALSE,
    members UUID[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_participants (
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(20) DEFAULT 'member'
        CHECK (role IN ('member', 'admin', 'moderator')),
    is_muted BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'text'
        CHECK (type IN ('text', 'image', 'file', 'system', 'link')),
    file_id UUID DEFAULT NULL REFERENCES files(id),
    file_url TEXT DEFAULT NULL,
    file_name VARCHAR(500) DEFAULT NULL,
    file_size BIGINT DEFAULT NULL,
    reply_to UUID DEFAULT NULL REFERENCES messages(id),
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    read_by UUID[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

CREATE TABLE IF NOT EXISTS message_reads (
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id)
);

-- ═══════════════════════════════════════════════
--  TABLE 12: MEETINGS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    location VARCHAR(255) DEFAULT '',
    meeting_link VARCHAR(500) DEFAULT '',
    meeting_type VARCHAR(20) DEFAULT 'meeting'
        CHECK (meeting_type IN ('meeting', 'event', 'deadline', 'reminder')),
    created_by UUID NOT NULL REFERENCES users(id),
    color VARCHAR(7) DEFAULT '#6366f1',
    is_all_day BOOLEAN DEFAULT FALSE,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule TEXT DEFAULT NULL,
    attendees UUID[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'scheduled',
    minutes TEXT DEFAULT NULL,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meeting_participants (
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'tentative')),
    PRIMARY KEY (meeting_id, user_id)
);

-- ═══════════════════════════════════════════════
--  TABLE 13: ANNOUNCEMENTS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    priority VARCHAR(10) DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    category VARCHAR(50) DEFAULT 'general',
    is_pinned BOOLEAN DEFAULT FALSE,
    attachment_id UUID DEFAULT NULL REFERENCES files(id),
    target_roles TEXT[] DEFAULT '{}',
    attachments JSONB DEFAULT '[]',
    expires_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════
--  TABLE 14: COMMITTEES
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS committees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    head_id UUID DEFAULT NULL REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS committee_members (
    committee_id UUID NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (committee_id, user_id)
);

-- ═══════════════════════════════════════════════
--  TABLE 15: NOTIFICATIONS
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    message TEXT DEFAULT '',
    type VARCHAR(50) DEFAULT 'info'
        CHECK (type IN ('info', 'success', 'warning', 'error', 'mention', 'task', 'task_assigned', 'file', 'meeting', 'meeting_invite')),
    entity_type VARCHAR(50) DEFAULT NULL,
    entity_id UUID DEFAULT NULL,
    link VARCHAR(500) DEFAULT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);


-- ═══════════════════════════════════════════════
--  VIEWS
-- ═══════════════════════════════════════════════

-- View: File details with uploader and folder info
CREATE OR REPLACE VIEW file_details AS
SELECT
    f.*,
    u.name AS uploader_name,
    u.email AS uploader_email,
    u.avatar AS uploader_avatar,
    fo.name AS folder_name,
    (SELECT COUNT(*) FROM file_shares WHERE file_id = f.id AND is_active = true) AS share_count,
    (SELECT COUNT(*) FROM file_comments WHERE file_id = f.id) AS comment_count,
    (SELECT array_agg(t.name) FROM file_tags ft JOIN tags t ON ft.tag_id = t.id WHERE ft.file_id = f.id) AS tag_names
FROM files f
LEFT JOIN users u ON f.uploaded_by = u.id
LEFT JOIN folders fo ON f.folder_id = fo.id;

-- View: Folder details with creator and counts
CREATE OR REPLACE VIEW folder_details AS
SELECT
    fo.*,
    u.name AS creator_name,
    (SELECT COUNT(*) FROM files WHERE folder_id = fo.id AND is_trashed = false) AS file_count,
    (SELECT COALESCE(SUM(size), 0) FROM files WHERE folder_id = fo.id AND is_trashed = false) AS total_size,
    (SELECT COUNT(*) FROM folders WHERE parent_id = fo.id AND is_trashed = false) AS subfolder_count
FROM folders fo
LEFT JOIN users u ON fo.created_by = u.id;

-- View: User storage summary
CREATE OR REPLACE VIEW user_storage AS
SELECT
    u.id, u.name, u.email, u.storage_used, u.storage_limit,
    COUNT(f.id) AS file_count,
    COALESCE(SUM(f.size), 0) AS total_size,
    COUNT(CASE WHEN f.mime_type LIKE 'image/%' THEN 1 END) AS image_count,
    COUNT(CASE WHEN f.mime_type LIKE 'video/%' THEN 1 END) AS video_count,
    COUNT(CASE WHEN f.mime_type = 'application/pdf' THEN 1 END) AS pdf_count,
    ROUND((u.storage_used::numeric / NULLIF(u.storage_limit, 0)::numeric) * 100, 2) AS used_percent
FROM users u
LEFT JOIN files f ON u.id = f.uploaded_by AND f.is_trashed = false
GROUP BY u.id, u.name, u.email, u.storage_used, u.storage_limit;

-- View: Recent activity with user info
CREATE OR REPLACE VIEW recent_activity AS
SELECT
    al.*,
    u.name AS user_name,
    u.avatar AS user_avatar
FROM activity_log al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC;


-- ═══════════════════════════════════════════════
--  TRIGGERS & FUNCTIONS
-- ═══════════════════════════════════════════════

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'users', 'files', 'folders', 'tasks', 'messages',
        'meetings', 'announcements', 'committees', 'file_comments'
    ])
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trigger_update_%s_updated_at ON %I; '
            'CREATE TRIGGER trigger_update_%s_updated_at '
            'BEFORE UPDATE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
            tbl, tbl, tbl, tbl
        );
    END LOOP;
END;
$$;

-- Function: Update user storage on file INSERT
CREATE OR REPLACE FUNCTION update_user_storage_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users SET storage_used = storage_used + NEW.size WHERE id = NEW.uploaded_by;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_file_insert_storage ON files;
CREATE TRIGGER trigger_file_insert_storage
AFTER INSERT ON files
FOR EACH ROW EXECUTE FUNCTION update_user_storage_on_insert();

-- Function: Update user storage on file DELETE
CREATE OR REPLACE FUNCTION update_user_storage_on_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users SET storage_used = GREATEST(storage_used - OLD.size, 0) WHERE id = OLD.uploaded_by;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_file_delete_storage ON files;
CREATE TRIGGER trigger_file_delete_storage
AFTER DELETE ON files
FOR EACH ROW EXECUTE FUNCTION update_user_storage_on_delete();


-- ═══════════════════════════════════════════════
--  SEED DATA
-- ═══════════════════════════════════════════════

-- Default admin user (password: admin123 → bcrypt hash)
INSERT INTO users (email, password, name, role, department)
VALUES (
    'admin@workspace.com',
    '$2a$10$rQKl8QqK12/4EXsNuFGNSuLBGwHqMPDQ3FLoEqwSrRXvMxqZy1Yb6',
    'Admin User',
    'admin',
    'Administration'
)
ON CONFLICT (email) DO NOTHING;

-- Default chat rooms
INSERT INTO chat_rooms (name, type, description, created_by)
SELECT 'General', 'general', 'General discussion for all members', id
FROM users WHERE email = 'admin@workspace.com'
ON CONFLICT DO NOTHING;

INSERT INTO chat_rooms (name, type, description, created_by)
SELECT 'Announcements', 'announcement', 'Official announcements channel', id
FROM users WHERE email = 'admin@workspace.com'
ON CONFLICT DO NOTHING;
