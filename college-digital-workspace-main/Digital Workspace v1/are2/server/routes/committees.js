// ============================================
// routes/committees.js
// ============================================
// Committee management routes.
// Uses masterDb for membership data and
// committeeDbManager for committee-specific stats.
// All routes require authMiddleware (mounted in server.js).
// ============================================

const express = require('express');
const router = express.Router();
const masterDb = require('../config/masterDb');
const committeeDbManager = require('../config/committeeDbManager');

// ── Role hierarchy for ordering ─────────────────
const ROLE_ORDER = ['head', 'advisor', 'admin', 'coordinator', 'secretary', 'treasurer', 'volunteer', 'member'];

// ══════════════════════════════════════════════════
// GET / — List all committees
// ══════════════════════════════════════════════════
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await masterDb.query(`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM committee_members cm WHERE cm.committee_id = c.id AND cm.is_active = true) AS member_count,
        (SELECT cm2.role FROM committee_members cm2 WHERE cm2.committee_id = c.id AND cm2.user_id = $1 AND cm2.is_active = true) AS my_role,
        (SELECT CASE WHEN EXISTS(SELECT 1 FROM committee_members cm3 WHERE cm3.committee_id = c.id AND cm3.user_id = $1 AND cm3.is_active = true) THEN true ELSE false END) AS is_member
      FROM committees c
      WHERE c.is_active = true
      ORDER BY c.name ASC
    `, [userId]);

        res.json({
            success: true,
            committees: result.rows.map(row => ({
                id: row.id,
                name: row.name,
                fullName: row.full_name,
                slug: row.slug,
                description: row.description,
                logo: row.logo,
                color: row.color,
                icon: row.icon,
                memberCount: parseInt(row.member_count) || 0,
                myRole: row.my_role || null,
                isMember: row.is_member === true,
                storageLimit: row.storage_limit,
                storageUsed: row.storage_used,
                isActive: row.is_active,
                createdAt: row.created_at,
            })),
        });
    } catch (err) {
        console.error('List committees error:', err.message);
        res.status(500).json({ error: 'Failed to fetch committees.' });
    }
});
// ══════════════════════════════════════════════════
// GET /mine — List committees the current user belongs to
// ══════════════════════════════════════════════════
router.get('/mine', async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await masterDb.query(
            `SELECT c.id, c.name, c.full_name, c.slug, c.description,
                    c.color, c.icon, c.db_name,
                    cm.role, cm.position, cm.joined_at, cm.is_active
             FROM committee_members cm
             JOIN committees c ON c.id = cm.committee_id
             WHERE cm.user_id = $1 AND cm.is_active = true AND c.is_active = true
             ORDER BY cm.joined_at ASC`,
            [userId]
        );

        res.json({
            success: true,
            committees: result.rows,
            total: result.rowCount,
        });
    } catch (err) {
        console.error('List my committees error:', err.message);
        res.status(500).json({ error: 'Failed to fetch your committees.' });
    }
});

// ══════════════════════════════════════════════════
// GET /members — List members of the current committee
// ══════════════════════════════════════════════════
// Frontend sends X-Committee-Slug header; this route
// reads it, looks up the committee, and returns members.
router.get('/members', async (req, res) => {
    try {
        const slug = req.headers['x-committee-slug']
            || req.query.committeeSlug;

        if (!slug) {
            return res.status(400).json({
                error: 'Committee slug is required. Send X-Committee-Slug header.',
            });
        }

        // Get committee
        const committeeResult = await masterDb.query(
            `SELECT id, name FROM committees WHERE slug = $1 AND is_active = true`,
            [slug.toLowerCase()]
        );

        if (committeeResult.rowCount === 0) {
            return res.status(404).json({ error: `Committee "${slug}" not found.` });
        }

        const committee = committeeResult.rows[0];

        // Get members with user details
        const membersResult = await masterDb.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.avatar,
        u.department,
        u.phone,
        u.is_online,
        u.last_seen,
        cm.role,
        cm.position,
        cm.joined_at,
        cm.is_active
      FROM committee_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.committee_id = $1 AND cm.is_active = true
      ORDER BY
        CASE cm.role
          WHEN 'head' THEN 1
          WHEN 'advisor' THEN 2
          WHEN 'admin' THEN 3
          WHEN 'coordinator' THEN 4
          WHEN 'secretary' THEN 5
          WHEN 'treasurer' THEN 6
          WHEN 'volunteer' THEN 7
          WHEN 'member' THEN 8
          ELSE 9
        END,
        cm.joined_at ASC
    `, [committee.id]);

        res.json({
            success: true,
            members: membersResult.rows.map(m => ({
                id: m.id,
                name: m.name,
                email: m.email,
                avatar: m.avatar,
                department: m.department,
                phone: m.phone,
                isOnline: m.is_online,
                lastSeen: m.last_seen,
                role: m.role,
                position: m.position,
                joinedAt: m.joined_at,
            })),
            total: membersResult.rowCount,
        });
    } catch (err) {
        console.error('List members error:', err.message);
        res.status(500).json({ error: 'Failed to fetch members.' });
    }
});

// ══════════════════════════════════════════════════
// GET /mine — List user's committees
// ══════════════════════════════════════════════════
router.get('/mine', async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get user's last committee slug
        const userResult = await masterDb.query(
            `SELECT last_committee_slug FROM users WHERE id = $1`,
            [userId]
        );
        const lastCommitteeSlug = userResult.rows[0]?.last_committee_slug || null;

        const result = await masterDb.query(`
      SELECT
        c.id,
        c.name,
        c.full_name,
        c.slug,
        c.description,
        c.logo,
        c.color,
        c.icon,
        c.db_name,
        cm.role,
        cm.position,
        cm.joined_at,
        (SELECT COUNT(*) FROM committee_members cm2 WHERE cm2.committee_id = c.id AND cm2.is_active = true) AS member_count
      FROM committee_members cm
      JOIN committees c ON c.id = cm.committee_id
      WHERE cm.user_id = $1 AND cm.is_active = true AND c.is_active = true
      ORDER BY cm.joined_at ASC
    `, [userId]);

        res.json({
            success: true,
            committees: result.rows.map(row => ({
                id: row.id,
                name: row.name,
                fullName: row.full_name,
                slug: row.slug,
                description: row.description,
                logo: row.logo,
                color: row.color,
                icon: row.icon,
                role: row.role,
                position: row.position,
                joinedAt: row.joined_at,
                memberCount: parseInt(row.member_count) || 0,
            })),
            lastCommitteeSlug,
        });
    } catch (err) {
        console.error('List my committees error:', err.message);
        res.status(500).json({ error: 'Failed to fetch your committees.' });
    }
});

// ══════════════════════════════════════════════════
// GET /:slug/details — Full committee info with stats
// ══════════════════════════════════════════════════
router.get('/:slug/details', async (req, res) => {
    try {
        const { slug } = req.params;
        const userId = req.user.userId;

        // Get committee
        const committeeResult = await masterDb.query(
            `SELECT * FROM committees WHERE slug = $1 AND is_active = true`,
            [slug.toLowerCase()]
        );

        if (committeeResult.rowCount === 0) {
            return res.status(404).json({ error: `Committee "${slug}" not found.` });
        }

        const committee = committeeResult.rows[0];

        // Get members with user details, ordered by role hierarchy
        const membersResult = await masterDb.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.avatar,
        cm.role,
        cm.position,
        cm.joined_at,
        cm.is_active
      FROM committee_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.committee_id = $1 AND cm.is_active = true
      ORDER BY
        CASE cm.role
          WHEN 'head' THEN 1
          WHEN 'advisor' THEN 2
          WHEN 'admin' THEN 3
          WHEN 'coordinator' THEN 4
          WHEN 'secretary' THEN 5
          WHEN 'treasurer' THEN 6
          WHEN 'volunteer' THEN 7
          WHEN 'member' THEN 8
          ELSE 9
        END,
        cm.joined_at ASC
    `, [committee.id]);

        // Get stats from committee database
        let stats = {
            file_count: 0,
            folder_count: 0,
            task_count: 0,
            meeting_count: 0,
            announcement_count: 0,
            message_count: 0,
        };

        if (committeeDbManager.isValidCommittee(slug)) {
            try {
                const statsResult = await committeeDbManager.query(slug, `
          SELECT
            (SELECT COUNT(*) FROM files WHERE is_trashed = false) AS file_count,
            (SELECT COUNT(*) FROM folders WHERE is_trashed = false) AS folder_count,
            (SELECT COUNT(*) FROM tasks) AS task_count,
            (SELECT COUNT(*) FROM meetings) AS meeting_count,
            (SELECT COUNT(*) FROM announcements) AS announcement_count,
            (SELECT COUNT(*) FROM messages WHERE is_deleted = false) AS message_count
        `);
                stats = statsResult.rows[0];
            } catch (dbErr) {
                console.error(`Failed to get stats for ${slug}:`, dbErr.message);
            }
        }

        res.json({
            success: true,
            committee: {
                id: committee.id,
                name: committee.name,
                fullName: committee.full_name,
                slug: committee.slug,
                description: committee.description,
                logo: committee.logo,
                color: committee.color,
                icon: committee.icon,
                storageLimit: committee.storage_limit,
                storageUsed: committee.storage_used,
                maxMembers: committee.max_members,
                isActive: committee.is_active,
                createdAt: committee.created_at,
            },
            members: membersResult.rows.map(m => ({
                id: m.id,
                name: m.name,
                email: m.email,
                avatar: m.avatar,
                role: m.role,
                position: m.position,
                joinedAt: m.joined_at,
            })),
            stats: {
                fileCount: parseInt(stats.file_count) || 0,
                folderCount: parseInt(stats.folder_count) || 0,
                taskCount: parseInt(stats.task_count) || 0,
                meetingCount: parseInt(stats.meeting_count) || 0,
                announcementCount: parseInt(stats.announcement_count) || 0,
                messageCount: parseInt(stats.message_count) || 0,
                memberCount: membersResult.rowCount,
            },
        });
    } catch (err) {
        console.error('Committee details error:', err.message);
        res.status(500).json({ error: 'Failed to fetch committee details.' });
    }
});

// ══════════════════════════════════════════════════
// POST /switch — Switch active committee
// ══════════════════════════════════════════════════
router.post('/switch', async (req, res) => {
    try {
        const { slug } = req.body;
        const userId = req.user.userId;

        if (!slug) {
            return res.status(400).json({ error: 'Committee slug is required.' });
        }

        // Get committee
        const committeeResult = await masterDb.query(
            `SELECT * FROM committees WHERE slug = $1 AND is_active = true`,
            [slug.toLowerCase()]
        );

        if (committeeResult.rowCount === 0) {
            return res.status(404).json({ error: `Committee "${slug}" not found.` });
        }

        const committee = committeeResult.rows[0];

        // Verify membership
        const memberResult = await masterDb.query(
            `SELECT * FROM committee_members
       WHERE committee_id = $1 AND user_id = $2 AND is_active = true`,
            [committee.id, userId]
        );

        if (memberResult.rowCount === 0) {
            return res.status(403).json({
                error: `You are not a member of the ${committee.name} committee.`,
            });
        }

        // Update user's last_committee_slug
        await masterDb.query(
            `UPDATE users SET last_committee_slug = $1, updated_at = NOW() WHERE id = $2`,
            [slug.toLowerCase(), userId]
        );

        res.json({
            success: true,
            committee: {
                id: committee.id,
                name: committee.name,
                fullName: committee.full_name,
                slug: committee.slug,
                color: committee.color,
                icon: committee.icon,
            },
            role: memberResult.rows[0].role,
        });
    } catch (err) {
        console.error('Switch committee error:', err.message);
        res.status(500).json({ error: 'Failed to switch committee.' });
    }
});

// ══════════════════════════════════════════════════
// POST /:slug/members — Add a member
// ══════════════════════════════════════════════════
router.post('/:slug/members', async (req, res) => {
    try {
        const { slug } = req.params;
        const { userId, role, position } = req.body;
        const requestingUserId = req.user.userId;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required.' });
        }

        // Get committee
        const committeeResult = await masterDb.query(
            `SELECT * FROM committees WHERE slug = $1 AND is_active = true`,
            [slug.toLowerCase()]
        );

        if (committeeResult.rowCount === 0) {
            return res.status(404).json({ error: `Committee "${slug}" not found.` });
        }

        const committee = committeeResult.rows[0];

        // Check requesting user's role (must be head, admin, or advisor)
        const requestingMember = await masterDb.query(
            `SELECT role FROM committee_members
       WHERE committee_id = $1 AND user_id = $2 AND is_active = true`,
            [committee.id, requestingUserId]
        );

        if (requestingMember.rowCount === 0) {
            return res.status(403).json({ error: 'You are not a member of this committee.' });
        }

        const allowedRoles = ['head', 'admin', 'advisor'];
        if (!allowedRoles.includes(requestingMember.rows[0].role)) {
            return res.status(403).json({
                error: 'Only head, admin, or advisor can add members.',
                yourRole: requestingMember.rows[0].role,
                requiredRoles: allowedRoles,
            });
        }

        // Verify user exists
        const userExists = await masterDb.query(
            `SELECT id, name, email FROM users WHERE id = $1 AND is_active = true`,
            [userId]
        );

        if (userExists.rowCount === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Add member (ON CONFLICT reactivates)
        const memberResult = await masterDb.query(
            `INSERT INTO committee_members (committee_id, user_id, role, position)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (committee_id, user_id) DO UPDATE SET
         role = COALESCE($3, committee_members.role),
         position = COALESCE($4, committee_members.position),
         is_active = true,
         left_at = NULL,
         joined_at = CASE
           WHEN committee_members.is_active = false THEN NOW()
           ELSE committee_members.joined_at
         END
       RETURNING *`,
            [committee.id, userId, role || 'member', position || null]
        );

        res.status(201).json({
            success: true,
            member: {
                ...memberResult.rows[0],
                userName: userExists.rows[0].name,
                userEmail: userExists.rows[0].email,
            },
        });
    } catch (err) {
        console.error('Add member error:', err.message);
        res.status(500).json({ error: 'Failed to add member.' });
    }
});

// ══════════════════════════════════════════════════
// PATCH /:slug/members/:userId — Update member role/position
// ══════════════════════════════════════════════════
router.patch('/:slug/members/:userId', async (req, res) => {
    try {
        const { slug, userId } = req.params;
        const { role, position } = req.body;
        const requestingUserId = req.user.userId;

        // Get committee
        const committeeResult = await masterDb.query(
            `SELECT * FROM committees WHERE slug = $1 AND is_active = true`,
            [slug.toLowerCase()]
        );

        if (committeeResult.rowCount === 0) {
            return res.status(404).json({ error: `Committee "${slug}" not found.` });
        }

        const committee = committeeResult.rows[0];

        // Check requesting user's role
        const requestingMember = await masterDb.query(
            `SELECT role FROM committee_members
       WHERE committee_id = $1 AND user_id = $2 AND is_active = true`,
            [committee.id, requestingUserId]
        );

        if (requestingMember.rowCount === 0) {
            return res.status(403).json({ error: 'You are not a member of this committee.' });
        }

        const allowedRoles = ['head', 'admin', 'advisor'];
        if (!allowedRoles.includes(requestingMember.rows[0].role)) {
            return res.status(403).json({
                error: 'Only head, admin, or advisor can update member roles.',
                yourRole: requestingMember.rows[0].role,
                requiredRoles: allowedRoles,
            });
        }

        // Build update
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (role) {
            updates.push(`role = $${paramIndex++}`);
            values.push(role);
        }
        if (position !== undefined) {
            updates.push(`position = $${paramIndex++}`);
            values.push(position);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update. Provide role or position.' });
        }

        values.push(committee.id);
        values.push(userId);

        const result = await masterDb.query(
            `UPDATE committee_members SET ${updates.join(', ')}
       WHERE committee_id = $${paramIndex++} AND user_id = $${paramIndex++} AND is_active = true
       RETURNING *`,
            values
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Member not found in this committee.' });
        }

        res.json({
            success: true,
            member: result.rows[0],
        });
    } catch (err) {
        console.error('Update member error:', err.message);
        res.status(500).json({ error: 'Failed to update member.' });
    }
});

// ══════════════════════════════════════════════════
// DELETE /:slug/members/:userId — Soft-delete member
// ══════════════════════════════════════════════════
router.delete('/:slug/members/:userId', async (req, res) => {
    try {
        const { slug, userId } = req.params;
        const requestingUserId = req.user.userId;

        // Get committee
        const committeeResult = await masterDb.query(
            `SELECT * FROM committees WHERE slug = $1 AND is_active = true`,
            [slug.toLowerCase()]
        );

        if (committeeResult.rowCount === 0) {
            return res.status(404).json({ error: `Committee "${slug}" not found.` });
        }

        const committee = committeeResult.rows[0];

        // Check requesting user's role (or allow self-removal)
        if (userId !== requestingUserId) {
            const requestingMember = await masterDb.query(
                `SELECT role FROM committee_members
         WHERE committee_id = $1 AND user_id = $2 AND is_active = true`,
                [committee.id, requestingUserId]
            );

            if (requestingMember.rowCount === 0) {
                return res.status(403).json({ error: 'You are not a member of this committee.' });
            }

            const allowedRoles = ['head', 'admin', 'advisor'];
            if (!allowedRoles.includes(requestingMember.rows[0].role)) {
                return res.status(403).json({
                    error: 'Only head, admin, or advisor can remove members.',
                    yourRole: requestingMember.rows[0].role,
                    requiredRoles: allowedRoles,
                });
            }
        }

        // Soft delete
        const result = await masterDb.query(
            `UPDATE committee_members
       SET is_active = false, left_at = NOW()
       WHERE committee_id = $1 AND user_id = $2 AND is_active = true
       RETURNING *`,
            [committee.id, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Member not found in this committee.' });
        }

        res.json({
            success: true,
            message: 'Member removed from committee.',
        });
    } catch (err) {
        console.error('Remove member error:', err.message);
        res.status(500).json({ error: 'Failed to remove member.' });
    }
});

module.exports = router;
