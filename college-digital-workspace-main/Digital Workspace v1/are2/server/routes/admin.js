// ============================================
// routes/admin.js — Admin Routes
// ============================================
// CRUD for users, committee memberships, and roles.
// All routes require authMiddleware + adminMiddleware.
// ============================================

const express = require('express');
const router = express.Router();
const masterDb = require('../config/masterDb');

// ══════════════════════════════════════════════════
// GET / — List all users with their committee memberships
// ══════════════════════════════════════════════════
router.get('/users', async (req, res) => {
    try {
        const { search } = req.query;

        let userQuery = `
            SELECT u.id, u.name, u.email, u.global_role, u.firebase_uid,
                   u.avatar, u.created_at
            FROM users u
            WHERE u.is_active = true
        `;
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            userQuery += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
        }

        userQuery += ' ORDER BY u.created_at DESC';

        const usersResult = await masterDb.query(userQuery, params);

        // Get memberships for all users
        const membershipsResult = await masterDb.query(`
            SELECT cm.user_id, cm.committee_id, cm.role, cm.is_active,
                   c.name AS committee_name, c.slug, c.color
            FROM committee_members cm
            JOIN committees c ON c.id = cm.committee_id
            WHERE cm.is_active = true
            ORDER BY cm.joined_at ASC
        `);

        // Group memberships by user_id
        const membershipMap = {};
        membershipsResult.rows.forEach(m => {
            if (!membershipMap[m.user_id]) membershipMap[m.user_id] = [];
            membershipMap[m.user_id].push({
                committeeId: m.committee_id,
                committeeName: m.committee_name,
                slug: m.slug,
                color: m.color,
                role: m.role,
            });
        });

        const users = usersResult.rows.map(u => ({
            ...u,
            globalRole: u.global_role,
            committees: membershipMap[u.id] || [],
        }));

        res.json({ success: true, users, total: users.length });
    } catch (err) {
        console.error('Admin list users error:', err.message);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

// ══════════════════════════════════════════════════
// GET /committees — List all committees
// ══════════════════════════════════════════════════
router.get('/committees', async (req, res) => {
    try {
        const result = await masterDb.query(
            `SELECT id, name, full_name, slug, description, color, icon, db_name, is_active
             FROM committees WHERE is_active = true ORDER BY name ASC`
        );
        res.json({ success: true, committees: result.rows });
    } catch (err) {
        console.error('Admin list committees error:', err.message);
        res.status(500).json({ error: 'Failed to fetch committees.' });
    }
});

// ══════════════════════════════════════════════════
// POST /users/:userId/committees — Add user to a committee
// ══════════════════════════════════════════════════
router.post('/users/:userId/committees', async (req, res) => {
    try {
        const { userId } = req.params;
        const { committeeId, role = 'member' } = req.body;

        if (!committeeId) {
            return res.status(400).json({ error: 'committeeId is required.' });
        }

        // Check user exists
        const user = await masterDb.query('SELECT id, name FROM users WHERE id = $1', [userId]);
        if (user.rowCount === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Check committee exists
        const committee = await masterDb.query('SELECT id, name FROM committees WHERE id = $1', [committeeId]);
        if (committee.rowCount === 0) {
            return res.status(404).json({ error: 'Committee not found.' });
        }

        // Check if already a member
        const existing = await masterDb.query(
            'SELECT 1 FROM committee_members WHERE user_id = $1 AND committee_id = $2',
            [userId, committeeId]
        );

        if (existing.rowCount > 0) {
            // Update role and reactivate
            await masterDb.query(
                `UPDATE committee_members SET role = $1, is_active = true
                 WHERE user_id = $2 AND committee_id = $3`,
                [role, userId, committeeId]
            );
        } else {
            await masterDb.query(
                `INSERT INTO committee_members (committee_id, user_id, role, is_active)
                 VALUES ($1, $2, $3, true)`,
                [committeeId, userId, role]
            );
        }

        res.json({
            success: true,
            message: `${user.rows[0].name} added to ${committee.rows[0].name} as ${role}`,
        });
    } catch (err) {
        console.error('Admin add to committee error:', err.message);
        res.status(500).json({ error: 'Failed to add user to committee.' });
    }
});

// ══════════════════════════════════════════════════
// DELETE /users/:userId/committees/:committeeId — Remove user from committee
// ══════════════════════════════════════════════════
router.delete('/users/:userId/committees/:committeeId', async (req, res) => {
    try {
        const { userId, committeeId } = req.params;

        await masterDb.query(
            'UPDATE committee_members SET is_active = false WHERE user_id = $1 AND committee_id = $2',
            [userId, committeeId]
        );

        res.json({ success: true, message: 'User removed from committee.' });
    } catch (err) {
        console.error('Admin remove from committee error:', err.message);
        res.status(500).json({ error: 'Failed to remove user from committee.' });
    }
});

// ══════════════════════════════════════════════════
// PATCH /users/:userId/role — Change user's global role
// ══════════════════════════════════════════════════
router.patch('/users/:userId/role', async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        const validRoles = ['superadmin', 'admin', 'user'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: `Invalid role. Must be: ${validRoles.join(', ')}` });
        }

        await masterDb.query(
            'UPDATE users SET global_role = $1, updated_at = NOW() WHERE id = $2',
            [role, userId]
        );

        res.json({ success: true, message: `User role updated to ${role}` });
    } catch (err) {
        console.error('Admin change role error:', err.message);
        res.status(500).json({ error: 'Failed to update role.' });
    }
});

module.exports = router;
