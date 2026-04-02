const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: 'workspace_master',
});

async function runTest() {
    try {
        const userRes = await pool.query('SELECT id FROM users LIMIT 1');
        const userId = userRes.rows[0].id;
        
        // Create dummy committee
        const commRes = await pool.query(`INSERT INTO committees (name, slug, db_name) VALUES ('Test Insert Comm', 'test-ins', 'workspace_dlle') RETURNING id`);
        const committeeId = commRes.rows[0].id;
        
        try {
            console.log('Testing INSERT...');
            const insertRes = await pool.query(
                `INSERT INTO committee_members (committee_id, user_id, role, is_active)
                 VALUES ($1, $2, $3, true) RETURNING *`,
                [committeeId, userId, 'faculty']
            );
            console.log('Insert SUCCESS:', insertRes.rows);
        } catch (insertErr) {
            console.error('\nINSERT FAILED!', insertErr.message);
        }
        
        // Cleanup dummy committee (cascades to members)
        await pool.query('DELETE FROM committees WHERE id=$1', [committeeId]);
        
    } catch (err) {
        console.error('TEST ERROR:', err.message);
    } finally {
        await pool.end();
    }
}

runTest();
