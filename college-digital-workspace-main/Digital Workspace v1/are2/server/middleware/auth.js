// ============================================
// middleware/auth.js — Firebase Token Verification
// ============================================
// Verifies Firebase ID tokens from the frontend.
// Auto-syncs the user to workspace_master.users table.
// Attaches req.user = { userId, email, name, firebaseUid, globalRole }
// ============================================

const admin = require('../config/firebaseAdmin');
const masterDb = require('../config/masterDb');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No authorization token provided.' });
        }

        const token = authHeader.split(' ')[1];

        // Verify the Firebase ID token
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        } catch (firebaseError) {
            console.error('Firebase token verification failed:', firebaseError.message);
            return res.status(401).json({ error: 'Invalid or expired token.' });
        }

        const { uid, email, name: firebaseName, picture } = decodedToken;

        // Auto-sync user to PostgreSQL (upsert)
        const upsertResult = await masterDb.query(
            `INSERT INTO users (firebase_uid, email, name, avatar)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (firebase_uid) DO UPDATE SET
                email = EXCLUDED.email,
                name = COALESCE(EXCLUDED.name, users.name),
                avatar = COALESCE(EXCLUDED.avatar, users.avatar),
                updated_at = NOW()
             RETURNING id, email, name, avatar, global_role`,
            [uid, email, firebaseName || email?.split('@')[0] || 'User', picture || null]
        );

        const dbUser = upsertResult.rows[0];

        // Attach user info to request
        req.user = {
            userId: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            avatar: dbUser.avatar,
            globalRole: dbUser.global_role || 'user',
            firebaseUid: uid,
        };

        // Also attach masterDb for routes that need it
        req.masterDb = masterDb;

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({ error: 'Authentication failed.' });
    }
};

module.exports = authMiddleware;
