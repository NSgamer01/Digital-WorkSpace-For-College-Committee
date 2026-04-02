// ============================================
// database/init.js — Initialize Database
// ============================================
// Reads schema.sql and executes it against
// the PostgreSQL database to create all tables,
// indexes, views, triggers, and seed data.
//
// Run with: node database/init.js
// ============================================

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'college_workspace',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'workspace123',
});

async function initializeDatabase() {
    const client = await pool.connect();

    try {
        console.log('');
        console.log('══════════════════════════════════════════');
        console.log('  🗄️  College Workspace — Database Init');
        console.log('══════════════════════════════════════════');
        console.log('');

        // Read schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');

        console.log('📄 Reading schema.sql...');
        console.log('📦 Executing SQL...');

        // Execute entire schema in a transaction
        await client.query('BEGIN');
        await client.query(schema);
        await client.query('COMMIT');

        console.log('');
        console.log('✅ Database initialized successfully!');
        console.log('');
        console.log('   Tables created:');
        console.log('   • users, folders, files');
        console.log('   • file_shares, file_versions, file_comments');
        console.log('   • tags, file_tags');
        console.log('   • activity_log, storage_analytics');
        console.log('   • tasks, task_attachments');
        console.log('   • chat_rooms, chat_participants, messages, message_reads');
        console.log('   • meetings, meeting_participants');
        console.log('   • announcements, committees, committee_members');
        console.log('   • notifications');
        console.log('');
        console.log('   Views: file_details, folder_details, user_storage, recent_activity');
        console.log('   Triggers: updated_at auto-update, storage tracking');
        console.log('   Seed data: admin user + default chat rooms');
        console.log('');

        // Create uploads directory
        const uploadsDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || './uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            console.log(`📁 Created uploads directory: ${uploadsDir}`);
        }

        console.log('══════════════════════════════════════════');
        console.log('  🎉  Ready! Start the server with:');
        console.log('       npm run dev');
        console.log('══════════════════════════════════════════');
        console.log('');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('');
        console.error('❌ Database initialization failed:');
        console.error('   ', error.message);
        console.error('');
        console.error('💡 Common fixes:');
        console.error('   1. Make sure PostgreSQL is running');
        console.error('   2. Create the database: CREATE DATABASE college_workspace;');
        console.error('   3. Check credentials in server/.env');
        console.error('');
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

initializeDatabase();
