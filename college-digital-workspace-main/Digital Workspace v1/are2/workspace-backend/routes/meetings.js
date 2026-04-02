// ============================================
// routes/meetings.js — Meeting Routes
// ============================================
// All routes use req.committeeDb.
// ============================================

const express = require('express');
const router = express.Router();
const { enrichWithUserNames } = require('../utils/enrichUsers');

// Email notifications (optional — fails gracefully)
let sendMeetingInviteEmails;
try {
    sendMeetingInviteEmails = require('./email').sendMeetingInviteEmails;
} catch {
    console.warn('  ⚠️  email.js not loaded — email notifications disabled');
}

// ═══════════════════════════════════════════════
//  GET / — List meetings
// ═══════════════════════════════════════════════
router.get('/', async (req, res) => {
    try {
        const { startDate, endDate, status } = req.query;

        let query = 'SELECT * FROM meetings WHERE 1=1';
        const params = [];
        let paramIndex = 1;

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

        query += ' ORDER BY start_time ASC';

        const result = await req.committeeDb.query(query, params);

        // Enrich with creator names
        let meetings = await enrichWithUserNames(req.masterDb, result.rows, 'created_by');

        // Enrich attendees with details
        const allAttendeeIds = [...new Set(
            meetings.flatMap((m) => m.attendees || []).filter(Boolean)
        )];

        let attendeeMap = {};
        if (allAttendeeIds.length > 0) {
            const attendeeResult = await req.masterDb.query(
                'SELECT id, name, email, avatar FROM users WHERE id = ANY($1)',
                [allAttendeeIds]
            );
            for (const u of attendeeResult.rows) {
                attendeeMap[u.id] = { id: u.id, name: u.name, email: u.email, avatar: u.avatar };
            }
        }

        meetings = meetings.map((m) => ({
            ...m,
            creator_name: m.user_name,
            creator_avatar: m.user_avatar,
            attendee_details: (m.attendees || []).map((id) => attendeeMap[id] || { id, name: 'Unknown', email: '', avatar: null }),
        }));

        res.json({ success: true, meetings });
    } catch (err) {
        console.error('  ❌ List meetings error:', err.message);
        res.status(500).json({ error: 'Failed to list meetings' });
    }
});

// ═══════════════════════════════════════════════
//  GET /:id — Single meeting
// ═══════════════════════════════════════════════
router.get('/:id', async (req, res) => {
    try {
        const result = await req.committeeDb.query(
            'SELECT * FROM meetings WHERE id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        const meetings = await enrichWithUserNames(req.masterDb, result.rows, 'created_by');
        const meeting = meetings[0];

        // Enrich attendees
        if (meeting.attendees && meeting.attendees.length > 0) {
            const attendeeResult = await req.masterDb.query(
                'SELECT id, name, email, avatar FROM users WHERE id = ANY($1)',
                [meeting.attendees]
            );

            meeting.attendee_details = attendeeResult.rows;
        } else {
            meeting.attendee_details = [];
        }

        meeting.creator_name = meeting.user_name;
        meeting.creator_avatar = meeting.user_avatar;

        res.json({ success: true, meeting });
    } catch (err) {
        console.error('  ❌ Get meeting error:', err.message);
        res.status(500).json({ error: 'Failed to fetch meeting' });
    }
});

// ═══════════════════════════════════════════════
//  POST / — Create meeting
// ═══════════════════════════════════════════════
router.post('/', async (req, res) => {
    try {
        const {
            title, description, start_time, end_time, is_all_day,
            location, meeting_link, attendees, status,
            is_recurring, recurrence_rule, color,
        } = req.body;

        if (!title || !start_time || !end_time) {
            return res.status(400).json({ error: 'title, start_time, and end_time are required' });
        }

        const result = await req.committeeDb.query(
            `INSERT INTO meetings (title, description, start_time, end_time, is_all_day,
             location, meeting_link, created_by, attendees, status,
             is_recurring, recurrence_rule, color)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [
                title,
                description || '',
                start_time,
                end_time,
                is_all_day || false,
                location || '',
                meeting_link || null,
                req.user.id,
                attendees || [],
                status || 'scheduled',
                is_recurring || false,
                recurrence_rule || null,
                color || '#6366f1',
            ]
        );

        const meeting = result.rows[0];

        // Create notifications for each attendee
        if (attendees && attendees.length > 0) {
            for (const attendeeId of attendees) {
                if (attendeeId !== req.user.id) {
                    await req.committeeDb.query(
                        `INSERT INTO notifications (user_id, type, title, message, link)
                         VALUES ($1, 'meeting_invite', 'Meeting Invitation', $2, $3)`,
                        [
                            attendeeId,
                            `You're invited to: "${title}"`,
                            `/meetings/${meeting.id}`,
                        ]
                    );
                }
            }
        }

        // Log activity
        await req.committeeDb.query(
            `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
             VALUES ($1, 'created', 'meeting', $2, $3)`,
            [req.user.id, meeting.id, JSON.stringify({ title })]
        );

        // Send email notifications (fire-and-forget — don't delay response)
        if (sendMeetingInviteEmails && attendees && attendees.length > 0) {
            (async () => {
                try {
                    // Fetch attendee emails from master DB
                    const emailResult = await req.masterDb.query(
                        'SELECT email FROM users WHERE id = ANY($1) AND email IS NOT NULL',
                        [attendees]
                    );
                    const emails = emailResult.rows.map(r => r.email).filter(Boolean);
                    if (emails.length > 0) {
                        await sendMeetingInviteEmails(meeting, emails, req.user.name || 'Team Member');
                    }
                } catch (emailErr) {
                    console.error('  ⚠️  Email notification failed (non-blocking):', emailErr.message);
                }
            })();
        }

        res.status(201).json({ success: true, meeting });
    } catch (err) {
        console.error('  ❌ Create meeting error:', err.message);
        res.status(500).json({ error: 'Failed to create meeting' });
    }
});

// ═══════════════════════════════════════════════
//  PATCH /:id — Update meeting
// ═══════════════════════════════════════════════
router.patch('/:id', async (req, res) => {
    try {
        const allowedFields = [
            'title', 'description', 'start_time', 'end_time',
            'location', 'meeting_link', 'attendees', 'status',
            'minutes', 'color', 'is_all_day', 'is_recurring', 'recurrence_rule',
        ];

        const updates = [];
        const values = [];
        let paramIndex = 1;

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = $${paramIndex++}`);
                values.push(req.body[field]);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(req.params.id);

        const result = await req.committeeDb.query(
            `UPDATE meetings SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        res.json({ success: true, meeting: result.rows[0] });
    } catch (err) {
        console.error('  ❌ Update meeting error:', err.message);
        res.status(500).json({ error: 'Failed to update meeting' });
    }
});

// ═══════════════════════════════════════════════
//  DELETE /:id — Delete meeting
// ═══════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
    try {
        const result = await req.committeeDb.query(
            'DELETE FROM meetings WHERE id = $1 RETURNING id',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        res.json({ success: true, message: 'Meeting deleted' });
    } catch (err) {
        console.error('  ❌ Delete meeting error:', err.message);
        res.status(500).json({ error: 'Failed to delete meeting' });
    }
});

module.exports = router;
