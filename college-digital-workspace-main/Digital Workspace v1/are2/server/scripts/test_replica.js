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
        console.log('Fetching test subject...');
        // get any user and committee
        const userRes = await pool.query('SELECT id, name FROM users LIMIT 1');
        const commRes = await pool.query('SELECT id, name FROM committees LIMIT 1');
        
        if (!userRes.rowCount || !commRes.rowCount) return console.log('not enough data');
        
        const userId = userRes.rows[0].id;
        const committeeId = commRes.rows[0].id;
        const role = 'faculty';
        
        console.log(`Trying to assign ${role} to user ${userRes.rows[0].name} for committee ${commRes.rows[0].name}`);
        
        // Exact logic from admin.js
        const existing = await pool.query(
            'SELECT 1 FROM committee_members WHERE user_id = $1 AND committee_id = $2',
            [userId, committeeId]
        );

        if (existing.rowCount > 0) {
            console.log('User already in committee, UPDATING...');
            const updateRes = await pool.query(
                `UPDATE committee_members SET role = $1, is_active = true
                 WHERE user_id = $2 AND committee_id = $3 RETURNING *`,
                [role, userId, committeeId]
            );
            console.log('Update result:', updateRes.rows);
        } else {
            console.log('User NOT in committee, INSERTING...');
            const insertRes = await pool.query(
                `INSERT INTO committee_members (committee_id, user_id, role, is_active)
                 VALUES ($1, $2, $3, true) RETURNING *`,
                [committeeId, userId, role]
            );
            console.log('Insert result:', insertRes.rows);
        }
        
    } catch (err) {
        console.error('API REPLICA ERROR:', err);
    } finally {
        await pool.end();
    }
}

runTest();
