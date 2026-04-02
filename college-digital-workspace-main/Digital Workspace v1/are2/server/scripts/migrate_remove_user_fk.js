// ============================================================
// migrate_remove_user_fk.js
// ============================================================
// Committee databases (workspace_dlle/gyk/nss) don't have a 
// 'users' table — users live in workspace_master only.
// This removes invalid FK constraints referencing users(id)
// from committee DB tables, and also drops FK from 
// activity_log and notifications so they work without users table.
// ============================================================
require('dotenv').config();
const { Pool } = require('pg');

const COMMITTEE_DBS = ['workspace_dlle', 'workspace_gyk', 'workspace_nss'];

async function migrate(dbName) {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5173'),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'shre1234',
        database: dbName,
    });

    console.log(`\n📦 Migrating ${dbName}...`);

    try {
        // Get all FK constraints referencing 'users' table in this DB
        const fkResult = await pool.query(`
            SELECT
                tc.constraint_name,
                tc.table_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.referential_constraints rc 
                ON tc.constraint_name = rc.constraint_name
            JOIN information_schema.table_constraints ccu
                ON rc.unique_constraint_name = ccu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND ccu.table_name = 'users'
              AND tc.table_schema = 'public'
        `);

        if (fkResult.rows.length === 0) {
            console.log(`  ✅ No user FK constraints found (already clean)`);
        } else {
            for (const row of fkResult.rows) {
                console.log(`  Dropping FK: ${row.constraint_name} on ${row.table_name}`);
                await pool.query(
                    `ALTER TABLE ${row.table_name} DROP CONSTRAINT IF EXISTS "${row.constraint_name}"`
                );
                console.log(`  ✅ Dropped`);
            }
        }

        // Verify we can now insert a test meeting
        const testRow = await pool.query(`
            INSERT INTO meetings (
                title, start_time, end_time, created_by, 
                color, attendees, status, is_all_day, is_recurring, attachments
            )
            VALUES (
                '__migration_test__',
                NOW(),
                NOW() + INTERVAL '1 hour',
                '00000000-0000-0000-0000-000000000001'::uuid,
                '#6366f1', '{}', 'scheduled', false, false, '[]'
            )
            RETURNING id
        `);
        await pool.query(`DELETE FROM meetings WHERE title='__migration_test__'`);
        console.log(`  ✅ Test INSERT/DELETE succeeded — meetings table is functional`);

    } catch (err) {
        console.error(`  ❌ Error in ${dbName}:`, err.message);
    } finally {
        await pool.end();
    }
}

(async () => {
    console.log('=== Removing invalid user FK constraints from committee DBs ===');
    for (const db of COMMITTEE_DBS) {
        await migrate(db);
    }
    console.log('\n✅ Migration complete');
})();
