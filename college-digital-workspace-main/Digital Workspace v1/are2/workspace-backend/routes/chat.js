// ============================================
// routes/chat.js — Chat Routes
// ============================================
// All routes use req.committeeDb.
// ============================================

const express = require('express');
const router = express.Router();

// ═══════════════════════════════════════════════
//  GET /rooms — List chat rooms
// ═══════════════════════════════════════════════
router.get('/rooms', async (req, res) => {
    try {
        const result = await req.committeeDb.query(`
            SELECT cr.*,
                (SELECT COUNT(*) FROM messages m WHERE m.room_id = cr.id AND m.is_deleted = false) AS message_count,
                (SELECT m.content FROM messages m WHERE m.room_id = cr.id AND m.is_deleted = false ORDER BY m.created_at DESC LIMIT 1) AS last_message,
                (SELECT m.created_at FROM messages m WHERE m.room_id = cr.id AND m.is_deleted = false ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
            FROM chat_rooms cr
            WHERE cr.is_archived = false
            ORDER BY
                CASE cr.type WHEN 'general' THEN 0 ELSE 1 END,
                cr.name
        `);

        res.json({ success: true, rooms: result.rows });
    } catch (err) {
        console.error('  ❌ List rooms error:', err.message);
        res.status(500).json({ error: 'Failed to list chat rooms' });
    }
});

// ═══════════════════════════════════════════════
//  GET /rooms/:roomId/messages — Get messages (paginated)
// ═══════════════════════════════════════════════
router.get('/rooms/:roomId/messages', async (req, res) => {
    try {
        const { roomId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const before = req.query.before; // cursor timestamp

        let query;
        let params;

        if (before) {
            query = `SELECT * FROM messages
                     WHERE room_id = $1 AND is_deleted = false AND created_at < $2
                     ORDER BY created_at DESC
                     LIMIT $3`;
            params = [roomId, before, limit];
        } else {
            query = `SELECT * FROM messages
                     WHERE room_id = $1 AND is_deleted = false
                     ORDER BY created_at DESC
                     LIMIT $2`;
            params = [roomId, limit];
        }

        const result = await req.committeeDb.query(query, params);

        // Enrich with sender info
        const senderIds = [...new Set(result.rows.map((m) => m.sender_id).filter(Boolean))];
        let senderMap = {};

        if (senderIds.length > 0) {
            const senderResult = await req.masterDb.query(
                'SELECT id, name, email, avatar FROM users WHERE id = ANY($1)',
                [senderIds]
            );
            for (const u of senderResult.rows) {
                senderMap[u.id] = { name: u.name, email: u.email, avatar: u.avatar };
            }
        }

        // Reverse to chronological order
        const messages = result.rows.reverse().map((m) => ({
            ...m,
            sender_name: senderMap[m.sender_id]?.name || 'Unknown',
            sender_email: senderMap[m.sender_id]?.email || '',
            sender_avatar: senderMap[m.sender_id]?.avatar || null,
        }));

        const hasMore = result.rows.length === limit;

        res.json({ success: true, messages, hasMore });
    } catch (err) {
        console.error('  ❌ Get messages error:', err.message);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// ═══════════════════════════════════════════════
//  POST /rooms/:roomId/messages — Send message
// ═══════════════════════════════════════════════
router.post('/rooms/:roomId/messages', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { content, type, file_url, file_name, file_size, reply_to } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Message content is required' });
        }

        // Verify room exists
        const roomCheck = await req.committeeDb.query(
            'SELECT id FROM chat_rooms WHERE id = $1',
            [roomId]
        );

        if (roomCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Chat room not found' });
        }

        const result = await req.committeeDb.query(
            `INSERT INTO messages (room_id, sender_id, content, type, file_url, file_name, file_size, reply_to)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                roomId,
                req.user.id,
                content,
                type || 'text',
                file_url || null,
                file_name || null,
                file_size || null,
                reply_to || null,
            ]
        );

        // Update room's updated_at
        await req.committeeDb.query(
            'UPDATE chat_rooms SET updated_at = NOW() WHERE id = $1',
            [roomId]
        );

        // Get sender info from master DB
        const senderResult = await req.masterDb.query(
            'SELECT name, email, avatar FROM users WHERE id = $1',
            [req.user.id]
        );

        const message = {
            ...result.rows[0],
            sender_name: senderResult.rows[0]?.name || 'Unknown',
            sender_email: senderResult.rows[0]?.email || '',
            sender_avatar: senderResult.rows[0]?.avatar || null,
        };

        res.status(201).json({ success: true, message });
    } catch (err) {
        console.error('  ❌ Send message error:', err.message);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// ═══════════════════════════════════════════════
//  POST /rooms — Create new chat room
// ═══════════════════════════════════════════════
router.post('/rooms', async (req, res) => {
    try {
        const { name, description, type, members } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Room name is required' });
        }

        const result = await req.committeeDb.query(
            `INSERT INTO chat_rooms (name, description, type, created_by, members)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                name,
                description || '',
                type || 'group',
                req.user.id,
                members || [],
            ]
        );

        res.status(201).json({ success: true, room: result.rows[0] });
    } catch (err) {
        console.error('  ❌ Create room error:', err.message);
        res.status(500).json({ error: 'Failed to create chat room' });
    }
});

// ═══════════════════════════════════════════════
//  PATCH /rooms/:roomId — Update chat room
// ═══════════════════════════════════════════════
router.patch('/rooms/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { name, description, is_archived } = req.body;

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(name);
        }
        if (description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(description);
        }
        if (is_archived !== undefined) {
            updates.push(`is_archived = $${paramIndex++}`);
            values.push(is_archived);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(roomId);

        const result = await req.committeeDb.query(
            `UPDATE chat_rooms SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Chat room not found' });
        }

        res.json({ success: true, room: result.rows[0] });
    } catch (err) {
        console.error('  ❌ Update room error:', err.message);
        res.status(500).json({ error: 'Failed to update chat room' });
    }
});

module.exports = router;
