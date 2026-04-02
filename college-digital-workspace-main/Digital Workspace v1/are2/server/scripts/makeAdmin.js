const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: 'workspace_master',
});

async function makeAdmin() {
    const email = 'digitalworkspace25.26.001@gmail.com';
    try {
        const result = await pool.query(
            "UPDATE users SET global_role = 'admin', updated_at = NOW() WHERE email = $1 RETURNING id, email, name, global_role",
            [email]
        );
        if (result.rowCount === 0) {
            console.log('No user found with email:', email);
        } else {
            console.log('Updated to admin:', result.rows[0]);
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

makeAdmin();
