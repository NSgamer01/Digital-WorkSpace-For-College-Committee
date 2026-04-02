// ============================================
// routes/meetings.js
// ============================================
// Meeting management routes using req.committeeDb.
// Creator and attendee details enriched from masterDb.
// ============================================

const express = require('express');
const router = express.Router();

// ── enrichWithUserNames helper ──────────────────
async function enrichWithUserNames(masterDb, rows, userIdField) {
    if (!rows || rows.length === 0) return rows;

    const fields = Array.isArray(userIdField) ? userIdField : [userIdField];
    const userIds = new Set();

    for (const row of rows) {
        for (const field of fields) {
            if (row[field]) userIds.add(row[field]);
        }
        // Also collect attendees (UUID array)
        if (row.attendees && Array.isArray(row.attendees)) {
            for (const attendeeId of row.attendees) {
                userIds.add(attendeeId);
            }
        }
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
        for (const field of fields) {
            if (row[field] && userMap[row[field]]) {
                const prefix = field.replace(/_id$/, '').replace(/_by$/, '');
                row[`${prefix}_name`] = userMap[row[field]].name;
                row[`${prefix}_email`] = userMap[row[field]].email;
                row[`${prefix}_avatar`] = userMap[row[field]].avatar;
            }
        }
        // Build attendee details array
        if (row.attendees && Array.isArray(row.attendees)) {
            row.attendee_details = row.attendees
                .filter(id => userMap[id])
                .map(id => ({
                    id: userMap[id].id,
                    name: userMap[id].name,
                    email: userMap[id].email,
                    avatar: userMap[id].avatar,
                }));
        }
    }

    return rows;
}

// ══════════════════════════════════════════════════
// GET / — List meetings with optional filters
// ══════════════════════════════════════════════════
router.get('/', async (req, res) => {
    try {
        const { startDate, endDate, status, limit } = req.query;
        const db = req.committeeDb;

        let query = `SELECT * FROM meetings WHERE 1=1`;
        const params = [];
        let paramIndex = 1;

        // ═══ VISIBILITY FILTER — creator + attendees only ═══
        const ADMIN_ROLES = ['head', 'admin', 'advisor'];
        if (!ADMIN_ROLES.includes(req.committeeRole)) {
            query += ` AND (created_by = $${paramIndex} OR $${paramIndex} = ANY(attendees))`;
            params.push(req.user.userId);
            paramIndex++;
        }

        if (startDate) {
            query += ` AND start_time >= $${paramIndex++}`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND end_time <= $${paramIndex++}`;
            params.push(endDate);
        }
        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }

        query += ` ORDER BY start_time ASC`;

        if (limit && !isNaN(parseInt(limit))) {
            query += ` LIMIT $${paramIndex++}`;
            params.push(parseInt(limit));
        }

        const result = await db.query(query, params);

        const enriched = await enrichWithUserNames(req.masterDb, result.rows, 'created_by');

        res.json({
            success: true,
            meetings: enriched,
            total: enriched.length,
        });
    } catch (err) {
        console.error('List meetings error:', err.message);
        res.status(500).json({ error: 'Failed to list meetings.' });
    }
});

// ══════════════════════════════════════════════════
// POST / — Create a meeting
// ══════════════════════════════════════════════════
router.post('/', async (req, res) => {
    try {
        const {
            title, description, start_time, end_time, is_all_day,
            location, meeting_link, attendees, status,
            is_recurring, recurrence_rule, minutes, attachments, color
        } = req.body;
        const db = req.committeeDb;

        if (!title || !start_time || !end_time) {
            return res.status(400).json({ error: 'Title, start_time, and end_time are required.' });
        }

        const result = await db.query(
            `INSERT INTO meetings (title, description, start_time, end_time, is_all_day, location, meeting_link, created_by, attendees, status, is_recurring, recurrence_rule, minutes, attachments, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
            [
                title.trim(),
                description || null,
                start_time,
                end_time,
                is_all_day || false,
                location || null,
                meeting_link || null,
                req.user.userId,
                attendees || [],
                status || 'scheduled',
                is_recurring || false,
                recurrence_rule || null,
                minutes || null,
                JSON.stringify(attachments || []),
                color || null,
            ]
        );

        const meeting = result.rows[0];

        // Notify all attendees
        if (attendees && attendees.length > 0) {
            for (const attendeeId of attendees) {
                if (attendeeId !== req.user.userId) {
                    await db.query(
                        `INSERT INTO notifications (user_id, type, title, message, link)
             VALUES ($1, $2, $3, $4, $5)`,
                        [
                            attendeeId,
                            'meeting_invite',
                            'New Meeting',
                            `You have been invited to: "${title.trim()}"`,
                            `/calendar`,
                        ]
                    );
                }
            }
        }

        // Log activity
        await db.query(
            `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.user.userId, 'created_meeting', 'meeting', meeting.id, JSON.stringify({ title: title.trim() }), req.ip]
        );

        const enriched = await enrichWithUserNames(req.masterDb, [meeting], 'created_by');

        res.status(201).json({
            success: true,
            meeting: enriched[0],
        });
    } catch (err) {
        console.error('Create meeting error:', err.message);
        res.status(500).json({ error: 'Failed to create meeting.' });
    }
});

// ══════════════════════════════════════════════════
// PATCH /:id — Update a meeting
// ══════════════════════════════════════════════════
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.committeeDb;

        const allowedFields = [
            'title', 'description', 'start_time', 'end_time', 'is_all_day',
            'location', 'meeting_link', 'attendees', 'status',
            'is_recurring', 'recurrence_rule', 'minutes', 'attachments', 'color'
        ];

        const updates = [];
        const values = [];
        let paramIndex = 1;

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                if (field === 'attachments') {
                    updates.push(`${field} = $${paramIndex++}`);
                    values.push(JSON.stringify(req.body[field]));
                } else {
                    updates.push(`${field} = $${paramIndex++}`);
                    values.push(req.body[field]);
                }
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update.' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const result = await db.query(
            `UPDATE meetings SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Meeting not found.' });
        }

        const enriched = await enrichWithUserNames(req.masterDb, result.rows, 'created_by');

        res.json({
            success: true,
            meeting: enriched[0],
        });
    } catch (err) {
        console.error('Update meeting error:', err.message);
        res.status(500).json({ error: 'Failed to update meeting.' });
    }
});

// ══════════════════════════════════════════════════
// DELETE /:id — Hard delete a meeting
// ══════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.committeeDb;

        const result = await db.query(
            `DELETE FROM meetings WHERE id = $1 RETURNING id, title`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Meeting not found.' });
        }

        // Log activity
        await db.query(
            `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.user.userId, 'deleted_meeting', 'meeting', id, JSON.stringify({ title: result.rows[0].title }), req.ip]
        );

        res.json({
            success: true,
            message: 'Meeting deleted.',
        });
    } catch (err) {
        console.error('Delete meeting error:', err.message);
        res.status(500).json({ error: 'Failed to delete meeting.' });
    }
});

module.exports = router;
