// ============================================
// routes/notifications.js — Notification API
// ============================================
// CRUD for the per-committee `notifications` table.
// All routes require auth + committee middleware.
// ============================================

const express = require('express');
const router = express.Router();

// ══════════════════════════════════════════════════
// GET / — Fetch notifications for the authenticated user
// ══════════════════════════════════════════════════
router.get('/', async (req, res) => {
    try {
        const db = req.committeeDb;
        const userId = req.user.userId;
        const limit = parseInt(req.query.limit) || 30;
        const offset = parseInt(req.query.offset) || 0;

        const result = await db.query(
            `SELECT * FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM notifications WHERE user_id = $1`,
            [userId]
        );

        res.json({
            success: true,
            notifications: result.rows,
            total: parseInt(countResult.rows[0].total),
        });
    } catch (err) {
        console.error('GET /api/notifications error:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// ══════════════════════════════════════════════════
// GET /unread-count — Quick badge count
// ══════════════════════════════════════════════════
router.get('/unread-count', async (req, res) => {
    try {
        const db = req.committeeDb;
        const userId = req.user.userId;

        const result = await db.query(
            `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`,
            [userId]
        );

        res.json({
            success: true,
            count: parseInt(result.rows[0].count),
        });
    } catch (err) {
        console.error('GET /api/notifications/unread-count error:', err);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});

// ══════════════════════════════════════════════════
// PATCH /read-all — Mark all as read
// ══════════════════════════════════════════════════
router.patch('/read-all', async (req, res) => {
    try {
        const db = req.committeeDb;
        const userId = req.user.userId;

        await db.query(
            `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
            [userId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('PATCH /api/notifications/read-all error:', err);
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
});

// ══════════════════════════════════════════════════
// PATCH /:id/read — Mark single notification as read
// ══════════════════════════════════════════════════
router.patch('/:id/read', async (req, res) => {
    try {
        const db = req.committeeDb;
        const userId = req.user.userId;
        const { id } = req.params;

        const result = await db.query(
            `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *`,
            [id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ success: true, notification: result.rows[0] });
    } catch (err) {
        console.error('PATCH /api/notifications/:id/read error:', err);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// ══════════════════════════════════════════════════
// DELETE /clear-read — Delete all read notifications
// ══════════════════════════════════════════════════
router.delete('/clear-read', async (req, res) => {
    try {
        const db = req.committeeDb;
        const userId = req.user.userId;

        const result = await db.query(
            `DELETE FROM notifications WHERE user_id = $1 AND is_read = true`,
            [userId]
        );

        res.json({ success: true, deletedCount: result.rowCount });
    } catch (err) {
        console.error('DELETE /api/notifications/clear-read error:', err);
        res.status(500).json({ error: 'Failed to clear read notifications' });
    }
});

// ══════════════════════════════════════════════════
// DELETE /:id — Delete a single notification
// ══════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
    try {
        const db = req.committeeDb;
        const userId = req.user.userId;
        const { id } = req.params;

        const result = await db.query(
            `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/notifications/:id error:', err);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

module.exports = router;
