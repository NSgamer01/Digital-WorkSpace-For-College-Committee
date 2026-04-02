// ============================================
// routes/announcements.js — Announcements CRUD
// ============================================
// GET    /       — list announcements
// POST   /       — create announcement (role-gated)
// DELETE /:id    — soft-delete / remove announcement
// ============================================

const express = require('express');
const router = express.Router();

// ── enrichWithUserNames helper ──────────────────
async function enrichWithUserNames(masterDb, rows, userIdField = 'created_by') {
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
            row.created_by_name = row.created_by_name || userMap[row[userIdField]].name;
            row.created_by_role = row.created_by_role || null;
            row.author_name = userMap[row[userIdField]].name;
            row.author_email = userMap[row[userIdField]].email;
            row.author_avatar = userMap[row[userIdField]].avatar;
        }
    }

    return rows;
}

// ══════════════════════════════════════════════════
// GET / — List announcements
// ══════════════════════════════════════════════════
router.get('/', async (req, res) => {
    try {
        const db = req.committeeDb;
        const { limit = 20, offset = 0 } = req.query;

        const parsedLimit = Math.min(parseInt(limit) || 20, 50);
        const parsedOffset = parseInt(offset) || 0;

        const result = await db.query(
            `SELECT * FROM announcements
             WHERE (expires_at IS NULL OR expires_at > NOW())
             ORDER BY
               is_pinned DESC,
               CASE priority
                 WHEN 'urgent' THEN 1
                 WHEN 'important' THEN 2
                 WHEN 'high' THEN 3
                 WHEN 'normal' THEN 4
                 WHEN 'low' THEN 5
                 ELSE 6
               END,
               created_at DESC
             LIMIT $1 OFFSET $2`,
            [parsedLimit, parsedOffset]
        );

        const announcements = result.rows;

        // Backfill missing author names
        const missingNames = announcements.filter(a => !a.created_by_name);
        if (missingNames.length > 0) {
            const userIds = [...new Set(missingNames.map(a => a.created_by))];
            const usersResult = await req.masterDb.query(
                'SELECT id, name FROM users WHERE id = ANY($1)', [userIds]
            );
            const namesMap = {};
            usersResult.rows.forEach(u => { namesMap[u.id] = u.name; });

            announcements.forEach(a => {
                if (!a.created_by_name && namesMap[a.created_by]) {
                    a.created_by_name = namesMap[a.created_by];
                }
            });
        }

        const enriched = await enrichWithUserNames(req.masterDb, announcements, 'created_by');

        res.json({
            success: true,
            announcements: enriched,
            total: enriched.length,
        });
    } catch (err) {
        console.error('List announcements error:', err.message);
        res.status(500).json({ error: 'Failed to list announcements.' });
    }
});

// ══════════════════════════════════════════════════
// POST / — Create an announcement (restricted roles)
// ══════════════════════════════════════════════════
router.post('/', async (req, res) => {
    try {
        const db = req.committeeDb;
        const { title, content, priority, is_pinned, target_roles, attachments, expires_at } = req.body;

        // Permission check
        if (!['head', 'admin', 'faculty'].includes(req.committeeRole)) {
            return res.status(403).json({ error: 'Only faculty, heads, and admins can create announcements' });
        }

        // Validation
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Title is required' });
        }
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Content is required' });
        }

        // Get creator name from masterDb
        const userResult = await req.masterDb.query(
            'SELECT name FROM users WHERE id = $1', [req.user.userId]
        );
        const creatorName = userResult.rows[0]?.name || 'Unknown';

        const validPriorities = ['normal', 'important', 'urgent', 'high', 'low'];
        const announcementPriority = validPriorities.includes(priority) ? priority : 'normal';

        const result = await db.query(
            `INSERT INTO announcements (title, content, priority, created_by, created_by_name, created_by_role, is_pinned, target_roles, attachments, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                title.trim(),
                content.trim(),
                announcementPriority,
                req.user.userId,
                creatorName,
                req.committeeRole,
                is_pinned || false,
                target_roles || [],
                JSON.stringify(attachments || []),
                expires_at || null,
            ]
        );

        const announcement = result.rows[0];

        // Log activity (fire-and-forget)
        db.query(
            `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.user.userId, 'created_announcement', 'announcement', announcement.id, JSON.stringify({ title: title.trim() }), req.ip]
        ).catch(err => console.error('Activity log failed:', err.message));

        // Notify all committee members (fire-and-forget)
        try {
            const membersResult = await req.masterDb.query(
                `SELECT cm.user_id FROM committee_members cm
                 INNER JOIN committees c ON c.id = cm.committee_id
                 WHERE c.slug = $1 AND cm.user_id != $2 AND cm.is_active = true`,
                [req.committeeSlug, req.user.userId]
            );

            for (const member of membersResult.rows) {
                db.query(
                    `INSERT INTO notifications (user_id, type, title, message, link)
                     VALUES ($1, 'announcement', '📢 New Announcement', $2, '/messages?tab=announcements')`,
                    [member.user_id, `${creatorName}: ${title.trim().substring(0, 80)}`]
                ).catch(() => { });
            }
        } catch (notifErr) {
            console.error('Announcement notification error:', notifErr.message);
        }

        const enriched = await enrichWithUserNames(req.masterDb, [announcement], 'created_by');

        res.status(201).json({
            success: true,
            announcement: enriched[0],
        });
    } catch (err) {
        console.error('Create announcement error:', err.message);
        res.status(500).json({ error: 'Failed to create announcement.' });
    }
});

// ══════════════════════════════════════════════════
// DELETE /:id — Delete an announcement
// ══════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
    try {
        const db = req.committeeDb;
        const { id } = req.params;

        const announcement = await db.query('SELECT created_by FROM announcements WHERE id = $1', [id]);
        if (announcement.rows.length === 0) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        // Only creator or admin/head can delete
        if (announcement.rows[0].created_by !== req.user.userId &&
            !['head', 'admin'].includes(req.committeeRole)) {
            return res.status(403).json({ error: 'Not authorized to delete this announcement' });
        }

        // Try soft-delete if is_deleted column exists, otherwise hard delete
        try {
            await db.query(
                'UPDATE announcements SET is_deleted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                [id]
            );
        } catch (colErr) {
            // Fallback: hard delete if is_deleted column doesn't exist
            await db.query('DELETE FROM announcements WHERE id = $1', [id]);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Delete announcement error:', err.message);
        res.status(500).json({ error: 'Failed to delete announcement.' });
    }
});

module.exports = router;
