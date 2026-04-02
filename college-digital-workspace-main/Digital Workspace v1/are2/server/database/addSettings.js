// ============================================
// database/addSettings.js — Migration: user_settings table
// ============================================
// Creates the user_settings table in workspace_master.
// Safe to run multiple times (idempotent).
// Usage: node database/addSettings.js
// ============================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const masterDb = require('../config/masterDb');

const UP_SQL = `
-- Enable uuid-ossp if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Profile (extends users table)
    bio TEXT DEFAULT '',
    cover_photo VARCHAR(500) DEFAULT NULL,
    location VARCHAR(100) DEFAULT NULL,
    social_linkedin VARCHAR(255) DEFAULT NULL,
    social_github VARCHAR(255) DEFAULT NULL,
    social_twitter VARCHAR(255) DEFAULT NULL,

    -- Notification Preferences
    notif_browser BOOLEAN DEFAULT TRUE,
    notif_email BOOLEAN DEFAULT TRUE,
    notif_task_assigned BOOLEAN DEFAULT TRUE,
    notif_task_updated BOOLEAN DEFAULT TRUE,
    notif_event_invitation BOOLEAN DEFAULT TRUE,
    notif_message_mention BOOLEAN DEFAULT TRUE,
    notif_announcement BOOLEAN DEFAULT TRUE,
    notif_deadline_reminder BOOLEAN DEFAULT TRUE,
    notif_digest_email VARCHAR(10) DEFAULT 'daily'
        CHECK (notif_digest_email IN ('off', 'daily', 'weekly')),
    notif_reminder_minutes INTEGER[] DEFAULT '{15, 60}',

    -- Calendar Preferences
    cal_default_view VARCHAR(10) DEFAULT 'month'
        CHECK (cal_default_view IN ('month', 'week', 'day', 'agenda')),
    cal_working_hours_start VARCHAR(5) DEFAULT '09:00',
    cal_working_hours_end VARCHAR(5) DEFAULT '17:00',
    cal_week_starts_on INTEGER DEFAULT 1
        CHECK (cal_week_starts_on BETWEEN 0 AND 6),
    cal_google_connected BOOLEAN DEFAULT FALSE,
    cal_sync_enabled BOOLEAN DEFAULT FALSE,

    -- Privacy
    privacy_show_online BOOLEAN DEFAULT TRUE,
    privacy_show_last_seen BOOLEAN DEFAULT TRUE,
    privacy_show_email BOOLEAN DEFAULT FALSE,
    privacy_show_phone BOOLEAN DEFAULT FALSE,
    privacy_profile_visibility VARCHAR(10) DEFAULT 'committee'
        CHECK (privacy_profile_visibility IN ('public', 'committee', 'private')),
    privacy_allow_dms BOOLEAN DEFAULT TRUE,

    -- Appearance
    theme VARCHAR(20) DEFAULT 'dark'
        CHECK (theme IN ('light', 'dark', 'purple', 'ocean', 'auto')),
    accent_color VARCHAR(7) DEFAULT '#6366f1',
    compact_mode BOOLEAN DEFAULT FALSE,
    font_size VARCHAR(10) DEFAULT 'medium'
        CHECK (font_size IN ('small', 'medium', 'large')),

    -- Accessibility
    reduce_motion BOOLEAN DEFAULT FALSE,
    high_contrast BOOLEAN DEFAULT FALSE,
    screen_reader_mode BOOLEAN DEFAULT FALSE,

    -- Storage preferences
    auto_delete_trash_days INTEGER DEFAULT 30,
    download_quality VARCHAR(15) DEFAULT 'original'
        CHECK (download_quality IN ('original', 'compressed')),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);
`;

async function migrate() {
    console.log('🔄  Running migration: user_settings table...');
    try {
        await masterDb.query(UP_SQL);
        console.log('✅  user_settings table created (or already exists) in workspace_master');
    } catch (err) {
        console.error('❌  Migration failed:', err.message);
        process.exit(1);
    } finally {
        await masterDb.end();
        console.log('🔌  Database connection closed.');
    }
}

migrate();
