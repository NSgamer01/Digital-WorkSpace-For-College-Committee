// ============================================
// routes/auth.js — Auth Routes (Hybrid Firebase)
// ============================================
// Firebase handles login/register on the client side.
// These routes sync Firebase users with PostgreSQL and
// return user profile + committee memberships.
// ============================================

const express = require('express');
const router = express.Router();
const masterDb = require('../config/masterDb');
const authMiddleware = require('../middleware/auth');

// ── POST /api/auth/sync ─────────────────────────────────────────
// Called after Firebase login/register to sync user with PostgreSQL.
// The authMiddleware already upserts the user, so this just returns
// the user profile and their committee memberships.
router.post('/sync', authMiddleware, async (req, res) => {
    try {
        const { userId, email, name, avatar, globalRole, firebaseUid } = req.user;

        // Fetch user's committee memberships
        const membershipResult = await masterDb.query(
            `SELECT c.id, c.name, c.full_name, c.slug, c.description,
                    c.color, c.icon, c.db_name,
                    cm.role, cm.position, cm.joined_at, cm.is_active
             FROM committee_members cm
             JOIN committees c ON c.id = cm.committee_id
             WHERE cm.user_id = $1 AND cm.is_active = true
             ORDER BY cm.joined_at ASC`,
            [userId]
        );

        res.json({
            success: true,
            user: {
                id: userId,
                name,
                email,
                avatar,
                globalRole,
                firebaseUid,
            },
            committees: membershipResult.rows,
        });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: 'Failed to sync user.' });
    }
});

// ── GET /api/auth/me ─────────────────────────────────────────────
// Returns current user profile + committees.
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.user;

        // Get full user profile
        const userResult = await masterDb.query(
            `SELECT id, email, name, avatar, phone, global_role, created_at
             FROM users WHERE id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const user = userResult.rows[0];

        // Get committee memberships
        const membershipResult = await masterDb.query(
            `SELECT c.id, c.name, c.full_name, c.slug, c.description,
                    c.color, c.icon, c.db_name,
                    cm.role, cm.position, cm.joined_at, cm.is_active
             FROM committee_members cm
             JOIN committees c ON c.id = cm.committee_id
             WHERE cm.user_id = $1 AND cm.is_active = true
             ORDER BY cm.joined_at ASC`,
            [userId]
        );

        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                phone: user.phone,
                globalRole: user.global_role,
                createdAt: user.created_at,
            },
            committees: membershipResult.rows,
        });
    } catch (error) {
        console.error('Get /me error:', error);
        res.status(500).json({ error: 'Failed to fetch profile.' });
    }
});

module.exports = router;
