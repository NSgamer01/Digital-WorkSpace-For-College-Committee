// ============================================
// middleware/firebaseAuth.js — Firebase Authentication
// ============================================
// Verifies Firebase ID tokens and syncs users to PostgreSQL.
//
//  1. Extract Bearer token from Authorization header
//  2. Verify with Firebase Admin
//  3. Upsert user in workspace_master.users
//  4. Attach req.user with PostgreSQL user data
// ============================================

const admin = require('../config/firebase');
const masterDb = require('../config/masterDb');

async function firebaseAuth(req, res, next) {
    try {
        // Extract token from Authorization header or query param (SSE fallback)
        const authHeader = req.headers.authorization;
        let token = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split('Bearer ')[1];
        } else if (req.query.token) {
            // SSE (EventSource) can't set headers — accept token as query param
            token = req.query.token;
        }

        if (!token) {
            return res.status(401).json({ error: 'No authentication token provided' });
        }

        // Verify Firebase token
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        } catch (verifyErr) {
            return res.status(401).json({ error: 'Invalid or expired authentication token' });
        }

        // Look up user in PostgreSQL master database
        let userResult = await masterDb.query(
            'SELECT * FROM users WHERE firebase_uid = $1',
            [decodedToken.uid]
        );

        let user;

        if (userResult.rows.length === 0) {
            // User doesn't exist in PostgreSQL yet — create them
            const name = decodedToken.name || decodedToken.email || 'Unknown User';
            const email = decodedToken.email || `${decodedToken.uid}@firebase.local`;
            const avatar = decodedToken.picture || null;

            const insertResult = await masterDb.query(
                `INSERT INTO users (firebase_uid, email, name, avatar)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (firebase_uid) DO UPDATE SET
                    last_login = NOW(),
                    name = COALESCE(NULLIF(users.name, ''), $3)
                 RETURNING *`,
                [decodedToken.uid, email, name, avatar]
            );

            user = insertResult.rows[0];
            console.log(`  👤 New user synced to PostgreSQL: ${user.email} (${user.id})`);
        } else {
            user = userResult.rows[0];

            // Update last_login
            await masterDb.query(
                'UPDATE users SET last_login = NOW() WHERE id = $1',
                [user.id]
            );
        }

        // Attach user info to request
        req.user = {
            uid: decodedToken.uid,
            email: user.email,
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            globalRole: user.global_role,
            lastCommitteeSlug: user.last_committee_slug,
            isActive: user.is_active,
        };

        next();
    } catch (err) {
        console.error('  ❌ Firebase auth error:', err.message);
        return res.status(401).json({ error: 'Unauthorized' });
    }
}

module.exports = firebaseAuth;
