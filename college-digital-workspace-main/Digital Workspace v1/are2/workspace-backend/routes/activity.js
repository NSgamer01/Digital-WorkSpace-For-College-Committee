// ============================================
// routes/activity.js — Activity Log Routes
// ============================================
// All routes use req.committeeDb.
// ============================================

const express = require('express');
const router = express.Router();
const { enrichWithUserNames } = require('../utils/enrichUsers');

// ═══════════════════════════════════════════════
//  GET / — List activity log (paginated)
// ═══════════════════════════════════════════════
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const result = await req.committeeDb.query(
            `SELECT * FROM activity_log
             ORDER BY created_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        // Get total count
        const countResult = await req.committeeDb.query(
            'SELECT COUNT(*) AS total FROM activity_log'
        );

        // Enrich with user names
        let activities = await enrichWithUserNames(req.masterDb, result.rows, 'user_id');

        activities = activities.map((a) => ({
            ...a,
            actor_name: a.user_name,
            actor_email: a.user_email,
            actor_avatar: a.user_avatar,
        }));

        res.json({
            success: true,
            activities,
            total: parseInt(countResult.rows[0].total),
            limit,
            offset,
        });
    } catch (err) {
        console.error('  ❌ Activity log error:', err.message);
        res.status(500).json({ error: 'Failed to fetch activity log' });
    }
});

module.exports = router;
