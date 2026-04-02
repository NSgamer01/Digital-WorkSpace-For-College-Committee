// ============================================
// database/migrate.js — SQLite to PostgreSQL Migration
// ============================================
// Migrates existing data from database.sqlite to PostgreSQL.
// All data goes to workspace_dlle by default.
//
// Usage: npm run db:migrate
// ============================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');
const { Client } = require('pg');

const SQLITE_PATH = path.join(__dirname, '..', 'database.sqlite');
const TARGET_DB = 'workspace_dlle'; // Default committee for migrated data

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT) || 5432;
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

async function main() {
    console.log('');
    console.log('══════════════════════════════════════════════════════');
    console.log('  📦  SQLite → PostgreSQL Migration');
    console.log('══════════════════════════════════════════════════════');
    console.log('');

    // Check if SQLite database exists
    if (!fs.existsSync(SQLITE_PATH)) {
        console.log('  ⏭️  No SQLite database found at:', SQLITE_PATH);
        console.log('     Skipping migration. Nothing to do.');
        console.log('');
        process.exit(0);
    }

    // Try to load better-sqlite3
    let Database;
    try {
        Database = require('better-sqlite3');
    } catch (err) {
        console.error('  ❌  better-sqlite3 is required for migration.');
        console.error('     Install it: npm install better-sqlite3 --save-dev');
        console.error('');
        process.exit(1);
    }

    const sqliteDb = new Database(SQLITE_PATH, { readonly: true });
    console.log(`  📂 SQLite database: ${SQLITE_PATH}`);
    console.log(`  🎯 Target PostgreSQL database: ${TARGET_DB}`);
    console.log('');

    // Connect to PostgreSQL
    const pgClient = new Client({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: TARGET_DB,
    });

    try {
        await pgClient.connect();
        console.log(`  ✅  Connected to PostgreSQL (${TARGET_DB})`);
        console.log('');

        // Get list of tables from SQLite
        const tables = sqliteDb
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            .all()
            .map((t) => t.name);

        console.log(`  📋 Found tables in SQLite: ${tables.join(', ') || 'none'}`);
        console.log('');

        // Migrate each table
        for (const tableName of tables) {
            try {
                // Check if table exists in PostgreSQL
                const pgTableCheck = await pgClient.query(
                    "SELECT 1 FROM information_schema.tables WHERE table_name = $1",
                    [tableName]
                );

                if (pgTableCheck.rows.length === 0) {
                    console.log(`  ⏭️  Table "${tableName}" does not exist in PostgreSQL, skipping`);
                    continue;
                }

                const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all();
                if (rows.length === 0) {
                    console.log(`  ⏭️  Table "${tableName}" is empty, skipping`);
                    continue;
                }

                let migratedCount = 0;
                const columns = Object.keys(rows[0]);

                for (const row of rows) {
                    const values = columns.map((col) => row[col]);
                    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
                    const colNames = columns.map((c) => `"${c}"`).join(', ');

                    try {
                        await pgClient.query(
                            `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                            values
                        );
                        migratedCount++;
                    } catch (insertErr) {
                        // Skip rows that fail (type mismatches, etc.)
                        console.log(`    ⚠️  Skipped row in "${tableName}": ${insertErr.message}`);
                    }
                }

                console.log(`  ✅  Migrated ${migratedCount}/${rows.length} rows from "${tableName}"`);
            } catch (tableErr) {
                console.error(`  ❌  Error migrating "${tableName}": ${tableErr.message}`);
            }
        }

        console.log('');
        console.log('══════════════════════════════════════════════════════');
        console.log('  ✅  Migration complete!');
        console.log('══════════════════════════════════════════════════════');
        console.log('');
        console.log('  You can now safely delete the SQLite files:');
        console.log('    del database.sqlite');
        console.log('    del database.sqlite-shm');
        console.log('    del database.sqlite-wal');
        console.log('');
    } catch (err) {
        console.error('  ❌  Migration failed:', err.message);
        process.exit(1);
    } finally {
        sqliteDb.close();
        await pgClient.end();
    }

    process.exit(0);
}

main();
