const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: 'workspace_master',
});

async function testInsert() {
    try {
        console.log('Testing insert...');
        
        // Find existing user and committee
        const userReq = await pool.query('SELECT id FROM users LIMIT 1');
        const commReq = await pool.query('SELECT id FROM committees LIMIT 1');
        
        if (userReq.rowCount > 0 && commReq.rowCount > 0) {
            const userId = userReq.rows[0].id;
            const commId = commReq.rows[0].id;
            console.log(`Testing with user ${userId} and committee ${commId}`);
            
            try {
                await pool.query(
                    `INSERT INTO committee_members (committee_id, user_id, role, is_active)
                     VALUES ($1, $2, $3, true)`,
                    [commId, userId, 'faculty']
                );
                console.log('Insert SUCCESS!');
                
                // cleanup
                await pool.query('DELETE FROM committee_members WHERE user_id=$1 AND committee_id=$2 AND role=$3', [userId, commId, 'faculty']);
                
            } catch (insertErr) {
                console.error('\nINSERT ERROR:', insertErr.message);
                console.error('Code:', insertErr.code);
                console.error('Detail:', insertErr.detail);
                console.error('Constraint:', insertErr.constraint);
            }
        }
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

testInsert();
