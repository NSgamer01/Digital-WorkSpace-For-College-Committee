// Admin setup script: promotes the admin user and adds to all committees
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const masterDb = require('../config/masterDb');

const ADMIN_EMAIL = 'shreyashbansode14@gmail.com';

async function setup() {
    try {
        // First, list all users so we can see what's there
        console.log('\n== All users in database ==');
        const allUsers = await masterDb.query('SELECT id, name, email, global_role, firebase_uid FROM users');
        allUsers.rows.forEach(u => console.log(`  ${u.email} | role: ${u.global_role} | fb: ${u.firebase_uid || 'none'}`));

        if (allUsers.rowCount === 0) {
            console.log('  (no users)');
        }

        // Search for admin email
        let user = allUsers.rows.find(u => u.email === ADMIN_EMAIL);

        // Also try partial match
        if (!user) {
            user = allUsers.rows.find(u => u.email.includes('shreyash') || u.email.includes('bansode'));
        }

        if (!user) {
            console.log(`\nUser ${ADMIN_EMAIL} not found.`);
            console.log('Please login with this account first, then run the script again.');
            console.log('The auth sync must run to create the user in PostgreSQL.');

            // Promote the first Firebase user as admin instead
            const fbUser = allUsers.rows.find(u => u.firebase_uid);
            if (fbUser) {
                console.log(`\nAlternatively, promoting ${fbUser.email} to admin...`);
                await masterDb.query(
                    "UPDATE users SET global_role = 'admin', updated_at = NOW() WHERE id = $1",
                    [fbUser.id]
                );
                console.log(`Set ${fbUser.email} as admin.`);

                // Add to all committees
                const committees = await masterDb.query('SELECT id, slug FROM committees WHERE is_active = true');
                for (const c of committees.rows) {
                    const exists = await masterDb.query(
                        'SELECT 1 FROM committee_members WHERE user_id = $1 AND committee_id = $2',
                        [fbUser.id, c.id]
                    );
                    if (exists.rowCount === 0) {
                        await masterDb.query(
                            "INSERT INTO committee_members (committee_id, user_id, role, is_active) VALUES ($1, $2, 'head', true)",
                            [c.id, fbUser.id]
                        );
                        console.log(`  Added to ${c.slug}`);
                    }
                }
                console.log('\nDone! Login with this account and you will see the Admin panel.');
            }
            process.exit(0);
        }

        console.log(`\nFound user: ${user.name} (${user.email})`);

        // Set global_role to admin
        await masterDb.query(
            "UPDATE users SET global_role = 'admin', updated_at = NOW() WHERE id = $1",
            [user.id]
        );
        console.log('Set global_role = admin');

        // Add to all committees as head
        const committees = await masterDb.query('SELECT id, name, slug FROM committees WHERE is_active = true');
        for (const c of committees.rows) {
            const exists = await masterDb.query(
                'SELECT 1 FROM committee_members WHERE user_id = $1 AND committee_id = $2',
                [user.id, c.id]
            );
            if (exists.rowCount === 0) {
                await masterDb.query(
                    "INSERT INTO committee_members (committee_id, user_id, role, is_active) VALUES ($1, $2, 'head', true)",
                    [c.id, user.id]
                );
                console.log(`  Added to ${c.slug} as head`);
            } else {
                await masterDb.query(
                    "UPDATE committee_members SET role = 'head', is_active = true WHERE user_id = $1 AND committee_id = $2",
                    [user.id, c.id]
                );
                console.log(`  Updated ${c.slug} role to head`);
            }
        }

        console.log('\nAdmin setup complete! Login and you will see the Admin panel in sidebar.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit(0);
    }
}

setup();
