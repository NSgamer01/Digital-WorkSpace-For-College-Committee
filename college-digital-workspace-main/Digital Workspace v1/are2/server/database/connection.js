// ============================================
// database/connection.js — PostgreSQL Pool
// ============================================
// Creates and exports a shared connection pool.
// Automatically tests the connection on import.
// ============================================

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'college_workspace',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'workspace123',
    max: 20,                        // max connections in pool
    idleTimeoutMillis: 30000,       // close idle clients after 30s
    connectionTimeoutMillis: 5000,  // fail if no connection in 5s
});

// Log pool errors (don't crash the server)
pool.on('error', (err) => {
    console.error('❌ Unexpected PostgreSQL pool error:', err.message);
});

// Test connection on import
pool.query('SELECT NOW()')
    .then((res) => {
        console.log(`✅ PostgreSQL connected — ${process.env.DB_NAME} @ ${process.env.DB_HOST}:${process.env.DB_PORT}`);
        console.log(`   Server time: ${res.rows[0].now}`);
    })
    .catch((err) => {
        console.error('❌ PostgreSQL connection failed:', err.message);
        console.error('   💡 Check your .env file: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
    });

module.exports = pool;
