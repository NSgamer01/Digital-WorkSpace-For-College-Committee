// ============================================
// ONE-TIME SCRIPT: Make user an admin
// ============================================
// Sets global_role = 'admin' for digitalworkspace25.26.001@gmail.com
// DELETE THIS FILE AFTER RUNNING
// ============================================

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
        console.log(`\n🔍 Searching for user: ${email}`);

        // Check if user exists
        const findResult = await pool.query(
            'SELECT id, email, name, global_role FROM users WHERE email = $1',
            [email]
        );

        if (findResult.rows.length === 0) {
            console.log('❌ User NOT found in database.');
            console.log('   The user may not have registered yet.');
            console.log('   Please log in to the app first, then run this script again.');
            return;
        }

        const user = findResult.rows[0];
        console.log(`✅ Found user: ${user.name} (ID: ${user.id})`);
        console.log(`   Current global_role: "${user.global_role}"`);

        if (user.global_role === 'admin') {
            console.log('ℹ️  User is already an admin. No changes needed.');
            return;
        }

        // Update to admin
        await pool.query(
            "UPDATE users SET global_role = 'admin', updated_at = NOW() WHERE email = $1",
            [email]
        );

        // Verify the update
        const verifyResult = await pool.query(
            'SELECT id, email, name, global_role FROM users WHERE email = $1',
            [email]
        );

        console.log(`\n✅ SUCCESS! Role updated to: "${verifyResult.rows[0].global_role}"`);
        console.log('\n📋 Next steps:');
        console.log('   1. Make sure the backend server is running: cd server && node server.js');
        console.log('   2. Refresh the app (Ctrl + Shift + R)');
        console.log('   3. Navigate to /admin — should now work!');
        console.log('   4. DELETE this script file when done.');
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.message.includes('ECONNREFUSED')) {
            console.log('   PostgreSQL is not running. Start it first.');
        }
    } finally {
        await pool.end();
    }
}

makeAdmin();
