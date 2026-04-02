// ============================================
// database/init.js — Database Initialization
// ============================================
// Creates all 4 PostgreSQL databases and runs schemas.
//
// Usage: npm run db:init
// ============================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT) || 5432;
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

const DATABASES = [
    { name: 'workspace_master', schemaFile: 'schema.sql' },
    { name: 'workspace_dlle', schemaFile: 'committeeSchema.sql' },
    { name: 'workspace_gyk', schemaFile: 'committeeSchema.sql' },
    { name: 'workspace_nss', schemaFile: 'committeeSchema.sql' },
];

const UPLOAD_DIRS = [
    'uploads/DLLE/drive',
    'uploads/DLLE/chat',
    'uploads/DLLE/tasks',
    'uploads/DLLE/avatars',
    'uploads/GYK/drive',
    'uploads/GYK/chat',
    'uploads/GYK/tasks',
    'uploads/GYK/avatars',
    'uploads/NSS/drive',
    'uploads/NSS/chat',
    'uploads/NSS/tasks',
    'uploads/NSS/avatars',
];

async function createDatabase(dbName) {
    const client = new Client({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: 'postgres', // Connect to default database to create others
    });

    try {
        await client.connect();

        // Check if database already exists
        const result = await client.query(
            'SELECT 1 FROM pg_database WHERE datname = $1',
            [dbName]
        );

        if (result.rows.length > 0) {
            console.log(`  ⏭️  Database "${dbName}" already exists`);
            return false; // Already exists
        }

        await client.query(`CREATE DATABASE ${dbName}`);
        console.log(`  ✅  Created database "${dbName}"`);
        return true;
    } catch (err) {
        if (err.code === '42P04') {
            // Database already exists
            console.log(`  ⏭️  Database "${dbName}" already exists`);
            return false;
        }
        console.error(`  ❌  Failed to create database "${dbName}":`, err.message);
        throw err;
    } finally {
        await client.end();
    }
}

async function runSchema(dbName, schemaFile) {
    const client = new Client({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: dbName,
    });

    try {
        await client.connect();

        const schemaPath = path.join(__dirname, schemaFile);
        const sql = fs.readFileSync(schemaPath, 'utf8');

        await client.query(sql);
        console.log(`  ✅  Schema applied to "${dbName}" (${schemaFile})`);
    } catch (err) {
        console.error(`  ❌  Failed to apply schema to "${dbName}":`, err.message);
        throw err;
    } finally {
        await client.end();
    }
}

function createUploadDirs() {
    const baseDir = path.join(__dirname, '..');

    for (const dir of UPLOAD_DIRS) {
        const fullPath = path.join(baseDir, dir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            console.log(`  ✅  Created directory: ${dir}`);
        } else {
            console.log(`  ⏭️  Directory exists: ${dir}`);
        }
    }
}

async function main() {
    console.log('');
    console.log('══════════════════════════════════════════════════════');
    console.log('  🗄️   PostgreSQL Multi-Committee Database Init');
    console.log('══════════════════════════════════════════════════════');
    console.log('');
    console.log(`  Host: ${DB_HOST}:${DB_PORT}`);
    console.log(`  User: ${DB_USER}`);
    console.log('');

    // Step 1: Create all databases
    console.log('── Step 1: Creating databases ────────────────────────');
    for (const db of DATABASES) {
        await createDatabase(db.name);
    }
    console.log('');

    // Step 2: Apply schemas
    console.log('── Step 2: Applying schemas ──────────────────────────');
    for (const db of DATABASES) {
        await runSchema(db.name, db.schemaFile);
    }
    console.log('');

    // Step 3: Create upload directories
    console.log('── Step 3: Creating upload directories ───────────────');
    createUploadDirs();
    console.log('');

    console.log('══════════════════════════════════════════════════════');
    console.log('  ✅  All databases and directories initialized!');
    console.log('══════════════════════════════════════════════════════');
    console.log('');
    console.log('  Databases:');
    for (const db of DATABASES) {
        console.log(`    🗄️  ${db.name}`);
    }
    console.log('');
    console.log('  Next steps:');
    console.log('    1. npm run dev              → Start the server');
    console.log('    2. npm run db:migrate       → Migrate SQLite data (optional)');
    console.log('');

    process.exit(0);
}

main().catch((err) => {
    console.error('');
    console.error('❌ Initialization failed:', err.message);
    console.error('');
    process.exit(1);
});
