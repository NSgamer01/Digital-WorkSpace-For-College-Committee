// ============================================
// routes/chat.js — Messages with Access Control
// ============================================
// GET    /:channelId                    — fetch messages (incremental polling)
// POST   /:channelId                    — send message
// PATCH  /:channelId/:messageId         — edit message
// DELETE /:channelId/:messageId         — soft-delete message
// POST   /admin/cleanup-duplicate-dms   — one-time DM dedup cleanup
// ============================================

const express = require('express');
const router = express.Router();

// ── Helper: reliably fetch user name from masterDb ──
async function getUserName(masterDb, userId) {
    try {
        const result = await masterDb.query(
            'SELECT name, email FROM users WHERE id = $1',
            [userId]
        );
        if (result.rows.length > 0) {
            return result.rows[0].name || result.rows[0].email.split('@')[0];
        }
        return 'Unknown User';
    } catch (err) {
        console.error('Failed to fetch user name:', err.message);
        return 'Unknown User';
    }
}

// ── Helper: verify user can access a channel ──
async function checkChannelAccess(db, channelId, userId, committeeRole) {
    const result = await db.query('SELECT * FROM channels WHERE id = $1', [channelId]);

    if (result.rows.length === 0) {
        return { allowed: false, status: 404, error: 'Channel not found', channel: null };
    }

    const channel = result.rows[0];

    // Public channels: all committee members can access
    if (channel.type === 'text' || channel.type === 'announcement') {
        return { allowed: true, channel };
    }

    // DM channels: only participants can access
    if (channel.type === 'dm') {
        const isParticipant = channel.participants && channel.participants.includes(userId);
        const isAdmin = ['head', 'admin'].includes(committeeRole);

        if (!isParticipant && !isAdmin) {
            return { allowed: false, status: 403, error: 'You do not have access to this conversation', channel };
        }
        return { allowed: true, channel };
    }

    return { allowed: true, channel };
}

// ══════════════════════════════════════════════════
// POST /admin/cleanup-duplicate-dms — One-time cleanup
// (MUST be before /:channelId to avoid route conflict)
// ══════════════════════════════════════════════════
router.post('/admin/cleanup-duplicate-dms', async (req, res) => {
    try {
        if (!['head', 'admin'].includes(req.committeeRole)) {
            return res.status(403).json({ error: 'Admin only' });
        }

        const db = req.committeeDb;

        const allDms = await db.query(
            `SELECT id, participants, created_at FROM channels WHERE type = 'dm' ORDER BY created_at ASC`
        );

        const groups = {};
        allDms.rows.forEach(ch => {
            if (!ch.participants || ch.participants.length !== 2) return;
            const key = [...ch.participants].sort().join('|');
            if (!groups[key]) groups[key] = [];
            groups[key].push(ch);
        });

        let mergedCount = 0;
        let deletedCount = 0;

        for (const [, channels] of Object.entries(groups)) {
            if (channels.length <= 1) continue;

            const keepChannel = channels[0];
            const duplicates = channels.slice(1);

            for (const dupChannel of duplicates) {
                const moveResult = await db.query(
                    `UPDATE messages SET channel_id = $1 WHERE channel_id = $2`,
                    [keepChannel.id, dupChannel.id]
                );
                mergedCount += moveResult.rowCount;
                await db.query('DELETE FROM channels WHERE id = $1', [dupChannel.id]);
                deletedCount++;
            }
        }

        console.log(`✅ DM cleanup: merged ${mergedCount} messages, deleted ${deletedCount} duplicate channels`);
        res.json({ success: true, mergedMessages: mergedCount, deletedChannels: deletedCount });
    } catch (err) {
        console.error('DM cleanup error:', err.message);
        res.status(500).json({ error: 'Failed to cleanup duplicate DMs.' });
    }
});

// ══════════════════════════════════════════════════
// GET /:channelId — Fetch messages (with incremental polling)
// ══════════════════════════════════════════════════
router.get('/:channelId', async (req, res) => {
    try {
        const db = req.committeeDb;
        const { channelId } = req.params;
        const userId = req.user.userId;
        const { limit = 50, before, after } = req.query;

        // ═══ ACCESS CHECK ═══
        const access = await checkChannelAccess(db, channelId, userId, req.committeeRole);
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.error });
        }

        const channel = access.channel;
        const parsedLimit = Math.min(parseInt(limit) || 50, 100);

        // Use COALESCE to read from both old and new column names
        let query;
        let params;

        if (after) {
            // ═══ INCREMENTAL POLLING ═══
            query = `
                SELECT id, channel_id, user_id, user_name, user_role,
                       COALESCE(text, content) as text,
                       is_edited, is_deleted, created_at, updated_at
                FROM messages
                WHERE channel_id = $1
                  AND created_at > $2
                  AND (is_deleted = false OR is_deleted IS NULL)
                ORDER BY created_at ASC
                LIMIT $3
            `;
            params = [channelId, after, parsedLimit];
        } else if (before) {
            // ═══ PAGINATION ═══
            query = `
                SELECT id, channel_id, user_id, user_name, user_role,
                       COALESCE(text, content) as text,
                       is_edited, is_deleted, created_at, updated_at
                FROM messages
                WHERE channel_id = $1
                  AND created_at < $2
                  AND (is_deleted = false OR is_deleted IS NULL)
                ORDER BY created_at DESC
                LIMIT $3
            `;
            params = [channelId, before, parsedLimit];
        } else {
            // ═══ INITIAL LOAD ═══
            query = `
                SELECT id, channel_id, user_id, user_name, user_role,
                       COALESCE(text, content) as text,
                       is_edited, is_deleted, created_at, updated_at
                FROM messages
                WHERE channel_id = $1
                  AND (is_deleted = false OR is_deleted IS NULL)
                ORDER BY created_at DESC
                LIMIT $2
            `;
            params = [channelId, parsedLimit];
        }

        const result = await db.query(query, params);
        let messages = result.rows;

        // For initial load and pagination: reverse to ascending order
        if (!after) {
            messages = messages.reverse();
        }

        // ═══ BACKFILL MISSING NAMES ═══
        const messagesWithMissingNames = messages.filter(m => !m.user_name || m.user_name === '');
        if (messagesWithMissingNames.length > 0) {
            const missingUserIds = [...new Set(messagesWithMissingNames.map(m => m.user_id).filter(Boolean))];

            if (missingUserIds.length > 0) {
                const usersResult = await req.masterDb.query(
                    'SELECT id, name, email FROM users WHERE id = ANY($1)',
                    [missingUserIds]
                );
                const namesMap = {};
                usersResult.rows.forEach(u => {
                    namesMap[u.id] = u.name || u.email.split('@')[0];
                });

                messages.forEach(m => {
                    if (!m.user_name || m.user_name === '') {
                        m.user_name = namesMap[m.user_id] || 'Unknown User';
                    }
                });

                // Async backfill in DB (fire-and-forget)
                messagesWithMissingNames.forEach(m => {
                    const name = namesMap[m.user_id];
                    if (name) {
                        db.query(
                            "UPDATE messages SET user_name = $1 WHERE id = $2 AND (user_name IS NULL OR user_name = '')",
                            [name, m.id]
                        ).catch(() => { });
                    }
                });
            }
        }

        // Check for older messages
        let hasMore = false;
        if (messages.length > 0 && !after) {
            const oldestTimestamp = messages[0].created_at;
            const olderCheck = await db.query(
                'SELECT EXISTS(SELECT 1 FROM messages WHERE channel_id = $1 AND created_at < $2 AND (is_deleted = false OR is_deleted IS NULL)) AS has_more',
                [channelId, oldestTimestamp]
            );
            hasMore = olderCheck.rows[0]?.has_more || false;
        }

        res.json({
            success: true,
            messages,
            hasMore,
            channelType: channel.type,
        });
    } catch (err) {
        console.error('Fetch messages error:', err.message);
        res.status(500).json({ error: 'Failed to fetch messages: ' + err.message });
    }
});

// ══════════════════════════════════════════════════
// POST /:channelId — Send a message
// ══════════════════════════════════════════════════
router.post('/:channelId', async (req, res) => {
    try {
        const db = req.committeeDb;
        const { channelId } = req.params;
        const userId = req.user.userId;
        const { text } = req.body;

        // ═══ VALIDATION ═══
        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ error: 'Message text is required' });
        }

        if (text.trim().length > 4000) {
            return res.status(400).json({ error: 'Message too long. Maximum 4000 characters.' });
        }

        // ═══ ACCESS CHECK ═══
        const access = await checkChannelAccess(db, channelId, userId, req.committeeRole);
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.error });
        }

        const channel = access.channel;

        // ═══ ANNOUNCEMENT CHANNEL — ROLE CHECK ═══
        if (channel.type === 'announcement') {
            if (!['head', 'admin', 'faculty'].includes(req.committeeRole)) {
                return res.status(403).json({
                    error: 'Only faculty, heads, and admins can post in announcement channels'
                });
            }
        }

        // ═══ GET USER NAME ═══
        const userName = await getUserName(req.masterDb, userId);
        const userRole = req.committeeRole || 'member';

        // ═══ INSERT MESSAGE ═══
        const result = await db.query(
            `INSERT INTO messages (channel_id, user_id, user_name, user_role, text, content, is_deleted)
             VALUES ($1, $2, $3, $4, $5, $5, false)
             RETURNING id, channel_id, user_id, user_name, user_role, text, is_edited, is_deleted, created_at, updated_at`,
            [channelId, userId, userName, userRole, text.trim()]
        );

        const message = result.rows[0];
        console.log(`✅ Message sent in channel ${channelId} by ${userName}`);

        // ═══ DM NOTIFICATION (fire-and-forget) ═══
        if (channel.type === 'dm' && channel.participants) {
            const otherUserId = channel.participants.find(p => p !== userId);
            if (otherUserId) {
                db.query(
                    `INSERT INTO notifications (user_id, type, title, message, link)
                     VALUES ($1, 'dm_message', $2, $3, $4)`,
                    [
                        otherUserId,
                        `💬 ${userName}`,
                        text.trim().substring(0, 100) + (text.trim().length > 100 ? '...' : ''),
                        `/messages?dm=${channelId}`
                    ]
                ).catch(err => console.error('DM notification failed:', err.message));
            }
        }

        res.json({ success: true, message });
    } catch (err) {
        console.error('Send message error:', err.message, err.stack);
        res.status(500).json({ error: 'Failed to send message: ' + err.message });
    }
});

// ══════════════════════════════════════════════════
// PATCH /:channelId/:messageId — Edit a message
// ══════════════════════════════════════════════════
router.patch('/:channelId/:messageId', async (req, res) => {
    try {
        const db = req.committeeDb;
        const { channelId, messageId } = req.params;
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Message text is required' });
        }

        const access = await checkChannelAccess(db, channelId, req.user.userId, req.committeeRole);
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.error });
        }

        const result = await db.query(
            `UPDATE messages
             SET text = $1, content = $1, is_edited = true, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND channel_id = $3 AND user_id = $4 AND (is_deleted = false OR is_deleted IS NULL)
             RETURNING id, channel_id, user_id, user_name, user_role, text, is_edited, is_deleted, created_at, updated_at`,
            [text.trim(), messageId, channelId, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Message not found or you are not the author' });
        }

        res.json({ success: true, message: result.rows[0] });
    } catch (err) {
        console.error('Edit message error:', err.message);
        res.status(500).json({ error: 'Failed to edit message.' });
    }
});

// ══════════════════════════════════════════════════
// DELETE /:channelId/:messageId — Soft-delete a message
// ══════════════════════════════════════════════════
router.delete('/:channelId/:messageId', async (req, res) => {
    try {
        const db = req.committeeDb;
        const { channelId, messageId } = req.params;

        const access = await checkChannelAccess(db, channelId, req.user.userId, req.committeeRole);
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.error });
        }

        let result;
        if (['head', 'admin'].includes(req.committeeRole)) {
            result = await db.query(
                `UPDATE messages SET is_deleted = true, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND channel_id = $2 RETURNING id`,
                [messageId, channelId]
            );
        } else {
            result = await db.query(
                `UPDATE messages SET is_deleted = true, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND channel_id = $2 AND user_id = $3 RETURNING id`,
                [messageId, channelId, req.user.userId]
            );
        }

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Message not found or not authorized' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Delete message error:', err.message);
        res.status(500).json({ error: 'Failed to delete message.' });
    }
});

module.exports = router;
