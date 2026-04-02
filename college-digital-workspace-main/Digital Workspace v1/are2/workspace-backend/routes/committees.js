// ============================================
// routes/committees.js — Committee Management
// ============================================
// All routes need firebaseAuth. Uses masterDb for membership,
// committeeDbManager for stats.
// ============================================

const express = require('express');
const router = express.Router();
const masterDb = require('../config/masterDb');
const committeeDbManager = require('../config/committeeDbManager');
const firebaseAuth = require('../middleware/firebaseAuth');

// Role hierarchy for sorting members
const ROLE_ORDER = {
    head: 0,
    advisor: 1,
    admin: 2,
    coordinator: 3,
    secretary: 4,
    treasurer: 5,
    volunteer: 6,
    member: 7,
};

// ═══════════════════════════════════════════════
//  GET / — List all committees
// ═══════════════════════════════════════════════
router.get('/', firebaseAuth, async (req, res) => {
    try {
        const result = await masterDb.query(
            `SELECT c.*,
                (SELECT COUNT(*) FROM committee_members cm
                 WHERE cm.committee_id = c.id AND cm.is_active = true) AS member_count
             FROM committees c
             WHERE c.is_active = true
             ORDER BY c.name`
        );

        // Get user's membership info for each committee
        const membershipResult = await masterDb.query(
            `SELECT committee_id, role FROM committee_members
             WHERE user_id = $1 AND is_active = true`,
            [req.user.id]
        );

        const membershipMap = {};
        for (const m of membershipResult.rows) {
            membershipMap[m.committee_id] = m.role;
        }

        const committees = result.rows.map((c) => ({
            id: c.id,
            name: c.name,
            fullName: c.full_name,
            slug: c.slug,
            description: c.description,
            logo: c.logo,
            color: c.color,
            icon: c.icon,
            memberCount: parseInt(c.member_count),
            maxMembers: c.max_members,
            isMember: !!membershipMap[c.id],
            myRole: membershipMap[c.id] || null,
            createdAt: c.created_at,
        }));

        res.json({ success: true, committees });
    } catch (err) {
        console.error('  ❌ List committees error:', err.message);
        res.status(500).json({ error: 'Failed to fetch committees' });
    }
});

// ═══════════════════════════════════════════════
//  GET /mine — List user's committees
// ═══════════════════════════════════════════════
router.get('/mine', firebaseAuth, async (req, res) => {
    try {
        const result = await masterDb.query(
            `SELECT c.*, cm.role, cm.position, cm.joined_at,
                (SELECT COUNT(*) FROM committee_members cm2
                 WHERE cm2.committee_id = c.id AND cm2.is_active = true) AS member_count
             FROM committees c
             JOIN committee_members cm ON c.id = cm.committee_id
             WHERE cm.user_id = $1 AND cm.is_active = true AND c.is_active = true
             ORDER BY c.name`,
            [req.user.id]
        );

        // Get user's last committee slug
        const userResult = await masterDb.query(
            'SELECT last_committee_slug FROM users WHERE id = $1',
            [req.user.id]
        );

        const committees = result.rows.map((c) => ({
            id: c.id,
            name: c.name,
            fullName: c.full_name,
            slug: c.slug,
            description: c.description,
            logo: c.logo,
            color: c.color,
            icon: c.icon,
            role: c.role,
            position: c.position,
            joinedAt: c.joined_at,
            memberCount: parseInt(c.member_count),
        }));

        res.json({
            success: true,
            committees,
            lastCommitteeSlug: userResult.rows[0]?.last_committee_slug || null,
        });
    } catch (err) {
        console.error('  ❌ List my committees error:', err.message);
        res.status(500).json({ error: 'Failed to fetch your committees' });
    }
});

// ═══════════════════════════════════════════════
//  GET /:slug/details — Committee details + members + stats
// ═══════════════════════════════════════════════
router.get('/:slug/details', firebaseAuth, async (req, res) => {
    try {
        const { slug } = req.params;

        // Get committee
        const committeeResult = await masterDb.query(
            'SELECT * FROM committees WHERE slug = $1 AND is_active = true',
            [slug.toLowerCase()]
        );

        if (committeeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Committee not found' });
        }

        const committee = committeeResult.rows[0];

        // Get members with user info, ordered by role hierarchy
        const membersResult = await masterDb.query(
            `SELECT cm.*, u.name, u.email, u.avatar
             FROM committee_members cm
             JOIN users u ON cm.user_id = u.id
             WHERE cm.committee_id = $1 AND cm.is_active = true
             ORDER BY
                CASE cm.role
                    WHEN 'head' THEN 0
                    WHEN 'advisor' THEN 1
                    WHEN 'admin' THEN 2
                    WHEN 'coordinator' THEN 3
                    WHEN 'secretary' THEN 4
                    WHEN 'treasurer' THEN 5
                    WHEN 'volunteer' THEN 6
                    WHEN 'member' THEN 7
                    ELSE 8
                END,
                u.name`,
            [committee.id]
        );

        // Get stats from committee database
        let stats = {
            fileCount: 0,
            folderCount: 0,
            taskCount: 0,
            meetingCount: 0,
            announcementCount: 0,
            messageCount: 0,
        };

        try {
            const pool = committeeDbManager.getPool(committee.slug);

            const statsQueries = await Promise.all([
                pool.query('SELECT COUNT(*) AS count FROM files WHERE is_trashed = false'),
                pool.query('SELECT COUNT(*) AS count FROM folders WHERE is_trashed = false'),
                pool.query('SELECT COUNT(*) AS count FROM tasks'),
                pool.query('SELECT COUNT(*) AS count FROM meetings'),
                pool.query('SELECT COUNT(*) AS count FROM announcements'),
                pool.query('SELECT COUNT(*) AS count FROM messages WHERE is_deleted = false'),
            ]);

            stats = {
                fileCount: parseInt(statsQueries[0].rows[0].count),
                folderCount: parseInt(statsQueries[1].rows[0].count),
                taskCount: parseInt(statsQueries[2].rows[0].count),
                meetingCount: parseInt(statsQueries[3].rows[0].count),
                announcementCount: parseInt(statsQueries[4].rows[0].count),
                messageCount: parseInt(statsQueries[5].rows[0].count),
            };
        } catch (statsErr) {
            console.error(`  ⚠️  Could not fetch stats for ${slug}:`, statsErr.message);
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
                createdAt: committee.created_at,
            },
            members: membersResult.rows.map((m) => ({
                id: m.user_id,
                name: m.name,
                email: m.email,
                avatar: m.avatar,
                role: m.role,
                position: m.position,
                joinedAt: m.joined_at,
            })),
            stats,
        });
    } catch (err) {
        console.error('  ❌ Committee details error:', err.message);
        res.status(500).json({ error: 'Failed to fetch committee details' });
    }
});

// ═══════════════════════════════════════════════
//  POST /switch — Switch active committee
// ═══════════════════════════════════════════════
router.post('/switch', firebaseAuth, async (req, res) => {
    try {
        const { slug } = req.body;

        if (!slug) {
            return res.status(400).json({ error: 'slug is required' });
        }

        // Verify committee exists
        const committeeResult = await masterDb.query(
            'SELECT * FROM committees WHERE slug = $1 AND is_active = true',
            [slug.toLowerCase()]
        );

        if (committeeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Committee not found' });
        }

        const committee = committeeResult.rows[0];

        // Verify membership
        const memberResult = await masterDb.query(
            `SELECT * FROM committee_members
             WHERE committee_id = $1 AND user_id = $2 AND is_active = true`,
            [committee.id, req.user.id]
        );

        if (memberResult.rows.length === 0) {
            return res.status(403).json({ error: `You are not a member of ${committee.name}` });
        }

        // Update last_committee_slug
        await masterDb.query(
            'UPDATE users SET last_committee_slug = $1, updated_at = NOW() WHERE id = $2',
            [committee.slug, req.user.id]
        );

        res.json({
            success: true,
            committee: {
                id: committee.id,
                name: committee.name,
                slug: committee.slug,
                color: committee.color,
                icon: committee.icon,
            },
            role: memberResult.rows[0].role,
        });
    } catch (err) {
        console.error('  ❌ Switch committee error:', err.message);
        res.status(500).json({ error: 'Failed to switch committee' });
    }
});

// ═══════════════════════════════════════════════
//  POST /:slug/members — Add member
// ═══════════════════════════════════════════════
// Only head/admin/advisor can add members
router.post('/:slug/members', firebaseAuth, async (req, res) => {
    try {
        const { slug } = req.params;
        const { userId, role, position } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        // Get committee
        const committeeResult = await masterDb.query(
            'SELECT * FROM committees WHERE slug = $1 AND is_active = true',
            [slug.toLowerCase()]
        );

        if (committeeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Committee not found' });
        }

        const committee = committeeResult.rows[0];

        // Verify requester is head/admin/advisor
        const requesterMembership = await masterDb.query(
            `SELECT role FROM committee_members
             WHERE committee_id = $1 AND user_id = $2 AND is_active = true`,
            [committee.id, req.user.id]
        );

        if (requesterMembership.rows.length === 0) {
            return res.status(403).json({ error: 'You are not a member of this committee' });
        }

        const allowedRoles = ['head', 'admin', 'advisor'];
        if (!allowedRoles.includes(requesterMembership.rows[0].role)) {
            return res.status(403).json({
                error: 'Only head, admin, or advisor can add members',
                yourRole: requesterMembership.rows[0].role,
            });
        }

        // Add or reactivate member
        const result = await masterDb.query(
            `INSERT INTO committee_members (committee_id, user_id, role, position)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (committee_id, user_id) DO UPDATE SET
                is_active = true,
                role = COALESCE($3, committee_members.role),
                position = COALESCE($4, committee_members.position),
                left_at = NULL
             RETURNING *`,
            [committee.id, userId, role || 'member', position || null]
        );

        // Get user info
        const userResult = await masterDb.query(
            'SELECT name, email, avatar FROM users WHERE id = $1',
            [userId]
        );

        res.status(201).json({
            success: true,
            member: {
                ...result.rows[0],
                name: userResult.rows[0]?.name,
                email: userResult.rows[0]?.email,
                avatar: userResult.rows[0]?.avatar,
            },
        });
    } catch (err) {
        console.error('  ❌ Add member error:', err.message);
        res.status(500).json({ error: 'Failed to add member' });
    }
});

// ═══════════════════════════════════════════════
//  PATCH /:slug/members/:userId — Update member
// ═══════════════════════════════════════════════
router.patch('/:slug/members/:userId', firebaseAuth, async (req, res) => {
    try {
        const { slug, userId } = req.params;
        const { role, position } = req.body;

        // Get committee
        const committeeResult = await masterDb.query(
            'SELECT * FROM committees WHERE slug = $1 AND is_active = true',
            [slug.toLowerCase()]
        );

        if (committeeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Committee not found' });
        }

        const committee = committeeResult.rows[0];

        // Verify requester is head/admin/advisor
        const requesterMembership = await masterDb.query(
            `SELECT role FROM committee_members
             WHERE committee_id = $1 AND user_id = $2 AND is_active = true`,
            [committee.id, req.user.id]
        );

        if (requesterMembership.rows.length === 0) {
            return res.status(403).json({ error: 'You are not a member of this committee' });
        }

        const allowedRoles = ['head', 'admin', 'advisor'];
        if (!allowedRoles.includes(requesterMembership.rows[0].role)) {
            return res.status(403).json({
                error: 'Only head, admin, or advisor can update members',
            });
        }

        // Build dynamic update
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (role !== undefined) {
            updates.push(`role = $${paramIndex++}`);
            values.push(role);
        }
        if (position !== undefined) {
            updates.push(`position = $${paramIndex++}`);
            values.push(position);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update (role, position)' });
        }

        values.push(committee.id);
        values.push(userId);

        const result = await masterDb.query(
            `UPDATE committee_members SET ${updates.join(', ')}
             WHERE committee_id = $${paramIndex++} AND user_id = $${paramIndex} AND is_active = true
             RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Member not found in this committee' });
        }

        res.json({ success: true, member: result.rows[0] });
    } catch (err) {
        console.error('  ❌ Update member error:', err.message);
        res.status(500).json({ error: 'Failed to update member' });
    }
});

// ═══════════════════════════════════════════════
//  DELETE /:slug/members/:userId — Remove member (soft delete)
// ═══════════════════════════════════════════════
router.delete('/:slug/members/:userId', firebaseAuth, async (req, res) => {
    try {
        const { slug, userId } = req.params;

        // Get committee
        const committeeResult = await masterDb.query(
            'SELECT * FROM committees WHERE slug = $1 AND is_active = true',
            [slug.toLowerCase()]
        );

        if (committeeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Committee not found' });
        }

        const committee = committeeResult.rows[0];

        // Verify requester is head/admin/advisor
        const requesterMembership = await masterDb.query(
            `SELECT role FROM committee_members
             WHERE committee_id = $1 AND user_id = $2 AND is_active = true`,
            [committee.id, req.user.id]
        );

        if (requesterMembership.rows.length === 0) {
            return res.status(403).json({ error: 'You are not a member of this committee' });
        }

        const allowedRoles = ['head', 'admin', 'advisor'];
        if (!allowedRoles.includes(requesterMembership.rows[0].role)) {
            return res.status(403).json({
                error: 'Only head, admin, or advisor can remove members',
            });
        }

        // Soft delete
        const result = await masterDb.query(
            `UPDATE committee_members
             SET is_active = false, left_at = NOW()
             WHERE committee_id = $1 AND user_id = $2 AND is_active = true
             RETURNING *`,
            [committee.id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Member not found in this committee' });
        }

        res.json({ success: true, message: 'Member removed' });
    } catch (err) {
        console.error('  ❌ Remove member error:', err.message);
        res.status(500).json({ error: 'Failed to remove member' });
    }
});

module.exports = router;
