// ============================================
// config/masterDb.js — Master Database Pool
// ============================================
// PostgreSQL connection pool for workspace_master database.
// This pool handles all user authentication, committee registry,
// and membership queries.
// ============================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');

const masterPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: 'workspace_master',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

masterPool.on('connect', () => {
    console.log('  🟢 Master DB: client connected to workspace_master');
});

masterPool.on('error', (err) => {
    console.error('  ❌ Master DB: unexpected error on idle client —', err.message);
});

module.exports = masterPool;
