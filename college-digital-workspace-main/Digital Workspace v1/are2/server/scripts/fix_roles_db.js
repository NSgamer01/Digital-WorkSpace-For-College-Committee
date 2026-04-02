const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: 'workspace_master',
});

async function fixConstraints() {
    try {
        console.log('Fixing constraints...');
        
        // Find ALL check constraints on committee_members
        const constraintQuery = `
            SELECT conname 
            FROM pg_constraint 
            WHERE conrelid = 'committee_members'::regclass 
            AND contype = 'c';
        `;
        const res = await pool.query(constraintQuery);
        
        if (res.rowCount > 0) {
            for (const row of res.rows) {
                console.log('Dropping constraint:', row.conname);
                await pool.query(`ALTER TABLE committee_members DROP CONSTRAINT IF EXISTS "${row.conname}"`);
            }
            console.log('Successfully dropped committee_members check constraints.');
        } else {
            console.log('No constraint found on committee_members.');
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

fixConstraints();
