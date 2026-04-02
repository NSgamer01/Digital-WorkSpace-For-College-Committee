// Quick migration: Add firebase_uid column to users table
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5173,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'shre1234',
    database: 'workspace_master',
});

async function migrate() {
    console.log('Adding firebase_uid column to users table...');

    // Add column if not exists
    await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128) UNIQUE
    `);

    console.log('✅ firebase_uid column added (or already exists)');

    // Create index
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_firebase_uid
        ON users (firebase_uid)
    `);

    console.log('✅ Index created on firebase_uid');

    await pool.end();
    console.log('Done!');
}

migrate().catch(e => { console.error(e); process.exit(1); });
