// ============================================
// routes/activity.js
// ============================================
// Activity log routes using req.committeeDb.
// User names/avatars enriched from masterDb.
// ============================================

const express = require('express');
const router = express.Router();

// ── enrichWithUserNames helper ──────────────────
async function enrichWithUserNames(masterDb, rows, userIdField = 'user_id') {
    if (!rows || rows.length === 0) return rows;

    const userIds = new Set();
    for (const row of rows) {
        if (row[userIdField]) userIds.add(row[userIdField]);
    }

    if (userIds.size === 0) return rows;

    const userIdsArray = Array.from(userIds);
    const placeholders = userIdsArray.map((_, i) => `$${i + 1}`).join(', ');
    const result = await masterDb.query(
        `SELECT id, name, email, avatar FROM users WHERE id IN (${placeholders})`,
        userIdsArray
    );

    const userMap = {};
    for (const user of result.rows) {
        userMap[user.id] = user;
    }

    for (const row of rows) {
        if (row[userIdField] && userMap[row[userIdField]]) {
            row.user_name = userMap[row[userIdField]].name;
            row.user_email = userMap[row[userIdField]].email;
            row.user_avatar = userMap[row[userIdField]].avatar;
        }
    }

    return rows;
}

// ══════════════════════════════════════════════════
// GET / — Paginated activity log
// ══════════════════════════════════════════════════
router.get('/', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const db = req.committeeDb;

        const parsedLimit = Math.min(parseInt(limit) || 50, 100);
        const parsedOffset = parseInt(offset) || 0;

        // Get total count
        const countResult = await db.query(`SELECT COUNT(*) FROM activity_log`);
        const total = parseInt(countResult.rows[0].count) || 0;

        // Get paginated results
        const result = await db.query(
            `SELECT * FROM activity_log
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
            [parsedLimit, parsedOffset]
        );

        const enriched = await enrichWithUserNames(req.masterDb, result.rows, 'user_id');

        res.json({
            success: true,
            activities: enriched,
            total,
            limit: parsedLimit,
            offset: parsedOffset,
            hasMore: parsedOffset + parsedLimit < total,
        });
    } catch (err) {
        console.error('List activity error:', err.message);
        res.status(500).json({ error: 'Failed to list activity log.' });
    }
});

module.exports = router;
