-- ============================================
-- schema.sql — Master Database Schema
-- ============================================
-- Runs ONLY on workspace_master.
-- Contains: users, committees, committee_members
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════
--  USERS TABLE
-- ═══════════════════════════════════════════════
-- Firebase handles auth. This stores profile + metadata.
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar VARCHAR(500) DEFAULT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    global_role VARCHAR(20) DEFAULT 'user'
        CHECK (global_role IN ('superadmin', 'admin', 'user')),
    last_committee_slug VARCHAR(50) DEFAULT NULL,
    storage_used BIGINT DEFAULT 0,
    storage_limit BIGINT DEFAULT 1073741824,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════
--  COMMITTEES TABLE
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS committees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    logo VARCHAR(500) DEFAULT NULL,
    color VARCHAR(7) DEFAULT '#6366f1',
    icon VARCHAR(50) DEFAULT 'fa-building',
    db_name VARCHAR(100) NOT NULL,
    storage_limit BIGINT DEFAULT 5368709120,
    storage_used BIGINT DEFAULT 0,
    max_members INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════
--  COMMITTEE MEMBERS (junction table)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS committee_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    committee_id UUID NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(30) DEFAULT 'member'
        CHECK (role IN ('member', 'volunteer', 'coordinator',
                        'secretary', 'treasurer', 'head',
                        'advisor', 'admin')),
    position VARCHAR(100) DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP DEFAULT NULL,
    UNIQUE(committee_id, user_id)
);

-- ═══════════════════════════════════════════════
--  INDEXES
-- ═══════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_users_firebase ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_committees_slug ON committees(slug);
CREATE INDEX IF NOT EXISTS idx_cm_committee ON committee_members(committee_id);
CREATE INDEX IF NOT EXISTS idx_cm_user ON committee_members(user_id);
CREATE INDEX IF NOT EXISTS idx_cm_active ON committee_members(committee_id, user_id) WHERE is_active = true;

-- ═══════════════════════════════════════════════
--  SEED COMMITTEES
-- ═══════════════════════════════════════════════
INSERT INTO committees (name, full_name, slug, description, color, icon, db_name)
VALUES
    ('DLLE', 'Department of Lifelong Learning and Extension', 'dlle',
     'Extension activities and community outreach programs',
     '#3b82f6', 'fa-graduation-cap', 'workspace_dlle'),
    ('GYK', 'Gymkhana Committee', 'gyk',
     'Sports, cultural events and student activities',
     '#22c55e', 'fa-trophy', 'workspace_gyk'),
    ('NSS', 'National Service Scheme', 'nss',
     'Community service and social welfare programs',
     '#f97316', 'fa-hands-helping', 'workspace_nss')
ON CONFLICT (slug) DO NOTHING;
