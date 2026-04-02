// ============================================
// routes/channels.js — Channel Management
// ============================================
// GET  /              — list visible channels (public + user's DMs)
// POST /              — create public channel (role-gated)
// POST /dm            — find-or-create DM (dedup)
// DELETE /:id         — delete non-default, non-DM channel
// ============================================

const express = require('express');
const router = express.Router();

// ══════════════════════════════════════════════════
// AUTO-MIGRATION: Runs once per DB on first request.
// Uses simple try/catch per statement instead of PL/pgSQL.
// ══════════════════════════════════════════════════
const migratedDbs = new Set();

async function ensureChatSchema(db) {
    const key = db.options?.database || 'unknown';
    if (migratedDbs.has(key)) return;

    console.log(`🔧 Running chat schema migration for: ${key}`);

    try {
        // 1. Create channels table if missing
        await db.query(`
            CREATE TABLE IF NOT EXISTS channels (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(100),
                description TEXT DEFAULT '',
                type VARCHAR(20) DEFAULT 'text',
                is_default BOOLEAN DEFAULT false,
                created_by UUID,
                participants UUID[] DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log('  ✅ channels table ready');
    } catch (err) {
        console.error('  ⚠️ channels table creation:', err.message);
    }

    // 2. Add participants column if channels exists but column is missing
    try {
        const colCheck = await db.query(`
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'channels' AND column_name = 'participants'
        `);
        if (colCheck.rows.length === 0) {
            await db.query(`ALTER TABLE channels ADD COLUMN participants UUID[] DEFAULT '{}'`);
            console.log('  ✅ Added participants column');
        }
    } catch (err) {
        console.error('  ⚠️ participants column:', err.message);
    }

    // 3. Fix type constraint to allow 'dm'
    try {
        await db.query(`ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_type_check`);
        await db.query(`ALTER TABLE channels ADD CONSTRAINT channels_type_check CHECK (type IN ('text', 'announcement', 'dm'))`);
        console.log('  ✅ type constraint updated');
    } catch (err) {
        // Constraint might already exist — that's fine
        console.log('  ℹ️ type constraint:', err.message);
    }

    // 4. Add new columns to messages table (one by one, catching individually)
    const messageCols = [
        ['channel_id', 'UUID'],
        ['user_id', 'UUID'],
        ['user_name', 'VARCHAR(255)'],
        ['user_role', 'VARCHAR(50)'],
        ['text', 'TEXT'],
        ['is_deleted', 'BOOLEAN DEFAULT false'],
        ['is_edited', 'BOOLEAN DEFAULT false'],
    ];
    for (const [colName, colType] of messageCols) {
        try {
            const check = await db.query(
                `SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = $1`,
                [colName]
            );
            if (check.rows.length === 0) {
                await db.query(`ALTER TABLE messages ADD COLUMN ${colName} ${colType}`);
                console.log(`  ✅ Added messages.${colName}`);
            }
        } catch (err) {
            console.error(`  ⚠️ messages.${colName}:`, err.message);
        }
    }

    // 5. Drop room_id FK constraint so new messages don't need chat_rooms
    try {
        // Find the FK constraint name dynamically
        const fkResult = await db.query(`
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'messages'
              AND tc.constraint_type = 'FOREIGN KEY'
              AND kcu.column_name = 'room_id'
        `);
        for (const row of fkResult.rows) {
            await db.query(`ALTER TABLE messages DROP CONSTRAINT IF EXISTS "${row.constraint_name}"`);
            console.log(`  ✅ Dropped FK: ${row.constraint_name}`);
        }
    } catch (err) {
        console.error('  ⚠️ FK drop:', err.message);
    }

    // 6. Make room_id nullable
    try {
        const nullCheck = await db.query(`
            SELECT is_nullable FROM information_schema.columns
            WHERE table_name = 'messages' AND column_name = 'room_id'
        `);
        if (nullCheck.rows.length > 0 && nullCheck.rows[0].is_nullable === 'NO') {
            await db.query(`ALTER TABLE messages ALTER COLUMN room_id DROP NOT NULL`);
            console.log('  ✅ Made room_id nullable');
        }
    } catch (err) {
        console.error('  ⚠️ room_id nullable:', err.message);
    }

    // 6b. Drop sender_id FK and make sender_id + content nullable (new chat uses user_id + text)
    try {
        const senderFkResult = await db.query(`
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'messages'
              AND tc.constraint_type = 'FOREIGN KEY'
              AND kcu.column_name = 'sender_id'
        `);
        for (const row of senderFkResult.rows) {
            await db.query(`ALTER TABLE messages DROP CONSTRAINT IF EXISTS "${row.constraint_name}"`);
            console.log(`  ✅ Dropped sender_id FK: ${row.constraint_name}`);
        }
    } catch (err) {
        console.error('  ⚠️ sender_id FK drop:', err.message);
    }

    try {
        const senderNullCheck = await db.query(`
            SELECT is_nullable FROM information_schema.columns
            WHERE table_name = 'messages' AND column_name = 'sender_id'
        `);
        if (senderNullCheck.rows.length > 0 && senderNullCheck.rows[0].is_nullable === 'NO') {
            await db.query(`ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL`);
            console.log('  ✅ Made sender_id nullable');
        }
    } catch (err) {
        console.error('  ⚠️ sender_id nullable:', err.message);
    }

    try {
        const contentNullCheck = await db.query(`
            SELECT is_nullable FROM information_schema.columns
            WHERE table_name = 'messages' AND column_name = 'content'
        `);
        if (contentNullCheck.rows.length > 0 && contentNullCheck.rows[0].is_nullable === 'NO') {
            await db.query(`ALTER TABLE messages ALTER COLUMN content DROP NOT NULL`);
            console.log('  ✅ Made content nullable');
        }
    } catch (err) {
        console.error('  ⚠️ content nullable:', err.message);
    }

    // 7. Seed default channels
    try {
        const genCheck = await db.query(`SELECT id FROM channels WHERE slug = 'general'`);
        if (genCheck.rows.length === 0) {
            await db.query(`
                INSERT INTO channels (name, slug, type, is_default, created_by)
                VALUES ('general', 'general', 'text', true, uuid_generate_v4())
            `);
            console.log('  ✅ Seeded general channel');
        }
    } catch (err) {
        console.error('  ⚠️ Seed general:', err.message);
    }

    try {
        const annCheck = await db.query(`SELECT id FROM channels WHERE slug = 'announcements'`);
        if (annCheck.rows.length === 0) {
            await db.query(`
                INSERT INTO channels (name, slug, type, is_default, created_by)
                VALUES ('announcements', 'announcements', 'announcement', true, uuid_generate_v4())
            `);
            console.log('  ✅ Seeded announcements channel');
        }
    } catch (err) {
        console.error('  ⚠️ Seed announcements:', err.message);
    }

    // 8. Create indexes
    try {
        await db.query(`CREATE INDEX IF NOT EXISTS idx_channels_slug ON channels(slug)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(type)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages(channel_id, created_at ASC)`);
        console.log('  ✅ Indexes ready');
    } catch (err) {
        console.error('  ⚠️ Indexes:', err.message);
    }

    // 9. Fix announcements table — add missing columns
    const announcementCols = [
        ['created_by_name', 'VARCHAR(255)'],
        ['created_by_role', 'VARCHAR(50)'],
    ];
    for (const [colName, colType] of announcementCols) {
        try {
            const check = await db.query(
                `SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = $1`,
                [colName]
            );
            if (check.rows.length === 0) {
                await db.query(`ALTER TABLE announcements ADD COLUMN ${colName} ${colType}`);
                console.log(`  ✅ Added announcements.${colName}`);
            }
        } catch (err) {
            console.error(`  ⚠️ announcements.${colName}:`, err.message);
        }
    }

    // 10. Fix announcements priority constraint to include 'important'
    try {
        await db.query(`ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_priority_check`);
        await db.query(`ALTER TABLE announcements ADD CONSTRAINT announcements_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'important'))`);
        console.log('  ✅ announcements priority constraint updated');
    } catch (err) {
        console.error('  ⚠️ announcements priority constraint:', err.message);
    }

    // 11. Fix notifications type constraint to include 'announcement' and 'dm_message'
    try {
        await db.query(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check`);
        await db.query(`ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('info', 'success', 'warning', 'error', 'mention', 'task', 'task_assigned', 'file', 'meeting', 'meeting_invite', 'announcement', 'dm_message'))`);
        console.log('  ✅ notifications type constraint updated');
    } catch (err) {
        console.error('  ⚠️ notifications type constraint:', err.message);
    }

    migratedDbs.add(key);
    console.log(`✅ Chat schema migration complete for: ${key}`);
}

// ══════════════════════════════════════════════════
// GET / — List channels visible to current user
// ══════════════════════════════════════════════════
router.get('/', async (req, res) => {
    try {
        const db = req.committeeDb;
        const userId = req.user.userId;

        await ensureChatSchema(db);

        // Public channels (text + announcement) for everyone
        // DM channels only where user is a participant
        const result = await db.query(`
            SELECT c.*,
                (
                    SELECT COUNT(*) FROM messages m
                    WHERE m.channel_id = c.id AND (m.is_deleted = false OR m.is_deleted IS NULL)
                ) AS message_count,
                (
                    SELECT m.created_at FROM messages m
                    WHERE m.channel_id = c.id AND (m.is_deleted = false OR m.is_deleted IS NULL)
                    ORDER BY m.created_at DESC LIMIT 1
                ) AS last_message_at,
                (
                    SELECT COALESCE(m.text, m.content) FROM messages m
                    WHERE m.channel_id = c.id AND (m.is_deleted = false OR m.is_deleted IS NULL)
                    ORDER BY m.created_at DESC LIMIT 1
                ) AS last_message_preview,
                (
                    SELECT COALESCE(m.user_name, '') FROM messages m
                    WHERE m.channel_id = c.id AND (m.is_deleted = false OR m.is_deleted IS NULL)
                    ORDER BY m.created_at DESC LIMIT 1
                ) AS last_message_sender
            FROM channels c
            WHERE
                c.type IN ('text', 'announcement')
                OR (c.type = 'dm' AND $1 = ANY(c.participants))
            ORDER BY
                c.is_default DESC,
                c.type ASC,
                last_message_at DESC NULLS LAST,
                c.created_at ASC
        `, [userId]);

        const channels = result.rows;
        const dmChannels = channels.filter(c => c.type === 'dm');

        // Enrich DM channels with the other participant's info
        if (dmChannels.length > 0) {
            const otherUserIds = [];
            dmChannels.forEach(ch => {
                if (ch.participants && ch.participants.length > 0) {
                    const otherId = ch.participants.find(p => p !== userId);
                    if (otherId) otherUserIds.push(otherId);
                }
            });

            if (otherUserIds.length > 0) {
                const uniqueIds = [...new Set(otherUserIds)];
                const usersResult = await req.masterDb.query(
                    `SELECT id, name, avatar, email FROM users WHERE id = ANY($1)`,
                    [uniqueIds]
                );
                const usersMap = {};
                usersResult.rows.forEach(u => { usersMap[u.id] = u; });

                dmChannels.forEach(ch => {
                    const otherId = ch.participants.find(p => p !== userId);
                    const otherUser = usersMap[otherId];
                    ch.dm_user = otherUser ? {
                        id: otherUser.id,
                        name: otherUser.name,
                        avatar: otherUser.avatar,
                        email: otherUser.email,
                    } : { id: otherId, name: 'Unknown User', avatar: null, email: '' };
                    ch.display_name = ch.dm_user.name;
                });
            }
        }

        res.json({ success: true, channels });
    } catch (err) {
        console.error('List channels error:', err.message, err.stack);
        res.status(500).json({ error: 'Failed to list channels: ' + err.message });
    }
});

// ══════════════════════════════════════════════════
// POST / — Create a PUBLIC channel (text or announcement)
// ══════════════════════════════════════════════════
router.post('/', async (req, res) => {
    try {
        const db = req.committeeDb;
        const { name, description, type } = req.body;

        await ensureChatSchema(db);

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Channel name is required' });
        }

        if (!['head', 'admin', 'faculty'].includes(req.committeeRole)) {
            return res.status(403).json({ error: 'Only faculty, heads, and admins can create channels' });
        }

        if (type === 'dm') {
            return res.status(400).json({ error: 'Use POST /api/channels/dm to create DM channels' });
        }

        const channelType = type === 'announcement' ? 'announcement' : 'text';
        const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const existing = await db.query('SELECT id FROM channels WHERE slug = $1', [slug]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'A channel with this name already exists' });
        }

        const result = await db.query(
            `INSERT INTO channels (name, slug, description, type, is_default, created_by)
             VALUES ($1, $2, $3, $4, false, $5)
             RETURNING *`,
            [name.trim(), slug, description || '', channelType, req.user.userId]
        );

        res.json({ success: true, channel: result.rows[0] });
    } catch (err) {
        console.error('Create channel error:', err.message);
        res.status(500).json({ error: 'Failed to create channel: ' + err.message });
    }
});

// ══════════════════════════════════════════════════
// POST /dm — Find-or-create a DM channel (DEDUP)
// ══════════════════════════════════════════════════
router.post('/dm', async (req, res) => {
    try {
        const db = req.committeeDb;
        const currentUserId = req.user.userId;
        const otherUserId = req.body.userId;

        if (!otherUserId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        if (currentUserId === otherUserId) {
            return res.status(400).json({ error: 'Cannot create a DM with yourself' });
        }

        await ensureChatSchema(db);

        // Verify the other user exists
        const userCheck = await req.masterDb.query(
            `SELECT id, name, avatar, email FROM users WHERE id = $1`,
            [otherUserId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const otherUser = userCheck.rows[0];

        // ═══ FIND EXISTING DM ═══
        const existingDm = await db.query(
            `SELECT * FROM channels
             WHERE type = 'dm'
               AND $1 = ANY(participants)
               AND $2 = ANY(participants)
               AND array_length(participants, 1) = 2
             ORDER BY created_at ASC
             LIMIT 1`,
            [currentUserId, otherUserId]
        );

        if (existingDm.rows.length > 0) {
            const channel = existingDm.rows[0];
            channel.dm_user = {
                id: otherUser.id,
                name: otherUser.name,
                avatar: otherUser.avatar,
                email: otherUser.email,
            };
            channel.display_name = otherUser.name;

            console.log(`✅ Found existing DM ${channel.id}`);
            return res.json({ success: true, channel, created: false });
        }

        // ═══ CREATE NEW DM ═══
        const participantsSorted = [currentUserId, otherUserId].sort();

        const currentUserResult = await req.masterDb.query(
            'SELECT name FROM users WHERE id = $1', [currentUserId]
        );
        const currentUserName = currentUserResult.rows[0]?.name || 'User';

        const channelName = `${currentUserName} & ${otherUser.name}`;
        const slug = `dm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

        const result = await db.query(
            `INSERT INTO channels (name, slug, type, is_default, created_by, participants)
             VALUES ($1, $2, 'dm', false, $3, $4::uuid[])
             RETURNING *`,
            [channelName, slug, currentUserId, participantsSorted]
        );

        const channel = result.rows[0];
        channel.dm_user = {
            id: otherUser.id,
            name: otherUser.name,
            avatar: otherUser.avatar,
            email: otherUser.email,
        };
        channel.display_name = otherUser.name;

        console.log(`✅ Created new DM ${channel.id}`);
        res.json({ success: true, channel, created: true });
    } catch (err) {
        console.error('DM error:', err.message, err.stack);
        res.status(500).json({ error: 'Failed to create DM: ' + err.message });
    }
});

// ══════════════════════════════════════════════════
// DELETE /:id — Delete a channel (head/admin only)
// ══════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
    try {
        const db = req.committeeDb;
        const channelId = req.params.id;

        if (!['head', 'admin'].includes(req.committeeRole)) {
            return res.status(403).json({ error: 'Only heads and admins can delete channels' });
        }

        const channel = await db.query('SELECT * FROM channels WHERE id = $1', [channelId]);
        if (channel.rows.length === 0) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        if (channel.rows[0].is_default) {
            return res.status(400).json({ error: 'Cannot delete default channels' });
        }

        if (channel.rows[0].type === 'dm') {
            return res.status(400).json({ error: 'Cannot delete DM channels' });
        }

        await db.query('DELETE FROM channels WHERE id = $1', [channelId]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete channel error:', err.message);
        res.status(500).json({ error: 'Failed to delete channel.' });
    }
});

module.exports = router;
