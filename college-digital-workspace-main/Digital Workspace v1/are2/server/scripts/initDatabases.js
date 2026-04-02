// ============================================
// scripts/initDatabases.js
// ============================================
// Run once with: node scripts/initDatabases.js
//
// Creates 4 PostgreSQL databases + all tables + seeds + upload dirs
// ============================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client, Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// ── Configuration ───────────────────────────────
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
};

const DATABASES = ['workspace_master', 'workspace_dlle', 'workspace_gyk', 'workspace_nss'];

const COMMITTEES = [
    {
        name: 'DLLE',
        full_name: 'Department of Lifelong Learning and Extension',
        slug: 'dlle',
        description: 'DLLE committee manages extension activities and lifelong learning programs.',
        color: '#3b82f6',
        icon: 'fa-graduation-cap',
        db_name: 'workspace_dlle',
    },
    {
        name: 'GYK',
        full_name: 'Gymkhana',
        slug: 'gyk',
        description: 'GYK committee manages sports, cultural events, and extracurricular activities.',
        color: '#22c55e',
        icon: 'fa-trophy',
        db_name: 'workspace_gyk',
    },
    {
        name: 'NSS',
        full_name: 'National Service Scheme',
        slug: 'nss',
        description: 'NSS committee organizes community service and social development programs.',
        color: '#f97316',
        icon: 'fa-hands-helping',
        db_name: 'workspace_nss',
    },
];

const UPLOAD_BASE = path.resolve(__dirname, '..', '..', 'workspace Drive', 'Uploads');
const UPLOAD_SUBDIRS = ['drive', 'chat', 'tasks', 'avatars'];

// ── Helpers ─────────────────────────────────────
function log(emoji, message) {
    console.log(`  ${emoji}  ${message}`);
}

async function createDatabase(dbName) {
    const client = new Client({ ...DB_CONFIG, database: 'postgres' });
    try {
        await client.connect();
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
        if (res.rowCount === 0) {
            await client.query(`CREATE DATABASE "${dbName}"`);
            log('✅', `Created database: ${dbName}`);
        } else {
            log('ℹ️', `Database already exists: ${dbName}`);
        }
    } catch (err) {
        log('❌', `Failed to create database ${dbName}: ${err.message}`);
        throw err;
    } finally {
        await client.end();
    }
}

async function getPoolForDb(dbName) {
    const pool = new Pool({ ...DB_CONFIG, database: dbName, max: 5 });
    return pool;
}

// ── Master DB Schema ────────────────────────────
async function createMasterSchema() {
    const pool = await getPoolForDb('workspace_master');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Enable uuid-ossp extension
        await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        log('✅', 'Enabled uuid-ossp extension in workspace_master');

        // Users table
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar TEXT,
        phone VARCHAR(20),
        global_role VARCHAR(20) NOT NULL DEFAULT 'user'
          CHECK (global_role IN ('superadmin', 'admin', 'user')),
        last_committee_slug VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        log('✅', 'Created table: users');

        // Committees table
        await client.query(`
      CREATE TABLE IF NOT EXISTS committees (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        full_name VARCHAR(255),
        slug VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        logo TEXT,
        color VARCHAR(20) DEFAULT '#3b82f6',
        icon VARCHAR(50) DEFAULT 'fa-building',
        db_name VARCHAR(100) NOT NULL,
        storage_limit BIGINT DEFAULT 5368709120,
        storage_used BIGINT DEFAULT 0,
        max_members INTEGER DEFAULT 100,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
        log('✅', 'Created table: committees');

        // Committee Members table
        await client.query(`
      CREATE TABLE IF NOT EXISTS committee_members (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        committee_id UUID NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'member'
          CHECK (role IN ('member', 'volunteer', 'coordinator', 'secretary', 'treasurer', 'head', 'advisor', 'admin')),
        position VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        left_at TIMESTAMPTZ,
        UNIQUE(committee_id, user_id)
      )
    `);
        log('✅', 'Created table: committee_members');

        // Indexes
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_committees_slug ON committees(slug)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_committee_members_committee_id ON committee_members(committee_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_committee_members_user_id ON committee_members(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_committee_members_active ON committee_members(committee_id, user_id) WHERE is_active = true`);
        log('✅', 'Created indexes on master tables');

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        log('❌', `Failed to create master schema: ${err.message}`);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

// ── Seed Committees ─────────────────────────────
async function seedCommittees() {
    const pool = await getPoolForDb('workspace_master');

    try {
        for (const committee of COMMITTEES) {
            const res = await pool.query(
                `INSERT INTO committees (name, full_name, slug, description, color, icon, db_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           full_name = EXCLUDED.full_name,
           description = EXCLUDED.description,
           color = EXCLUDED.color,
           icon = EXCLUDED.icon,
           db_name = EXCLUDED.db_name
         RETURNING id, slug`,
                [committee.name, committee.full_name, committee.slug, committee.description, committee.color, committee.icon, committee.db_name]
            );
            log('✅', `Seeded committee: ${committee.name} (${res.rows[0].slug})`);
        }
    } catch (err) {
        log('❌', `Failed to seed committees: ${err.message}`);
        throw err;
    } finally {
        await pool.end();
    }
}

// ── Committee DB Schema ─────────────────────────
async function createCommitteeSchema(dbName, committeeName) {
    const pool = await getPoolForDb(dbName);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Enable uuid-ossp extension
        await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        // Folders table
        await client.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
        created_by UUID,
        color VARCHAR(20),
        is_trashed BOOLEAN DEFAULT false,
        trashed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        // Files table
        await client.query(`
      CREATE TABLE IF NOT EXISTS files (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255),
        mime_type VARCHAR(100),
        size BIGINT DEFAULT 0,
        storage_path TEXT,
        folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
        uploaded_by UUID,
        description TEXT,
        tags TEXT[] DEFAULT '{}',
        version INTEGER DEFAULT 1,
        is_shared BOOLEAN DEFAULT false,
        shared_with UUID[] DEFAULT '{}',
        share_link TEXT,
        is_trashed BOOLEAN DEFAULT false,
        trashed_at TIMESTAMPTZ,
        is_starred BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        // Tasks table
        await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'todo'
          CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'cancelled')),
        priority VARCHAR(10) DEFAULT 'medium'
          CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        created_by UUID,
        assigned_to UUID,
        due_date TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        attachments JSONB DEFAULT '[]',
        labels TEXT[] DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        // Chat rooms table
        await client.query(`
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(20) DEFAULT 'general'
          CHECK (type IN ('general', 'group', 'direct', 'announcement')),
        created_by UUID,
        members UUID[] DEFAULT '{}',
        is_archived BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        // Messages table
        await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
        sender_id UUID,
        content TEXT,
        type VARCHAR(10) DEFAULT 'text'
          CHECK (type IN ('text', 'file', 'image', 'system')),
        file_url TEXT,
        file_name VARCHAR(255),
        file_size BIGINT,
        reply_to UUID REFERENCES messages(id),
        reactions JSONB DEFAULT '{}',
        read_by UUID[] DEFAULT '{}',
        is_edited BOOLEAN DEFAULT false,
        is_deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        // Meetings table
        await client.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        is_all_day BOOLEAN DEFAULT false,
        location VARCHAR(255),
        meeting_link TEXT,
        created_by UUID,
        attendees UUID[] DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'scheduled'
          CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
        is_recurring BOOLEAN DEFAULT false,
        recurrence_rule TEXT,
        minutes TEXT,
        attachments JSONB DEFAULT '[]',
        color VARCHAR(20),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        // Announcements table
        await client.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_by UUID,
        priority VARCHAR(10) DEFAULT 'normal'
          CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        is_pinned BOOLEAN DEFAULT false,
        target_roles TEXT[] DEFAULT '{}',
        attachments JSONB DEFAULT '[]',
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        // Activity log table
        await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id UUID,
        details JSONB DEFAULT '{}',
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        // Notifications table
        await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID,
        type VARCHAR(50),
        title VARCHAR(255),
        message TEXT,
        link TEXT,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        // ── Indexes ───────────────────────────────
        await client.query(`CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_folders_created_by ON folders(created_by)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_folders_trashed ON folders(is_trashed)`);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_files_trashed ON files(is_trashed)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_files_starred ON files(is_starred)`);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)`);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)`);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON meetings(start_time)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status)`);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON announcements(created_by)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(is_pinned)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_announcements_expires ON announcements(expires_at)`);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at)`);

        await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)`);

        // ── Default General chat room ─────────────
        const existing = await client.query(`SELECT id FROM chat_rooms WHERE name = 'General' AND type = 'general'`);
        if (existing.rowCount === 0) {
            await client.query(`
        INSERT INTO chat_rooms (name, description, type)
        VALUES ('General', 'General discussion for all members', 'general')
      `);
            log('✅', `  Created default "General" chat room`);
        } else {
            log('ℹ️', `  "General" chat room already exists`);
        }

        await client.query('COMMIT');
        log('✅', `Created all tables and indexes in ${dbName} (${committeeName})`);
    } catch (err) {
        await client.query('ROLLBACK');
        log('❌', `Failed to create schema for ${dbName}: ${err.message}`);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

// ── Upload Directories ──────────────────────────
function createUploadDirs() {
    const committees = ['DLLE', 'GYK', 'NSS'];
    for (const committee of committees) {
        for (const sub of UPLOAD_SUBDIRS) {
            const dirPath = path.join(UPLOAD_BASE, committee, sub);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                log('📁', `Created directory: ${dirPath}`);
            } else {
                log('ℹ️', `Directory exists: ${dirPath}`);
            }
        }
    }
}

// ── Main ────────────────────────────────────────
async function main() {
    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log('  🏗️   Multi-Committee Database Initialization');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    try {
        // Step 1: Create databases
        console.log('── Step 1: Creating Databases ──────────────────');
        for (const db of DATABASES) {
            await createDatabase(db);
        }
        console.log('');

        // Step 2: Create master schema
        console.log('── Step 2: Master DB Schema ────────────────────');
        await createMasterSchema();
        console.log('');

        // Step 3: Seed committees
        console.log('── Step 3: Seeding Committees ──────────────────');
        await seedCommittees();
        console.log('');

        // Step 4: Create committee schemas
        console.log('── Step 4: Committee DB Schemas ────────────────');
        const committeeDbPairs = [
            { db: 'workspace_dlle', name: 'DLLE' },
            { db: 'workspace_gyk', name: 'GYK' },
            { db: 'workspace_nss', name: 'NSS' },
        ];
        for (const pair of committeeDbPairs) {
            await createCommitteeSchema(pair.db, pair.name);
        }
        console.log('');

        // Step 5: Create upload directories
        console.log('── Step 5: Upload Directories ──────────────────');
        createUploadDirs();
        console.log('');

        console.log('══════════════════════════════════════════════════');
        log('🎉', 'All databases initialized successfully!');
        console.log('══════════════════════════════════════════════════');
        console.log('');
        console.log('  Databases created:');
        for (const db of DATABASES) {
            console.log(`    ✅ ${db}`);
        }
        console.log('');
        console.log('  Committees seeded:');
        for (const c of COMMITTEES) {
            console.log(`    ✅ ${c.name} → ${c.db_name}`);
        }
        console.log('');

    } catch (err) {
        console.error('');
        log('💥', `Initialization failed: ${err.message}`);
        console.error(err);
        process.exit(1);
    }

    process.exit(0);
}

main();
