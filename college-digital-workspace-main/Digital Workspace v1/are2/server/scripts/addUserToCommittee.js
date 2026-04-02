// Quick script to list users & committees, then add user to committees
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const masterDb = require('../config/masterDb');

async function run() {
    try {
        // List users
        console.log('\n== USERS ==');
        const users = await masterDb.query('SELECT id, name, email, firebase_uid FROM users ORDER BY created_at DESC LIMIT 10');
        users.rows.forEach(u => console.log(`  ${u.id} | ${u.name} | ${u.email} | fb: ${u.firebase_uid || 'none'}`));
        if (users.rowCount === 0) console.log('  (no users found)');

        // List committees
        console.log('\n== COMMITTEES ==');
        const committees = await masterDb.query('SELECT id, name, slug FROM committees WHERE is_active = true');
        committees.rows.forEach(c => console.log(`  ${c.id} | ${c.name} | slug: ${c.slug}`));
        if (committees.rowCount === 0) console.log('  (no committees found)');

        // List existing memberships
        console.log('\n== EXISTING MEMBERSHIPS ==');
        const memberships = await masterDb.query(`
            SELECT cm.role, u.name, u.email, c.slug 
            FROM committee_members cm 
            JOIN users u ON u.id = cm.user_id 
            JOIN committees c ON c.id = cm.committee_id
            WHERE cm.is_active = true
        `);
        memberships.rows.forEach(m => console.log(`  ${m.name} (${m.email}) -> ${m.slug} as ${m.role}`));
        if (memberships.rowCount === 0) console.log('  (none)');

        // AUTO-ADD: Add ALL users to ALL committees as 'head' role
        if (users.rows.length > 0 && committees.rows.length > 0) {
            console.log('\n== ADDING USERS TO COMMITTEES ==');
            for (const user of users.rows) {
                for (const committee of committees.rows) {
                    const exists = await masterDb.query(
                        'SELECT 1 FROM committee_members WHERE committee_id = $1 AND user_id = $2',
                        [committee.id, user.id]
                    );
                    if (exists.rowCount === 0) {
                        await masterDb.query(
                            'INSERT INTO committee_members (committee_id, user_id, role, is_active) VALUES ($1, $2, $3, true)',
                            [committee.id, user.id, 'head']
                        );
                        console.log(`  Added ${user.name} to ${committee.slug} as head`);
                    } else {
                        console.log(`  ${user.name} already in ${committee.slug}`);
                    }
                }
            }
        }

        console.log('\nDone! Refresh the page to see your committees.\n');
    } catch (err) {
        console.error('Error:', err.message);
        console.error(err.stack);
    } finally {
        process.exit(0);
    }
}

run();
