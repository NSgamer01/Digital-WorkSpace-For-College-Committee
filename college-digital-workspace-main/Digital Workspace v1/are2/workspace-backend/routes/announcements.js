// ============================================
// routes/announcements.js — Announcement Routes
// ============================================
// All routes use req.committeeDb.
// ============================================

const express = require('express');
const router = express.Router();
const { enrichWithUserNames } = require('../utils/enrichUsers');
const { requireCommitteeRole } = require('../middleware/committee');

// ═══════════════════════════════════════════════
//  GET / — List announcements
// ═══════════════════════════════════════════════
router.get('/', async (req, res) => {
    try {
        const result = await req.committeeDb.query(
            `SELECT * FROM announcements
             WHERE expires_at IS NULL OR expires_at > NOW()
             ORDER BY is_pinned DESC, created_at DESC`
        );

        // Enrich with author names
        let announcements = await enrichWithUserNames(req.masterDb, result.rows, 'created_by');

        announcements = announcements.map((a) => ({
            ...a,
            author_name: a.user_name,
            author_email: a.user_email,
            author_avatar: a.user_avatar,
        }));

        res.json({ success: true, announcements });
    } catch (err) {
        console.error('  ❌ List announcements error:', err.message);
        res.status(500).json({ error: 'Failed to list announcements' });
    }
});

// ═══════════════════════════════════════════════
//  GET /:id — Single announcement
// ═══════════════════════════════════════════════
router.get('/:id', async (req, res) => {
    try {
        const result = await req.committeeDb.query(
            'SELECT * FROM announcements WHERE id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        const announcements = await enrichWithUserNames(req.masterDb, result.rows, 'created_by');
        const announcement = {
            ...announcements[0],
            author_name: announcements[0].user_name,
            author_avatar: announcements[0].user_avatar,
        };

        res.json({ success: true, announcement });
    } catch (err) {
        console.error('  ❌ Get announcement error:', err.message);
        res.status(500).json({ error: 'Failed to fetch announcement' });
    }
});

// ═══════════════════════════════════════════════
//  POST / — Create announcement
// ═══════════════════════════════════════════════
// Only head/admin/advisor/coordinator
router.post('/', requireCommitteeRole('head', 'admin', 'advisor', 'coordinator'), async (req, res) => {
    try {
        const { title, content, priority, is_pinned, target_roles, attachments, expires_at } = req.body;

        if (!title || !content) {
            return res.status(400).json({ error: 'title and content are required' });
        }

        const result = await req.committeeDb.query(
            `INSERT INTO announcements (title, content, created_by, priority, is_pinned, target_roles, attachments, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                title,
                content,
                req.user.id,
                priority || 'normal',
                is_pinned || false,
                target_roles || [],
                JSON.stringify(attachments || []),
                expires_at || null,
            ]
        );

        const announcement = result.rows[0];

        // Log activity
        await req.committeeDb.query(
            `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
             VALUES ($1, 'created', 'announcement', $2, $3)`,
            [req.user.id, announcement.id, JSON.stringify({ title })]
        );

        res.status(201).json({ success: true, announcement });
    } catch (err) {
        console.error('  ❌ Create announcement error:', err.message);
        res.status(500).json({ error: 'Failed to create announcement' });
    }
});

// ═══════════════════════════════════════════════
//  PATCH /:id — Update announcement
// ═══════════════════════════════════════════════
// Only head/admin/advisor/coordinator
router.patch('/:id', requireCommitteeRole('head', 'admin', 'advisor', 'coordinator'), async (req, res) => {
    try {
        const { title, content, priority, is_pinned, expires_at } = req.body;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (title !== undefined) {
            updates.push(`title = $${paramIndex++}`);
            values.push(title);
        }
        if (content !== undefined) {
            updates.push(`content = $${paramIndex++}`);
            values.push(content);
        }
        if (priority !== undefined) {
            updates.push(`priority = $${paramIndex++}`);
            values.push(priority);
        }
        if (is_pinned !== undefined) {
            updates.push(`is_pinned = $${paramIndex++}`);
            values.push(is_pinned);
        }
        if (expires_at !== undefined) {
            updates.push(`expires_at = $${paramIndex++}`);
            values.push(expires_at);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(req.params.id);

        const result = await req.committeeDb.query(
            `UPDATE announcements SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        res.json({ success: true, announcement: result.rows[0] });
    } catch (err) {
        console.error('  ❌ Update announcement error:', err.message);
        res.status(500).json({ error: 'Failed to update announcement' });
    }
});

// ═══════════════════════════════════════════════
//  DELETE /:id — Delete announcement
// ═══════════════════════════════════════════════
// Only head/admin/advisor
router.delete('/:id', requireCommitteeRole('head', 'admin', 'advisor'), async (req, res) => {
    try {
        const result = await req.committeeDb.query(
            'DELETE FROM announcements WHERE id = $1 RETURNING id',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        res.json({ success: true, message: 'Announcement deleted' });
    } catch (err) {
        console.error('  ❌ Delete announcement error:', err.message);
        res.status(500).json({ error: 'Failed to delete announcement' });
    }
});

module.exports = router;
