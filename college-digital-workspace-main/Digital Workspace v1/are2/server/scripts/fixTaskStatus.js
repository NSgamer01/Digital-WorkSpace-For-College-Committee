const committeeDbManager = require('../config/committeeDbManager');

// Fix task status constraint for all committee databases
const slugs = ['dlle', 'gyk', 'nss'];

(async () => {
    for (const slug of slugs) {
        try {
            const db = committeeDbManager.getPool(slug);

            // Drop old constraint
            await db.query(`ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check`);

            // Add new constraint that accepts both frontend and backend values
            await db.query(`
                ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
                CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'cancelled', 'pending', 'completed', 'inprogress'))
            `);

            console.log(`✅ [${slug}] Updated tasks_status_check constraint`);

            // Verify
            const r = await db.query(`
                SELECT conname, pg_get_constraintdef(oid) as definition
                FROM pg_constraint 
                WHERE conrelid = 'tasks'::regclass AND contype = 'c'
            `);
            r.rows.forEach(row => {
                console.log(`   ${row.conname}: ${row.definition}`);
            });
        } catch (e) {
            console.error(`❌ [${slug}] Error:`, e.message);
        }
    }
    process.exit();
})();
