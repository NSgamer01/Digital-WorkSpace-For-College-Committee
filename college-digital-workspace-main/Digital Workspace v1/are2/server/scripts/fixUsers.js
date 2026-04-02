const masterDb = require('../config/masterDb');

(async () => {
    try {
        // Add missing columns to users table
        await masterDb.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS department VARCHAR(255),
            ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ
        `);
        console.log('✅ Added department, is_online, last_seen columns to users table');

        // Verify
        const r = await masterDb.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`
        );
        console.log('Users columns now:', r.rows.map(r => r.column_name).join(', '));
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
})();
