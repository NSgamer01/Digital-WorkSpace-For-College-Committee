// Fix: Make password_hash nullable for Firebase Auth users
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const masterDb = require('../config/masterDb');

async function fix() {
    try {
        console.log('Making password_hash nullable in workspace_master.users...');
        await masterDb.query('ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL');
        console.log('Done! password_hash is now nullable.');

        // Also set a default for password_hash so old inserts don't break
        await masterDb.query("ALTER TABLE users ALTER COLUMN password_hash SET DEFAULT NULL");
        console.log('Default set to NULL.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit(0);
    }
}

fix();
